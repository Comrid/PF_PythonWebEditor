# Robot Client for PF Python Web Editor v2.0
# 라즈베리파이에서 실행되는 로봇 클라이언트

from __future__ import annotations
from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
import requests
import threading
import time
import base64
import cv2
import numpy as np
from datetime import datetime
import platform
import os

# 하드웨어 제어 모듈
if platform.system() == "Linux":
    from findee import Findee
    HARDWARE_ENABLED = True
else:
    Findee = None
    HARDWARE_ENABLED = False

# 로봇 클라이언트 설정 로드
try:
    from robot_config import *
    ROBOT_CONFIG = {
        'CENTRAL_SERVER_URL': CENTRAL_SERVER_URL,
        'ROBOT_ID': ROBOT_ID,
        'ROBOT_NAME': ROBOT_NAME,
        'HARDWARE_ENABLED': HARDWARE_ENABLED,
        'VERIFY_SSL': VERIFY_SSL,
        'HEARTBEAT_INTERVAL': HEARTBEAT_INTERVAL,
        'REQUEST_TIMEOUT': REQUEST_TIMEOUT,
        'ROBOT_PORT': ROBOT_PORT
    }
except ImportError:
    # 기본 설정 사용
    ROBOT_CONFIG = {
        'CENTRAL_SERVER_URL': 'https://pathfinder-kit.duckdns.org',
        'ROBOT_ID': 'robot_001',
        'ROBOT_NAME': 'My Robot',
        'HARDWARE_ENABLED': HARDWARE_ENABLED,
        'VERIFY_SSL': True,
        'HEARTBEAT_INTERVAL': 10,
        'REQUEST_TIMEOUT': 30,
        'ROBOT_PORT': 5001
    }

app = Flask(__name__)
app.config['SECRET_KEY'] = 'robot-client-secret-key'

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='threading',
    logger=False,
    engineio_logger=False
)

# 로봇 상태 관리
robot_status = {
    'connected': False,
    'last_heartbeat': 0,
    'current_session': None,
    'executing_code': False
}

# 코드 실행 관련
running_threads = {}
stop_flags = {}
gesture_states = {}
pid_states = {}
slider_states = {}

# 하드웨어 제어 객체
robot_hardware = None

def init_hardware():
    """하드웨어 초기화"""
    global robot_hardware
    if HARDWARE_ENABLED and Findee:
        try:
            robot_hardware = Findee()
            print("DEBUG: 하드웨어 초기화 완료")
            return True
        except Exception as e:
            print(f"DEBUG: 하드웨어 초기화 실패: {e}")
            return False
    return False

def register_with_server():
    """중앙 서버에 로봇 등록"""
    try:
        response = requests.post(
            f"{ROBOT_CONFIG['CENTRAL_SERVER_URL']}/api/robot/register",
            json={
                'robot_id': ROBOT_CONFIG['ROBOT_ID'],
                'robot_name': ROBOT_CONFIG['ROBOT_NAME'],
                'status': 'available'
            },
            timeout=10,
            verify=ROBOT_CONFIG['VERIFY_SSL']
        )
        
        if response.status_code == 200:
            print("✅ 서버 등록 성공")
            return True
        else:
            print(f"❌ 서버 등록 실패: {response.status_code}")
            return False
    
    except Exception as e:
        print(f"❌ 서버 등록 오류: {e}")
        return False

def send_heartbeat():
    """중앙 서버에 하트비트 전송"""
    try:
        response = requests.post(
            f"{ROBOT_CONFIG['CENTRAL_SERVER_URL']}/api/robots/{ROBOT_CONFIG['ROBOT_ID']}/heartbeat",
            timeout=10,
            verify=ROBOT_CONFIG['VERIFY_SSL']
        )
        
        if response.status_code == 200:
            robot_status['connected'] = True
            robot_status['last_heartbeat'] = time.time()
            print("DEBUG: 하트비트 전송 성공")
        else:
            robot_status['connected'] = False
            print(f"DEBUG: 하트비트 전송 실패: {response.status_code}")
    
    except Exception as e:
        robot_status['connected'] = False
        print(f"DEBUG: 하트비트 전송 오류: {e}")

def send_to_central_server(endpoint: str, data: dict):
    """중앙 서버로 데이터 전송"""
    try:
        response = requests.post(
            f"{ROBOT_CONFIG['CENTRAL_SERVER_URL']}{endpoint}",
            json=data,
            timeout=10,
            verify=ROBOT_CONFIG['VERIFY_SSL']
        )
        return response.status_code == 200
    except Exception as e:
        print(f"DEBUG: 중앙 서버 전송 실패: {e}")
        return False

def emit_image(image, widget_id):
    """이미지를 중앙 서버로 전송"""
    if not robot_status['current_session']:
        return
    
    try:
        if hasattr(image, 'shape'):  # numpy 배열인지 확인
            # 이미지를 JPEG로 인코딩
            ok, buffer = cv2.imencode('.jpg', image, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
            if not ok:
                print("DEBUG: JPEG 인코딩 실패")
                return
            
            # base64로 인코딩
            image_data = base64.b64encode(buffer.tobytes()).decode('utf-8')
            
            # 중앙 서버로 전송
            send_to_central_server('/api/robot/emit/image', {
                'session_id': robot_status['current_session'],
                'image_data': image_data,
                'widget_id': widget_id
            })
    
    except Exception as e:
        print(f"DEBUG: 이미지 전송 실패: {e}")

def emit_text(text, widget_id):
    """텍스트를 중앙 서버로 전송"""
    if not robot_status['current_session']:
        return
    
    try:
        send_to_central_server('/api/robot/emit/text', {
            'session_id': robot_status['current_session'],
            'text': text,
            'widget_id': widget_id
        })
    except Exception as e:
        print(f"DEBUG: 텍스트 전송 실패: {e}")

def execute_code(code: str, session_id: str):
    """코드 실행"""
    robot_status['current_session'] = session_id
    robot_status['executing_code'] = True
    stop_flags[session_id] = False
    
    def check_stop_flag(func):
        def wrapper(*args, **kwargs):
            if stop_flags.get(session_id, False):
                return
            return func(*args, **kwargs)
        return wrapper
    
    @check_stop_flag
    def realtime_print(*args, **kwargs):
        output = ' '.join(str(arg) for arg in args)
        if output:
            send_to_central_server('/api/robot/stdout', {
                'session_id': session_id,
                'output': output
            })
    
    try:
        @check_stop_flag
        def get_gesture():
            return gesture_states.get(session_id, {})
        
        @check_stop_flag
        def get_pid_value(widget_id: str):
            state = pid_states.get(session_id, {}).get(widget_id)
            if not state:
                return (0.0, 0.0, 0.0)
            return (float(state.get('p', 0.0)), float(state.get('i', 0.0)), float(state.get('d', 0.0)))
        
        @check_stop_flag
        def get_slider_value(widget_id: str):
            values = slider_states.get(session_id, {}).get(widget_id)
            if not values:
                return 0.0
            if len(values) == 1:
                return float(values[0])
            return [float(v) for v in values]
        
        # 실행 네임스페이스 설정
        exec_namespace = {
            'Findee': Findee,
            'robot': robot_hardware,
            'emit_image': emit_image,
            'emit_text': emit_text,
            'get_gesture': get_gesture,
            'get_pid_value': get_pid_value,
            'get_slider_value': get_slider_value,
            'print': realtime_print
        }
        
        # 코드 실행
        compiled_code = compile(code, '<string>', 'exec')
        exec(compiled_code, exec_namespace)
    
    except Exception as e:
        # 오류 출력
        import traceback
        for line in traceback.format_exc().splitlines():
            send_to_central_server('/api/robot/stderr', {
                'session_id': session_id,
                'output': line
            })
    
    finally:
        # 정리
        robot_status['executing_code'] = False
        robot_status['current_session'] = None
        running_threads.pop(session_id, None)
        stop_flags.pop(session_id, None)
        
        # 실행 완료 알림
        send_to_central_server('/api/robot/finished', {
            'session_id': session_id
        })
        
        print(f"DEBUG: Session {session_id}: 코드 실행 완료")

# Flask 라우트
@app.route('/')
def index():
    return jsonify({
        'status': 'robot_client',
        'robot_id': ROBOT_CONFIG['ROBOT_ID'],
        'robot_name': ROBOT_CONFIG['ROBOT_NAME'],
        'hardware_enabled': HARDWARE_ENABLED,
        'connected': robot_status['connected']
    })

@app.route('/execute', methods=['POST'])
def handle_execute():
    """코드 실행 요청 처리"""
    try:
        data = request.get_json()
        code = data.get('code', '')
        session_id = data.get('session_id', '')
        
        if not code or not session_id:
            return jsonify({"success": False, "error": "코드와 세션 ID가 필요합니다"}), 400
        
        # 별도 스레드에서 코드 실행
        thread = threading.Thread(
            target=execute_code,
            args=(code, session_id),
            daemon=True
        )
        
        running_threads[session_id] = thread
        thread.start()
        
        return jsonify({"success": True, "message": "코드 실행을 시작합니다"})
    
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/stop', methods=['POST'])
def handle_stop():
    """코드 실행 중지"""
    try:
        data = request.get_json()
        session_id = data.get('session_id', '')
        
        if session_id in stop_flags:
            stop_flags[session_id] = True
            return jsonify({"success": True, "message": "코드 실행을 중지합니다"})
        else:
            return jsonify({"success": False, "error": "실행 중인 코드가 없습니다"}), 404
    
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/status')
def get_status():
    """로봇 상태 조회"""
    return jsonify({
        'robot_id': ROBOT_CONFIG['ROBOT_ID'],
        'robot_name': ROBOT_CONFIG['ROBOT_NAME'],
        'hardware_enabled': HARDWARE_ENABLED,
        'connected': robot_status['connected'],
        'executing_code': robot_status['executing_code'],
        'current_session': robot_status['current_session']
    })

# 하트비트 스레드
def heartbeat_thread():
    """하트비트 전송 스레드"""
    while True:
        send_heartbeat()
        time.sleep(ROBOT_CONFIG['HEARTBEAT_INTERVAL'])

if __name__ == '__main__':
    print("=== PF Python Web Editor Robot Client ===")
    print(f"로봇 ID: {ROBOT_CONFIG['ROBOT_ID']}")
    print(f"로봇 이름: {ROBOT_CONFIG['ROBOT_NAME']}")
    print(f"하드웨어 활성화: {HARDWARE_ENABLED}")
    print(f"중앙 서버: {ROBOT_CONFIG['CENTRAL_SERVER_URL']}")
    
    # 하드웨어 초기화
    if init_hardware():
        print("하드웨어 초기화 성공")
    else:
        print("하드웨어 초기화 실패 (시뮬레이션 모드)")
    
    # 서버에 로봇 등록
    print("서버에 로봇 등록 중...")
    if register_with_server():
        print("✅ 로봇 등록 완료")
    else:
        print("❌ 로봇 등록 실패 - 계속 진행")
    
    # 하트비트 스레드 시작
    heartbeat_thread_obj = threading.Thread(target=heartbeat_thread, daemon=True)
    heartbeat_thread_obj.start()
    
    # Flask 앱 실행
    print("로봇 클라이언트 시작...")
    socketio.run(app, host='0.0.0.0', port=ROBOT_CONFIG['ROBOT_PORT'], debug=False)
