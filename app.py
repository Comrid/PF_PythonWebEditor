from __future__ import annotations
from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_socketio import SocketIO, emit
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from secrets import token_hex

import requests
import time
import sqlite3
import threading
from datetime import datetime

# Blueprints
from blueprints.custom_code_bp import custom_code_bp
from blueprints.tutorial_bp import tutorial_bp
from blueprints.admin_bp import admin_bp
from blueprints.editor_bp import editor_bp
from blueprints.robot_bp import robot_bp

# Auth
from auth import *
from pathlib import Path

# Database
DB_PATH = Path(__file__).parent / "static" / "db" / "auth.db"



app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['SECRET_KEY'] = token_hex(32)
app.register_blueprint(custom_code_bp)
app.register_blueprint(tutorial_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(editor_bp)
app.register_blueprint(robot_bp)

# Flask-Login 초기화
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = '로그인이 필요합니다.'
login_manager.login_message_category = 'info'

@login_manager.user_loader
def load_user(user_id):
    from auth import get_user_by_id, GuestUser
    if user_id == 'guest':
        return GuestUser()
    return get_user_by_id(user_id)


socketio = SocketIO(
    app,                                    # Flask 애플리케이션 인스턴스
    cors_allowed_origins="*",               # CORS 설정 - 모든 도메인 허용
    async_mode='threading',                 # 비동기 모드 - 스레딩 사용
    logger=False,                           # SocketIO 로거 비활성화
    engineio_logger=False,                  # Engine.IO 로거 비활성화
    ping_timeout=60,                        # 핑 타임아웃 60초
    ping_interval=25,                       # 핑 간격 25초
    transports=['websocket', 'polling'],    # 전송 방식 설정
    allow_upgrades=True
)

# 에디터 블루프린트 초기화
# 중앙 서버 상태 관리
running_threads: dict[str, threading.Thread] = {}           # 실행 중인 스레드를 추적하는 딕셔너리
stop_flags: dict[str, bool] = {}                            # 실행 중지 플래그를 추적하는 딕셔너리
gesture_states: dict[str, dict[str, dict[str, float]]] = {} # 제스처 최신 상태 저장: 세션별 → 위젯별
pid_states: dict[str, dict[str, dict[str, float]]] = {}     # PID 최신 값 저장: 세션별 → 위젯ID별 {p,i,d}
slider_states: dict[str, dict[str, list[float]]] = {}       # Slider 최신 값 저장: 세션별 → 위젯ID별 [values]

# 로봇 관리 시스템
registered_robots: dict[str, dict] = {}                      # 등록된 로봇 정보: robot_id → {name, url, status, last_seen}
user_robot_mapping: dict[str, str] = {}                      # 사용자 세션 → 로봇 ID 매핑
robot_heartbeats: dict[str, float] = {}                      # 로봇 하트비트: robot_id → timestamp

# 세션 관리 시스템
session_user_mapping: dict[str, dict] = {}                   # 세션 ID → 사용자 정보 매핑

from blueprints.editor_bp import init_editor_globals, register_socketio_handlers, execute_code_on_robot

# 전역 변수들을 에디터 블루프린트에 전달
init_editor_globals(globals())

# SocketIO 핸들러 등록 (editor_bp의 핸들러들은 app.py로 이동됨)
# register_socketio_handlers(socketio)

# 전역 변수들을 app.config에 저장 (blueprint에서 접근 가능하도록)
app.config['registered_robots'] = registered_robots
app.config['user_robot_mapping'] = user_robot_mapping
app.config['robot_heartbeats'] = robot_heartbeats
app.config['session_user_mapping'] = session_user_mapping
app.config['socketio'] = socketio




#- 페이지 목록 -#
# 1. index : 랜딩 페이지
# 2. main : 대시보드 페이지
# 3. editor : 에디터 페이지
# 4. tutorial : 튜토리얼 페이지
# 5. login : 로그인 페이지
# 6. register : 회원가입 페이지
# 7. admin : 관리자 페이지

@app.route('/')
def index():
    # 로그인하지 않은 사용자는 guest로 처리
    if not current_user.is_authenticated:
        from auth import GuestUser
        guest_user = GuestUser()
        return render_template('landing.html',
                               user_id=guest_user.id,
                               username=guest_user.username,
                               email=guest_user.email,
                               role=guest_user.role,
                               is_guest=True)
    else:
        return render_template('landing.html',
                               user_id=current_user.id,
                               username=current_user.username,
                               email=current_user.email,
                               role=current_user.role,
                               is_guest=False)

@app.route('/main')
@login_required
def main():
    if current_user.is_authenticated:
        return render_template('main.html',
                            user_id=current_user.id,
                            username=current_user.username,
                            email=current_user.email,
                            role=current_user.role)
    else:
        return redirect(url_for('index'))

@app.route('/login')
def login():
    if not current_user.is_authenticated:
        return render_template('login.html')
    return redirect(url_for('index'))

@app.route('/register')
def register():
    if not current_user.is_authenticated:
        return render_template('login.html')
    return redirect(url_for('index'))

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))


@app.route('/editor')
@login_required
def editor():
    """에디터 메인 페이지"""
    return render_template('index.html',
                         user_id=current_user.id,
                         username=current_user.username,
                         email=current_user.email,
                         role=current_user.role)


@app.route('/tutorial')
@login_required
def tutorial():
    return render_template('tutorial.html')

@app.route('/admin')
@login_required
def admin():
    """관리자 페이지 - 현재 접속한 사용자, 세션, 로봇 정보 표시"""
    return render_template('admin.html',
                         user_id=current_user.id,
                         username=current_user.username,
                         email=current_user.email,
                         role=current_user.role)

#region Authentication API
@app.route('/api/auth/login', methods=['POST'])
def api_login():
    """사용자 로그인"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({"error": "사용자명과 비밀번호를 입력해주세요."}), 400

        user = authenticate_user(username, password)
        if user:
            login_user(user)
            return jsonify({
                "success": True,
                "message": "로그인 성공",
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "role": user.role
                }
            })
        else:
            return jsonify({"error": "사용자명 또는 비밀번호가 올바르지 않습니다."}), 401

    except Exception as e:
        print(f"로그인 오류: {e}")
        return jsonify({"error": "로그인 중 오류가 발생했습니다."}), 500

@app.route('/api/auth/register', methods=['POST'])
def api_register():
    """사용자 회원가입"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        email = data.get('email')

        if not username or not password:
            return jsonify({"error": "사용자명과 비밀번호를 입력해주세요."}), 400

        if len(password) < 6:
            return jsonify({"error": "비밀번호는 6자 이상이어야 합니다."}), 400

        user = create_user(username, password, email)
        if user:
            return jsonify({
                "success": True,
                "message": "회원가입 성공"
            })
        else:
            return jsonify({"error": "이미 존재하는 사용자명입니다."}), 409

    except Exception as e:
        print(f"회원가입 오류: {e}")
        return jsonify({"error": "회원가입 중 오류가 발생했습니다."}), 500

@app.route('/api/auth/user', methods=['GET'])
@login_required
def api_get_user():
    """현재 사용자 정보 조회"""
    return jsonify({
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role
    })

@app.route('/api/auth/check', methods=['GET'])
def check_auth():
    """로그인 상태 확인 (로그인하지 않은 사용자도 접근 가능)"""
    if current_user.is_authenticated:
        return jsonify({
            'authenticated': True,
            'user': {
                'user_id': current_user.id,
                'username': current_user.username,
                'email': current_user.email,
                'role': current_user.role
            }
        })
    else:
        return jsonify({'authenticated': False})

@app.route('/api/sessions', methods=['GET'])
@login_required
def get_active_sessions():
    """활성 세션 목록 조회 (관리자만)"""
    if current_user.role != 'admin':
        return jsonify({"error": "관리자 권한이 필요합니다"}), 403

    sessions = []
    for sid, user_info in session_user_mapping.items():
        robot_id = user_robot_mapping.get(sid)
        sessions.append({
            "session_id": sid,
            "user": user_info,
            "assigned_robot": robot_id,
            "robot_online": robot_id in registered_robots if robot_id else False
        })

    return jsonify(sessions)



#region SocketIO connect/disconnect
@socketio.on('connect')
def handle_connect():
    print('클라이언트가 연결되었습니다.')

    # 사용자가 로그인되어 있는 경우
    if current_user.is_authenticated:
        try:
            # 세션-사용자 매핑 저장
            session_user_mapping[request.sid] = {
                'user_id': current_user.id,
                'username': current_user.username,
                'email': current_user.email,
                'role': current_user.role
            }
            print(f"세션 {request.sid}에 사용자 {current_user.username} (ID: {current_user.id}) 매핑")

            # 자동 할당 비활성화 - 사용자가 직접 선택하도록 함
            print(f"사용자 {current_user.username}의 로봇 할당은 에디터에서 직접 선택해야 합니다.")
        except Exception as e:
            print(f"사용자 로봇 매핑 오류: {e}")
    else:
        print(f"세션 {request.sid}에 로그인되지 않은 사용자 연결")

    emit('connected', {'message': '서버에 연결되었습니다.'})

#region Editor SocketIO Handlers
@socketio.on('execute_code')
def handle_execute_code(data):
    try:
        code = data.get('code', '')
        if not code:
            emit('execution_error', {'error': '코드가 제공되지 않았습니다.'})
            return

        # 현재 세션 ID 가져오기
        sid = request.sid

        # 현재 사용자 정보 가져오기
        user_info = session_user_mapping.get(sid, {})
        user_id = user_info.get('user_id')
        username = user_info.get('username', 'Unknown')

        print(f"사용자 {username} (ID: {user_id})이 코드 실행을 요청했습니다.")

        # 할당된 로봇 확인
        robot_id = user_robot_mapping.get(sid)
        if not robot_id:
            emit('execution_error', {'error': '로봇이 할당되지 않았습니다. 먼저 로봇을 선택하세요.'})
            return

        # 로봇에 코드 실행 요청 전송 (사용자 정보 포함)
        result = execute_code_on_robot(code, sid, robot_id, user_info)
        
        # 결과 처리
        if 'error' in result:
            emit('execution_error', {'error': result['error']})
        elif result.get('type') == 'socketio':
            # SocketIO로 전송
            robot_session_id = result['robot_session_id']
            socketio.emit('execute_code', {
                'code': result['code'],
                'session_id': result['session_id'],
                'user_info': result['user_info']
            }, room=robot_session_id)
            socketio.emit('execution_started', {
                'message': f'로봇 {result["robot_name"]}에서 코드 실행을 시작합니다...'
            }, room=sid)
        elif result.get('success'):
            emit('execution_started', {'message': result['message']})

    except Exception as e:
        emit('execution_error', {'error': f'코드 실행 중 오류가 발생했습니다: {str(e)}'})

@socketio.on('stop_execution')
def handle_stop_execution():
    """실행 중인 코드를 중지"""
    try:
        sid = request.sid
        thread = running_threads.get(sid, None)

        if thread is None:
            emit('execution_error', {'error': '실행 중인 코드가 없습니다.'})
            return

        # 1단계: 중지 플래그 설정 (안전한 종료 시도)
        stop_flags[sid] = True

        if thread.is_alive():
            # 안전하게 스레드에 예외를 주입하는 헬퍼 (라즈베리파이 포함 호환)
            def raise_in_thread(thread, exc_type = SystemExit):
                import ctypes
                if thread is None or not thread.is_alive():
                    return False

                func = ctypes.pythonapi.PyThreadState_SetAsyncExc
                func.argtypes = [ctypes.c_ulong, ctypes.py_object]
                func.restype = ctypes.c_int

                tid = ctypes.c_ulong(thread.ident)
                res = func(tid, ctypes.py_object(exc_type))

                if res > 1:
                    func(tid, ctypes.py_object(0))
                    return False

                return res == 1
            # 강제 종료 실행 (안전 헬퍼 사용)
            ok = raise_in_thread(thread, SystemExit)

            thread.join(timeout=2.0)  # 2초 대기

            if thread.is_alive():
                print(f"DEBUG: 강제 종료 후에도 스레드가 살아있음")
                emit('execution_stopped', {
                    'message': '코드 실행 중지 요청이 완료되었습니다.',
                    'warning': '스레드가 완전히 종료되지 않았을 수 있습니다.'
                })
            else:
                print(f"DEBUG: 강제 종료 성공")
                emit('execution_stopped', {'message': '코드 실행이 중지되었습니다.'})
        else:
            emit('execution_stopped', {'message': '코드 실행이 중지되었습니다.'})

        # 최종 정리: 스레드가 실제로 종료된 경우에만 정리 (그 외에는 execute_code()의 finally에 위임)
        try:
            if not thread.is_alive():
                running_threads.pop(sid, None)
                stop_flags.pop(sid, None)
        except Exception:
            pass

    except Exception as e:
        print(f"DEBUG: 스레드 중지 중 오류: {str(e)}")
        emit('execution_error', {'error': f'코드 중지 중 오류가 발생했습니다: {str(e)}'})

@socketio.on('gesture_update')
def handle_gesture_update(data):
    sid = request.sid
    data = data.get('data')
    if data:
        gesture_states[sid] = data

@socketio.on('pid_update')
def handle_pid_update(payload):
    sid = request.sid
    try:
        widget_id = payload.get('widget_id')
        p = float(payload.get('p', 0.0))
        i = float(payload.get('i', 0.0))
        d = float(payload.get('d', 0.0))
    except Exception:
        return
    if not widget_id:
        return
    session_map = pid_states.get(sid)
    if session_map is None:
        session_map = {}
        pid_states[sid] = session_map
    session_map[widget_id] = {'p': p, 'i': i, 'd': d}

@socketio.on('slider_update')
def handle_slider_update(payload):
    sid = request.sid
    try:
        widget_id = payload.get('widget_id')
        values = payload.get('values')
    except Exception:
        return
    if not widget_id:
        return
    session_map = gesture_states.get(sid)
    if session_map is None:
        session_map = {}
        gesture_states[sid] = session_map
    session_map[widget_id] = values

@socketio.on('robot_emit_image')
def handle_robot_emit_image(data):
    try:
        session_id = data.get('session_id')
        image_data = data.get('image_data')
        widget_id = data.get('widget_id')

        if not all([session_id, image_data, widget_id]):
            return

        # 브라우저로 이미지 데이터 중계
        socketio.emit('image_data', {
            'i': image_data,
            'w': widget_id
        }, room=session_id)

    except Exception as e:
        print(f"로봇 이미지 데이터 중계 오류: {e}")

@socketio.on('robot_emit_text')
def handle_robot_emit_text(data):
    try:
        session_id = data.get('session_id')
        text = data.get('text')
        widget_id = data.get('widget_id')

        if not all([session_id, text, widget_id]):
            return

        # 브라우저로 텍스트 데이터 중계
        socketio.emit('text_data', {
            'text': text,
            'widget_id': widget_id
        }, room=session_id)

    except Exception as e:
        print(f"로봇 텍스트 데이터 중계 오류: {e}")

@socketio.on('robot_stdout')
def handle_robot_stdout(data):
    try:
        session_id = data.get('session_id')
        output = data.get('output')

        if not all([session_id, output]):
            return

        # 브라우저로 stdout 데이터 중계
        socketio.emit('stdout', {'output': output}, room=session_id)

    except Exception as e:
        print(f"로봇 stdout 데이터 중계 오류: {e}")

@socketio.on('robot_stderr')
def handle_robot_stderr(data):
    try:
        session_id = data.get('session_id')
        output = data.get('output')

        if not all([session_id, output]):
            return

        # 브라우저로 stderr 데이터 중계
        socketio.emit('stderr', {'output': output}, room=session_id)

    except Exception as e:
        print(f"로봇 stderr 데이터 중계 오류: {e}")

@socketio.on('robot_finished')
def handle_robot_finished(data):
    try:
        session_id = data.get('session_id')
        output = data.get('output', '실행 완료')

        if not session_id:
            return

        # 브라우저로 finished 데이터 중계
        socketio.emit('finished', {'output': output}, room=session_id)

    except Exception as e:
        print(f"로봇 finished 데이터 중계 오류: {e}")
#endregion

@socketio.on('disconnect')
def handle_disconnect():
    print('클라이언트가 연결을 해제했습니다.')

    # 연결 해제 시 실행 중인 스레드 정리
    sid = request.sid

    # 세션-사용자 매핑 정리
    if sid in session_user_mapping:
        user_info = session_user_mapping.pop(sid)
        print(f"세션 {sid}에서 사용자 {user_info['username']} (ID: {user_info['user_id']}) 매핑 제거")

    # 세션-로봇 매핑 정리
    if sid in user_robot_mapping:
        robot_id = user_robot_mapping.pop(sid)
        print(f"세션 {sid}에서 로봇 {robot_id} 매핑 제거")

    # 메인 프로세스 스레드 정리
    if sid in running_threads:
        try:
            stop_flags[sid] = True
            running_threads.pop(sid, None)
            stop_flags.pop(sid, None)
        except Exception:
            pass
#endregion


#region Robot Client SocketIO Events
@socketio.on('robot_connected')
def handle_robot_connected(data):
    """로봇 클라이언트 연결 처리"""
    try:
        robot_id = data.get('robot_id')
        robot_name = data.get('robot_name')
        hardware_enabled = data.get('hardware_enabled', False)

        print(f"🤖 로봇 클라이언트 연결됨: {robot_name} (ID: {robot_id})")

        # 로봇 등록 (SocketIO 연결 시)
        registered_robots[robot_id] = {
            "name": robot_name,
            "url": None,  # SocketIO 연결이므로 URL 불필요
            "status": "online",
            "hardware_enabled": hardware_enabled,
            "connected_at": datetime.now().isoformat(),
            "session_id": request.sid  # 로봇 클라이언트의 세션 ID 저장
        }

        # 하트비트 초기화
        robot_heartbeats[robot_id] = time.time()

        # 연결 확인 응답
        emit('robot_registered', {
            'success': True,
            'message': f'로봇 {robot_name}이 등록되었습니다',
            'robot_id': robot_id
        })

    except Exception as e:
        print(f"로봇 연결 처리 오류: {e}")
        emit('robot_registered', {
            'success': False,
            'error': str(e)
        })

@socketio.on('robot_disconnected')
def handle_robot_disconnected(data):
    """로봇 클라이언트 연결 해제 처리"""
    try:
        robot_id = data.get('robot_id')
        if robot_id in registered_robots:
            print(f"🤖 로봇 클라이언트 연결 해제됨: {robot_id}")
            registered_robots[robot_id]['status'] = 'offline'
            # 세션 ID 정리
            registered_robots[robot_id].pop('session_id', None)

            # 해당 로봇을 사용하는 사용자 세션 정리
            sessions_to_remove = [sid for sid, rid in user_robot_mapping.items() if rid == robot_id]
            for sid in sessions_to_remove:
                user_robot_mapping.pop(sid, None)
                print(f"사용자 세션 {sid}에서 로봇 {robot_id} 할당 해제")

    except Exception as e:
        print(f"로봇 연결 해제 처리 오류: {e}")

@socketio.on('robot_heartbeat')
def handle_robot_heartbeat(data):
    """로봇 하트비트 처리"""
    try:
        robot_id = data.get('robot_id')
        status = data.get('status', 'online')

        if robot_id in registered_robots:
            robot_heartbeats[robot_id] = time.time()
            registered_robots[robot_id]['status'] = status
            registered_robots[robot_id]['last_seen'] = datetime.now().isoformat()

    except Exception as e:
        print(f"로봇 하트비트 처리 오류: {e}")












if __name__ == '__main__':
    socketio.run(app, debug=False, host='0.0.0.0', allow_unsafe_werkzeug=True, port=5000)