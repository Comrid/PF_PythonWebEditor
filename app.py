from __future__ import annotations
from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_socketio import SocketIO, emit
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from secrets import token_hex

import time
from datetime import datetime
from functools import wraps

# Blueprints
from blueprints.custom_code_bp import custom_code_bp
from blueprints.tutorial_bp import tutorial_bp
from blueprints.admin_bp import admin_bp
from blueprints.robot_bp import robot_bp
from blueprints.auth_bp import auth_bp

# Auth
from auth import *
from pathlib import Path

# DB 경로
DB_PATH = Path(__file__).parent / "static" / "db" / "auth.db"

# Flask 앱 초기화
app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['SECRET_KEY'] = token_hex(32)
app.register_blueprint(custom_code_bp)
app.register_blueprint(tutorial_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(robot_bp)
app.register_blueprint(auth_bp)

# Flask-Login 초기화
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = '로그인이 필요합니다.'
login_manager.login_message_category = 'info'

@login_manager.user_loader
def load_user(user_id):
    from auth import get_user, GuestUser
    if user_id == 'guest':
        return GuestUser()
    return get_user(user_id, by='id')


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

# 로봇 관리 시스템
registered_robots: dict[str, dict] = {}
"""
    "robot_123": {
        "name": "tbot",                    # 로봇 이름
        "status": "online",                # 상태: "online", "offline", "updating"
        "hardware_enabled": True,          # 하드웨어 활성화 여부
        "robot_version": "1.0.3",          # 로봇 버전
        "needs_update": False,             # 업데이트 필요 여부
        "connected_at": "2024-01-01T12:00:00",  # 연결 시간
        "last_heartbeat": 1717334700.0,    # 마지막 하트비트 시간 (Unix timestamp)
        "session_id": "socket_session_456"      # 로봇의 SocketIO 세션 ID
    }
"""
# 통합된 세션 관리 시스템
integrated_mapping: dict[str, dict] = {}
"""
    "socket_session_789": {
        "user_id": 123,
        "username": "john_doe",
        "email": "john@example.com",
        "role": "user",
        "assigned_robot": "robot_123"  # 할당된 로봇 ID (없으면 None)
    }
"""

# 로봇 버전 관리
LATEST_ROBOT_VERSION = "1.1.2"  # 최신 로봇 버전


# 전역 변수들을 app.config에 저장 (blueprint에서 접근 가능하도록)
app.config['registered_robots'] = registered_robots
app.config['integrated_mapping'] = integrated_mapping
app.config['socketio'] = socketio

#- 페이지 목록 -#
# 1. index : 랜딩 페이지
# 2. main : 대시보드 페이지
# 3. editor : 에디터 페이지
# 4. tutorial : 튜토리얼 페이지
# 5. login : 로그인 페이지
# 6. register : 회원가입 페이지
# 7. admin : 관리자 페이지
#region 페이지 라우팅 목록
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
#endregion






@app.route('/api/sessions', methods=['GET'])
@login_required
def get_active_sessions():
    """활성 세션 목록 조회 (관리자만)"""
    if current_user.role != 'admin':
        return jsonify({"error": "관리자 권한이 필요합니다"}), 403

    sessions = []
    for sid, session_data in integrated_mapping.items():
        user_info = {k: v for k, v in session_data.items() if k != "assigned_robot"}
        robot_id = session_data.get("assigned_robot")
        sessions.append({
            "session_id": sid,
            "user": user_info,
            "assigned_robot": robot_id,
            "robot_online": robot_id in registered_robots if robot_id else False
        })

    return jsonify(sessions)






#region 웹 접속 관리
@socketio.on('connect') # 웹 > 서버
def handle_connect():
    print('웹 접속 인원 발생')

    if current_user.is_authenticated:
        try:
            integrated_mapping[request.sid] = {
                'user_id': current_user.id,
                'username': current_user.username,
                'email': current_user.email,
                'role': current_user.role,
                'assigned_robot': None  # 초기에는 로봇 할당 없음
            }
            print(f"세션 : {request.sid} 사용자 : {current_user.username} (ID: {current_user.id}) 매핑")
        except Exception as e:
            print(f"사용자 매핑 오류: {e}")
    else:
        print(f"세션 {request.sid}에 로그인되지 않은 사용자 연결")
    emit('connected', {'message': '서버에 연결되었습니다.'}) # 서버 > 웹

@socketio.on('disconnect')
def handle_disconnect():
    print('웹 접속 인원 해제')

    sid = request.sid

    # 통합된 세션 매핑 정리
    if sid in integrated_mapping:
        session_data = integrated_mapping.pop(sid)
        user_info = {k: v for k, v in session_data.items() if k != "assigned_robot"}
        robot_id = session_data.get("assigned_robot")

        print(f"세션 {sid}에서 사용자 {user_info['username']} (ID: {user_info['user_id']}) 매핑 제거")

        # 로봇이 사용자에게 할당된 경우, 로봇 상태를 오프라인으로 변경
        if robot_id and robot_id in registered_robots:
            print(f"🤖 사용자 세션에서 로봇 {robot_id} 할당 해제됨")
            # 로봇의 session_id는 제거하지 않음 (로봇이 직접 연결 해제할 때만 제거)
            # registered_robots[robot_id]['status'] = 'offline'  # 로봇은 여전히 연결되어 있을 수 있음

            # 데이터베이스에서 로봇 할당 비활성화
            from auth import deactivate_robot_assignment
            deactivate_robot_assignment(robot_id)
            print(f"데이터베이스에서 로봇 {robot_id} 할당 비활성화")
#endregion

#region 로봇 코드 실행 + 출력
@socketio.on('execute_code') # 웹 > 서버 > 로봇
def handle_execute_code(data):
    try:
        code = data.get('code', '')
        if not code:
            emit('execution_error', {'error': '코드가 제공되지 않았습니다.'})
            return

        sid = request.sid

        # 로봇 할당 확인
        session_data = integrated_mapping.get(sid, {})
        robot_id = session_data.get("assigned_robot")
        if not robot_id or robot_id not in registered_robots:
            emit('execution_error', {'error': '로봇이 할당되지 않았습니다. 먼저 로봇을 선택하세요.'})
            return

        # 로봇 세션 ID 확인
        robot_session_id = registered_robots[robot_id].get('session_id')
        if not robot_session_id:
            emit('execution_error', {'error': '로봇 클라이언트의 세션 ID를 찾을 수 없습니다. 로봇이 연결되지 않았거나 재연결이 필요합니다.'})
            return

        socketio.emit('execute_code', {'code': code, 'session_id': sid}, room=robot_session_id)
        emit('execution_started', {'message': f'로봇 {registered_robots[robot_id].get("name", robot_id)}에서 코드 실행을 시작합니다...'})

    except Exception as e:
        emit('execution_error', {'error': f'코드 실행 중 오류가 발생했습니다: {str(e)}'})

@socketio.on('stop_execution')
def handle_stop_execution():
    try:
        sid = request.sid

        # 로봇 할당 확인
        session_data = integrated_mapping.get(sid, {})
        robot_id = session_data.get("assigned_robot")
        if not robot_id or robot_id not in registered_robots:
            emit('execution_error', {'error': '로봇이 할당되지 않았습니다. 먼저 로봇을 선택하세요.'})
            return

        # 로봇 세션 ID 확인
        robot_session_id = registered_robots[robot_id].get('session_id')
        if not robot_session_id:
            emit('execution_error', {'error': '로봇 클라이언트의 세션 ID를 찾을 수 없습니다. 로봇이 연결되지 않았거나 재연결이 필요합니다.'})
            return

        socketio.emit('stop_execution', {'session_id': sid}, room=robot_session_id)
        emit('execution_stopped', {'message': '코드 중지 요청을 로봇에 전달했습니다.'})

    except Exception as e:
        print(f"DEBUG: 코드 중지 요청 중 오류: {str(e)}")
        emit('execution_error', {'error': f'코드 중지 요청 중 오류가 발생했습니다: {str(e)}'})

@socketio.on('robot_finished')
def handle_robot_finished(data):
    try:
        session_id = data.get('session_id')
        if not session_id: return
        socketio.emit('finished', {'output': '실행 완료'}, room=session_id)
    except Exception as e:
        print(f"로봇 finished 데이터 중계 오류: {e}")

@socketio.on('robot_stdout')
def handle_robot_stdout(data):
    try:
        session_id = data.get('session_id')
        output = data.get('output')
        if not all([session_id, output]):
            return
        socketio.emit('stdout', {'output': output}, room=session_id)
    except Exception as e:
        print(f"Robot stdout data relay error: {e}")

@socketio.on('robot_stderr')
def handle_robot_stderr(data):
    try:
        session_id = data.get('session_id')
        output = data.get('output')
        if not all([session_id, output]):
            return
        socketio.emit('stderr', {'output': output}, room=session_id)
    except Exception as e:
        print(f"Robot stderr data relay error: {e}")
#endregion

#region 로봇 커스텀 함수 관리
@socketio.on('gesture_update')
def handle_gesture_update(data):
    """제스처 업데이트 데이터를 로봇에 직접 전달"""
    try:
        sid = request.sid
        gesture_data = data.get('data')

        if not gesture_data:
            return

        # 로봇 할당 확인
        session_data = integrated_mapping.get(sid, {})
        robot_id = session_data.get("assigned_robot")
        if not robot_id or robot_id not in registered_robots:
            print(f"세션 {sid}: 로봇이 할당되지 않음")
            return

        # 로봇 세션 ID 확인
        robot_session_id = registered_robots[robot_id].get('session_id')
        if not robot_session_id:
            print(f"로봇 {robot_id}: 세션 ID를 찾을 수 없음")
            return

        # 로봇에 직접 전달
        socketio.emit('gesture_update', {
            'data': gesture_data,
            'session_id': sid
        }, room=robot_session_id)

    except Exception as e:
        print(f"제스처 업데이트 전달 오류: {e}")

@socketio.on('pid_update')
def handle_pid_update(payload):
    """PID 업데이트 데이터를 로봇에 직접 전달"""
    try:
        sid = request.sid

        # 데이터 검증
        widget_id = payload.get('widget_id')
        if not widget_id:
            print(f"세션 {sid}: widget_id가 없음")
            return

        try:
            p = float(payload.get('p', 0.0))
            i = float(payload.get('i', 0.0))
            d = float(payload.get('d', 0.0))
        except (ValueError, TypeError) as e:
            print(f"세션 {sid}: PID 값 변환 오류: {e}")
            return

        # 로봇 할당 확인
        session_data = integrated_mapping.get(sid, {})
        robot_id = session_data.get("assigned_robot")
        if not robot_id or robot_id not in registered_robots:
            print(f"세션 {sid}: 로봇이 할당되지 않음")
            return

        # 로봇 세션 ID 확인
        robot_session_id = registered_robots[robot_id].get('session_id')
        if not robot_session_id:
            print(f"로봇 {robot_id}: 세션 ID를 찾을 수 없음")
            return

        # 로봇에 직접 전달
        socketio.emit('pid_update', {
            'widget_id': widget_id,
            'p': p,
            'i': i,
            'd': d,
            'session_id': sid
        }, room=robot_session_id)

    except Exception as e:
        print(f"PID 업데이트 전달 오류: {e}")

@socketio.on('slider_update')
def handle_slider_update(payload):
    """슬라이더 업데이트 데이터를 로봇에 직접 전달"""
    try:
        sid = request.sid

        # 데이터 검증
        widget_id = payload.get('widget_id')
        if not widget_id:
            print(f"세션 {sid}: widget_id가 없음")
            return

        values = payload.get('values')
        if not isinstance(values, list):
            print(f"세션 {sid}: values가 리스트가 아님")
            return

        # 로봇 할당 확인
        session_data = integrated_mapping.get(sid, {})
        robot_id = session_data.get("assigned_robot")
        if not robot_id or robot_id not in registered_robots:
            print(f"세션 {sid}: 로봇이 할당되지 않음")
            return

        # 로봇 세션 ID 확인
        robot_session_id = registered_robots[robot_id].get('session_id')
        if not robot_session_id:
            print(f"로봇 {robot_id}: 세션 ID를 찾을 수 없음")
            return

        # 로봇에 직접 전달
        socketio.emit('slider_update', {
            'widget_id': widget_id,
            'values': values,
            'session_id': sid
        }, room=robot_session_id)

    except Exception as e:
        print(f"슬라이더 업데이트 전달 오류: {e}")

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
#endregion

#region 로봇 연결 관리
@socketio.on('robot_heartbeat')
def handle_robot_heartbeat(data):
    """로봇 하트비트 처리"""
    try:
        robot_id = data.get('robot_id')
        if robot_id in registered_robots:
            registered_robots[robot_id]['last_heartbeat'] = time.time()
            registered_robots[robot_id]['status'] = 'online'
    except Exception as e:
        print(f"로봇 하트비트 처리 오류: {e}")

@socketio.on('robot_connected') # 서버 < 로봇
def handle_robot_connected(data):
    try:
        robot_id = data.get('robot_id')
        robot_name = data.get('robot_name')
        hardware_enabled = data.get('hardware_enabled', False)
        robot_version = data.get('robot_version', '1.0.0')
        print(f"🤖 로봇 연결: {robot_name} (ID: {robot_id}, 버전: {robot_version})")

        # 데이터베이스에서 로봇 중복 등록 확인
        from auth import is_robot_exist, append_robot_to_db

        # 중복 등록이 아닌 경우에만 데이터베이스에 등록
        if not is_robot_exist(robot_id):
            db_success = append_robot_to_db(robot_id, robot_name)
            if not db_success:
                print(f"⚠️ 로봇 데이터베이스 등록 실패: {robot_name} (ID: {robot_id})")
        else:
            print(f"ℹ️ 로봇이 이미 등록되어 있음: {robot_name} (ID: {robot_id}) - 데이터베이스 등록 건너뜀")

        # 버전 비교
        needs_update = robot_version < LATEST_ROBOT_VERSION

        registered_robots[robot_id] = {
            "name": robot_name,
            "status": "online",
            "hardware_enabled": hardware_enabled,
            "robot_version": robot_version,
            "needs_update": needs_update,
            "connected_at": datetime.now().isoformat(),
            "last_heartbeat": time.time(),
            "session_id": request.sid  # 로봇 클라이언트의 세션 ID 저장
        }

        emit('robot_registered', {
            'success': True,
            'message': f'로봇 {robot_name}이 등록되었습니다',
            'needs_update': needs_update,
            'current_version': robot_version,
            'latest_version': LATEST_ROBOT_VERSION
        })
    except Exception as e:
        print(f"로봇 연결 처리 오류: {e}")
        emit('robot_registered', {
            'success': False,
            'error': str(e)
        })
#endregion

#region 로봇 업데이트 관리
@socketio.on('client_update')
def handle_client_update(data):
    try:
        robot_id = data.get('robot_id')
        if not robot_id or robot_id not in registered_robots:
            emit('update_error', {'error': '로봇이 등록되지 않았습니다.'})
            return

        # 로봇 세션 ID 확인
        robot_session_id = registered_robots[robot_id].get('session_id')
        if not robot_session_id:
            emit('update_error', {'error': '로봇 클라이언트의 세션 ID를 찾을 수 없습니다. 로봇이 연결되지 않았거나 재연결이 필요합니다.'})
            return

        # 로봇 상태를 업데이트 중으로 변경
        registered_robots[robot_id]['status'] = 'updating'

        # 웹 클라이언트에게 업데이트 시작 알림
        emit('client_update', {'message': f'로봇 {registered_robots[robot_id].get("name", robot_id)}에서 업데이트 및 재시작을 시작합니다...'})

        # 로봇 클라이언트로 업데이트 명령 전달
        socketio.emit('client_update', {
            'robot_id': robot_id,
            'message': '서버에서 업데이트 명령을 받았습니다.'
        }, room=robot_session_id)

        print(f"🤖 로봇 {robot_id}에 업데이트 명령 전달 완료")

    except Exception as e:
        print(f"로봇 업데이트 및 재시작 처리 오류: {e}")
        emit('update_error', {'error': f'업데이트 처리 중 오류가 발생했습니다: {str(e)}'})
#endregion

if __name__ == '__main__':
    import logging
    logging.getLogger('werkzeug').setLevel(logging.WARNING)
    socketio.run(app, debug=False, host='0.0.0.0', allow_unsafe_werkzeug=True, port=5000, log_output=False)
