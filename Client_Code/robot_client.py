# Robot Client for PF Python Web Editor v2.0
# 라즈베리파이에서 실행되는 로봇 클라이언트 (SocketIO 버전)

import socketio
import time
import threading
import uuid
import sys
import io
import contextlib
import base64
import cv2
import numpy as np
import platform
import requests

# 하드웨어 제어 모듈
if platform.system() == "Linux":
    from findee import Findee
    HARDWARE_ENABLED = True
else:
    Findee = None
    HARDWARE_ENABLED = False

# 로봇 설정
ROBOT_ID = f"robot_{uuid.uuid4().hex[:8]}"
ROBOT_NAME = "Robot1"
SERVER_URL = "https://pathfinder-kit.duckdns.org"

# SocketIO 클라이언트 생성
sio = socketio.Client()

# 로봇 상태 관리
robot_status = {
    'connected': False,
    'executing_code': False,
    'current_session': None
}

# 하드웨어 제어 객체
robot_hardware = None

def init_hardware():
    """하드웨어 초기화"""
    global robot_hardware
    if HARDWARE_ENABLED and Findee:
        try:
            robot_hardware = Findee()
            print("✅ 하드웨어 초기화 완료")
            return True
        except Exception as e:
            print(f"❌ 하드웨어 초기화 실패: {e}")
            return False
    return False

# register_with_server 함수 제거 - SocketIO 연결 시 자동 등록됨

def emit_image(image, widget_id):
    """이미지를 중앙 서버로 전송"""
    if not robot_status['current_session']:
        return
    
    try:
        if hasattr(image, 'shape'):  # numpy 배열인지 확인
            # 이미지를 JPEG로 인코딩
            ok, buffer = cv2.imencode('.jpg', image, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
            if not ok:
                print("❌ JPEG 인코딩 실패")
                return
            
            # base64로 인코딩
            image_data = base64.b64encode(buffer.tobytes()).decode('utf-8')
            
            # SocketIO로 전송
            sio.emit('robot_emit_image', {
                'session_id': robot_status['current_session'],
                'image_data': image_data,
                'widget_id': widget_id
            })
    
    except Exception as e:
        print(f"❌ 이미지 전송 실패: {e}")

def emit_text(text, widget_id):
    """텍스트를 중앙 서버로 전송"""
    if not robot_status['current_session']:
        return
    
    try:
        sio.emit('robot_emit_text', {
            'session_id': robot_status['current_session'],
            'text': text,
            'widget_id': widget_id
        })
    except Exception as e:
        print(f"❌ 텍스트 전송 실패: {e}")

def execute_python_code(code, session_id):
    """Python 코드 실행"""
    robot_status['current_session'] = session_id
    robot_status['executing_code'] = True
    
    try:
        # stdout과 stderr를 캡처하기 위한 StringIO 객체
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()
        
        # 코드 실행 컨텍스트
        with contextlib.redirect_stdout(stdout_capture), contextlib.redirect_stderr(stderr_capture):
            # 실행 네임스페이스 설정
            exec_globals = {
                '__builtins__': __builtins__,
                'Findee': Findee,
                'robot': robot_hardware,
                'emit_image': emit_image,
                'emit_text': emit_text,
                'print': print,
                'len': len,
                'range': range,
                'enumerate': enumerate,
                'zip': zip,
                'map': map,
                'filter': filter,
                'sorted': sorted,
                'sum': sum,
                'min': min,
                'max': max,
                'abs': abs,
                'round': round,
                'str': str,
                'int': int,
                'float': float,
                'bool': bool,
                'list': list,
                'tuple': tuple,
                'dict': dict,
                'set': set,
                'type': type,
                'isinstance': isinstance,
            }
            
            # 코드 실행
            exec(code, exec_globals)
        
        # stdout 출력 처리
        stdout_output = stdout_capture.getvalue()
        if stdout_output:
            for line in stdout_output.splitlines():
                sio.emit('robot_stdout', {
                    'session_id': session_id,
                    'output': line
                })
                print(f"출력: {line}")
        
        # stderr 출력 처리
        stderr_output = stderr_capture.getvalue()
        if stderr_output:
            for line in stderr_output.splitlines():
                sio.emit('robot_stderr', {
                    'session_id': session_id,
                    'output': line
                })
                print(f"경고: {line}")
        
        # 실행 완료 알림
        sio.emit('robot_finished', {
            'session_id': session_id,
            'output': '실행 완료'
        })
        print("✅ 코드 실행 완료")
        
    except Exception as e:
        # 오류 발생 시 서버로 전송
        error_msg = f"{type(e).__name__}: {str(e)}"
        sio.emit('robot_stderr', {
            'session_id': session_id,
            'output': error_msg
        })
        print(f"❌ 실행 오류: {error_msg}")
        
        # 실행 완료 알림 (오류 발생해도)
        sio.emit('robot_finished', {
            'session_id': session_id,
            'output': '실행 완료 (오류 발생)'
        })
    
    finally:
        # 정리
        robot_status['executing_code'] = False
        robot_status['current_session'] = None

@sio.event
def connect():
    print(f"✅ 서버에 연결됨: {SERVER_URL}")
    print(f"🔧 로봇 ID: {ROBOT_ID}")
    print(f"🔧 로봇 이름: {ROBOT_NAME}")
    print(f"🐍 Python 버전: {sys.version}")
    print(f"🔧 하드웨어 활성화: {HARDWARE_ENABLED}")
    
    robot_status['connected'] = True
    
    # 서버에 로봇 등록
    print("📤 서버에 로봇 등록 요청 전송...")
    sio.emit('robot_connected', {
        'robot_id': ROBOT_ID,
        'robot_name': ROBOT_NAME,
        'hardware_enabled': HARDWARE_ENABLED
    })

@sio.event
def disconnect():
    print("❌ 서버 연결 해제됨")
    robot_status['connected'] = False

@sio.event
def execute_code(data):
    """서버로부터 코드 실행 요청 수신"""
    code = data.get('code', '')
    session_id = data.get('session_id', '')
    
    print(f"\n📨 서버로부터 코드 수신:")
    print("=" * 50)
    print(code)
    print("=" * 50)
    
    # 별도 스레드에서 코드 실행
    thread = threading.Thread(
        target=execute_python_code,
        args=(code, session_id),
        daemon=True
    )
    thread.start()

@sio.event
def stop_code(data):
    """코드 실행 중지 요청"""
    session_id = data.get('session_id', '')
    print(f"🛑 코드 실행 중지 요청: {session_id}")
    # 현재는 단순히 메시지만 출력 (실제 중지 로직은 필요시 구현)

@sio.event
def robot_registered(data):
    """서버에서 로봇 등록 확인 수신"""
    if data.get('success'):
        print(f"✅ {data.get('message')}")
    else:
        print(f"❌ 로봇 등록 실패: {data.get('error')}")

def heartbeat_thread():
    """하트비트 전송 스레드"""
    while True:
        if robot_status['connected']:
            try:
                sio.emit('robot_heartbeat', {
                    'robot_id': ROBOT_ID,
                    'status': 'online'
                })
                print("💓 하트비트 전송")
            except Exception as e:
                print(f"❌ 하트비트 전송 실패: {e}")
        time.sleep(10)  # 10초마다 전송

def main():
    print("🚀 PF Python Web Editor Robot Client 시작")
    print(f"🔗 서버 연결 시도: {SERVER_URL}")
    
    # 하드웨어 초기화
    if init_hardware():
        print("✅ 하드웨어 초기화 성공")
    else:
        print("⚠️ 하드웨어 초기화 실패 (시뮬레이션 모드)")
    
    try:
        # 서버에 연결
        sio.connect(SERVER_URL)
        
        # 하트비트 스레드 시작
        heartbeat_thread_obj = threading.Thread(target=heartbeat_thread, daemon=True)
        heartbeat_thread_obj.start()
        
        # 연결 유지
        print("\n⚡ 로봇 클라이언트 실행 중... (Ctrl+C로 종료)")
        print("💡 서버 웹페이지에서 코드를 작성하고 실행해보세요!")
        
        while True:
            time.sleep(1)
    
    except KeyboardInterrupt:
        print("\n🛑 로봇 클라이언트 종료 중...")
    except Exception as e:
        print(f"❌ 연결 오류: {e}")
    finally:
        # 연결 상태 확인 후 안전하게 해제
        if sio.connected:
            try:
                sio.emit('robot_disconnected', {'robot_id': ROBOT_ID})
                sio.disconnect()
            except Exception as e:
                print(f"⚠️ 연결 해제 중 오류: {e}")
        else:
            print("ℹ️ 이미 연결이 해제된 상태입니다")
        
        print("✅ 로봇 클라이언트 종료 완료")

if __name__ == '__main__':
    main()
