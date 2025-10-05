# Editor Blueprint
# 에디터 관련 기능들을 관리하는 블루프린트

from flask import Blueprint, render_template, request, jsonify, redirect, url_for
from flask_socketio import emit
from flask_login import login_required, current_user
import threading
import time
import requests
import io
import contextlib
from datetime import datetime

# 블루프린트 생성
editor_bp = Blueprint('editor', __name__, url_prefix='/editor')

# 전역 변수들 (app.py에서 가져올 예정)
running_threads = {}
stop_flags = {}
session_user_mapping = {}
user_robot_mapping = {}
registered_robots = {}
robot_heartbeats = {}
pid_states = {}
gesture_states = {}
slider_states = {}

def init_editor_globals(app_globals):
    """app.py의 전역 변수들을 초기화"""
    global running_threads, stop_flags, session_user_mapping
    global user_robot_mapping, registered_robots, robot_heartbeats
    global pid_states, gesture_states, slider_states

    running_threads = app_globals.get('running_threads', {})
    stop_flags = app_globals.get('stop_flags', {})
    session_user_mapping = app_globals.get('session_user_mapping', {})
    user_robot_mapping = app_globals.get('user_robot_mapping', {})
    registered_robots = app_globals.get('registered_robots', {})
    robot_heartbeats = app_globals.get('robot_heartbeats', {})
    pid_states = app_globals.get('pid_states', {})
    gesture_states = app_globals.get('gesture_states', {})
    slider_states = app_globals.get('slider_states', {})


#region Code Execution Functions
def execute_code_on_robot(code: str, sid: str, robot_id: str, user_info: dict = None):
    """로봇에 코드 실행 요청 전송"""
    try:
        # 할당된 로봇 확인
        if robot_id not in registered_robots:
            from flask_socketio import socketio
            socketio.emit('execution_error', {'error': '할당된 로봇을 찾을 수 없습니다.'}, room=sid)
            return

        robot_info = registered_robots[robot_id]

        # 사용자 정보 준비
        user_data = {
            'user_id': user_info.get('user_id') if user_info else None,
            'username': user_info.get('username', 'Unknown') if user_info else 'Unknown',
            'email': user_info.get('email') if user_info else None,
            'role': user_info.get('role', 'user') if user_info else 'user'
        }

        # SocketIO 연결된 로봇인지 확인
        if robot_info.get('url') is None:
            # SocketIO로 직접 전송 (로봇 클라이언트의 세션 ID 사용)
            from flask_socketio import socketio
            robot_session_id = robot_info.get('session_id')
            if robot_session_id:
                socketio.emit('execute_code', {
                    'code': code,
                    'session_id': sid,
                    'user_info': user_data
                }, room=robot_session_id)
                socketio.emit('execution_started', {
                    'message': f'로봇 {robot_info.get("name", robot_id)}에서 코드 실행을 시작합니다...'
                }, room=sid)
            else:
                socketio.emit('execution_error', {'error': '로봇 클라이언트의 세션 ID를 찾을 수 없습니다.'}, room=sid)
        else:
            # HTTP 요청으로 전송 (기존 방식)
            robot_url = robot_info.get('url')
            response = requests.post(
                f"{robot_url}/execute",
                json={'code': code, 'session_id': sid, 'user_info': user_data},
                timeout=30
            )
            if response.status_code == 200:
                socketio.emit('execution_started', {'message': f'로봇 {robot_id}에서 코드 실행을 시작합니다...'}, room=sid)
            else:
                socketio.emit('execution_error', {'error': f'로봇 실행 요청 실패: {response.text}'}, room=sid)

    except requests.exceptions.RequestException as e:
        from flask_socketio import socketio
        socketio.emit('execution_error', {'error': f'로봇 통신 오류: {str(e)}'}, room=sid)
    except Exception as e:
        from flask_socketio import socketio
        socketio.emit('execution_error', {'error': f'코드 실행 중 오류가 발생했습니다: {str(e)}'}, room=sid)

def relay_image_data(data: dict, session_id: str):
    """로봇에서 받은 이미지 데이터를 브라우저로 중계"""
    try:
        from flask_socketio import socketio
        socketio.emit('image_data', data, room=session_id)
    except Exception as e:
        print(f"DEBUG: 이미지 데이터 중계 실패: {e}")

def relay_text_data(data: dict, session_id: str):
    """로봇에서 받은 텍스트 데이터를 브라우저로 중계"""
    try:
        from flask_socketio import socketio
        socketio.emit('text_data', data, room=session_id)
    except Exception as e:
        print(f"DEBUG: 텍스트 데이터 중계 실패: {e}")

def relay_stdout_data(data: dict, session_id: str):
    """로봇에서 받은 stdout 데이터를 브라우저로 중계"""
    try:
        from flask_socketio import socketio
        socketio.emit('stdout', data, room=session_id)
    except Exception as e:
        print(f"DEBUG: stdout 데이터 중계 실패: {e}")

def relay_stderr_data(data: dict, session_id: str):
    """로봇에서 받은 stderr 데이터를 브라우저로 중계"""
    try:
        from flask_socketio import socketio
        socketio.emit('stderr', data, room=session_id)
    except Exception as e:
        print(f"DEBUG: stderr 데이터 중계 실패: {e}")

def relay_finished_data(data: dict, session_id: str):
    """로봇에서 받은 finished 데이터를 브라우저로 중계"""
    try:
        from flask_socketio import socketio
        socketio.emit('finished', data, room=session_id)
    except Exception as e:
        print(f"DEBUG: finished 데이터 중계 실패: {e}")
#endregion

#region SocketIO Event Handlers
def register_socketio_handlers(socketio):
    """SocketIO 이벤트 핸들러 등록"""

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
            execute_code_on_robot(code, sid, robot_id, user_info)

        except Exception as e:
            emit('execution_error', {'error': f'코드 실행 중 오류가 발생했습니다: {str(e)}'})

    @socketio.on('stop_execution')
    def handle_stop_execution():
        """실행 중인 코드를 중지"""
        try:
            sid = request.sid
            thread = running_threads.get(sid, None)

            if thread is None:
                socketio.emit('execution_error', {'error': '실행 중인 코드가 없습니다.'}, room=sid)
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
                    socketio.emit('execution_stopped', {
                        'message': '코드 실행 중지 요청이 완료되었습니다.',
                        'warning': '스레드가 완전히 종료되지 않았을 수 있습니다.'
                    }, room=sid)
                else:
                    print(f"DEBUG: 강제 종료 성공")
                    socketio.emit('execution_stopped', {'message': '코드 실행이 중지되었습니다.'}, room=sid)
            else:
                socketio.emit('execution_stopped', {'message': '코드 실행이 중지되었습니다.'}, room=sid)

            # 최종 정리: 스레드가 실제로 종료된 경우에만 정리 (그 외에는 execute_code()의 finally에 위임)
            try:
                if not thread.is_alive():
                    running_threads.pop(sid, None)
                    stop_flags.pop(sid, None)
            except Exception:
                pass

        except Exception as e:
            print(f"DEBUG: 스레드 중지 중 오류: {str(e)}")
            socketio.emit('execution_error', {'error': f'코드 중지 중 오류가 발생했습니다: {str(e)}'})

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
            relay_image_data({
                'i': image_data,
                'w': widget_id
            }, session_id)

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
            relay_text_data({
                'text': text,
                'widget_id': widget_id
            }, session_id)

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
            relay_stdout_data({'output': output}, session_id)

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
            relay_stderr_data({'output': output}, session_id)

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
            relay_finished_data({'output': output}, session_id)

        except Exception as e:
            print(f"로봇 finished 데이터 중계 오류: {e}")
#endregion
