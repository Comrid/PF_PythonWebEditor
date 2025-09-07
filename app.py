#TODO 단일 세션

from __future__ import annotations
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
from secrets import token_hex
import psutil
import os
import json

from blueprints.custom_code_bp import custom_code_bp
from blueprints.tutorial_bp import tutorial_bp

import threading
from traceback import format_exc

import platform
if platform.system() == "Linux":
    from findee import Findee
    DEBUG_MODE = False
else:
    Findee = None
    DEBUG_MODE = True

# AI-Chat은 JavaScript에서 직접 처리됩니다 (llm.js 사용)


app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['SECRET_KEY'] = token_hex(32)
app.register_blueprint(custom_code_bp)
app.register_blueprint(tutorial_bp)


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

# 세션별 - 위젯별 상태 저장
running_threads: dict[str, threading.Thread] = {}           # 실행 중인 스레드를 추적하는 딕셔너리 (메인 프로세스용)
stop_flags: dict[str, bool] = {}                            # 실행 중지 플래그를 추적하는 딕셔너리
gesture_states: dict[str, dict[str, dict[str, float]]] = {} # 제스처 최신 상태 저장: 세션별 → 위젯별
pid_states: dict[str, dict[str, dict[str, float]]] = {}     # PID 최신 값 저장: 세션별 → 위젯ID별 {p,i,d}
slider_states: dict[str, dict[str, list[float]]] = {}       # Slider 최신 값 저장: 세션별 → 위젯ID별 [values]






@app.route('/')
def index():
    return render_template('index.html')

#region Code Execution
def execute_code(code: str, sid: str):
    stop_flags[sid] = False

    # decorator
    def check_stop_flag(func):
        def wrapper(*args, **kwargs):
            if stop_flags.get(sid, False): return
            return func(*args, **kwargs)
        return wrapper

    @check_stop_flag
    def realtime_print(*args, **kwargs):
        output = ' '.join(str(arg) for arg in args)
        if output:
            socketio.emit('stdout', {'output': output}, room=sid)

    try:
        @check_stop_flag
        def emit_image(image, widget_id):
            debug_on = True
            if debug_on: print(f"DEBUG: emit_image 호출됨 : {widget_id}")
            if hasattr(image, 'shape'):  # numpy 배열인지 확인
                import time
                import cv2
                start_time = time.time()

                ok, buffer = cv2.imencode('.jpg', image, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
                if not ok:
                    if debug_on: print("DEBUG: JPEG 인코딩 실패")
                    return

                # socketio.emit() 사용 - 바이너리 첨부 전송
                socketio.emit('image_data', {
                    'i': buffer.tobytes(),
                    'w': widget_id
                }, room=sid)

                total_time = time.time() - start_time
                if debug_on: print(f"DEBUG: 이미지 메시지 전송 완료 - 총 시간: {total_time*1000:.2f}ms")
            else:
                print(f"DEBUG: 이미지가 numpy 배열이 아님 - 타입: {type(image)}")

        @check_stop_flag
        def emit_text(text, widget_id):
            socketio.emit('text_data', {
                'text': text,
                'widget_id': widget_id
            }, room=sid)

        @check_stop_flag
        def get_gesture():
            return gesture_states.get(sid, {})

        @check_stop_flag
        def get_pid_value(widget_id: str):
            state = pid_states.get(sid, {}).get(widget_id)
            if not state:
                return (0.0, 0.0, 0.0)
            return (float(state.get('p', 0.0)), float(state.get('i', 0.0)), float(state.get('d', 0.0)))

        @check_stop_flag
        def get_slider_value(widget_id: str):
            values = slider_states.get(sid, {}).get(widget_id)
            if not values:
                return 0.0
            if len(values) == 1:
                return float(values[0])
            return [float(v) for v in values]

        exec_namespace = {
            'socketio': socketio,
            'sid': sid,
            'stop_flags': stop_flags,
            'Findee': Findee,
            'emit_image': emit_image,
            'emit_text': emit_text,
            'get_gesture': get_gesture,
            'get_pid_value': get_pid_value,
            'get_slider_value': get_slider_value,
            'print': realtime_print
        }

        compiled_code = compile(code, '<string>', 'exec')
        exec(compiled_code, exec_namespace)


    except Exception:
        # 오류 출력
        for line in format_exc().splitlines():
            socketio.emit('stderr', {'output': line}, room=sid)

    finally:
        # 추적 딕셔너리에서 제거
        running_threads.pop(sid, None)
        stop_flags.pop(sid, None)
        print(f"DEBUG: Session {sid}: 스레드 정리 완료")

    # 코드 실행 완료 알림
    socketio.emit('finished', {}, room=sid)

@socketio.on('execute_code')
def handle_execute_code(data):
    try:
        code = data.get('code', '')
        if not code:
            emit('execution_error', {'error': '코드가 제공되지 않았습니다.'})
            return

        # 실행 시작 알림
        emit('execution_started', {'message': '코드 실행을 시작합니다...'})

        # 현재 세션 ID 가져오기
        sid = request.sid

        # 별도 스레드에서 코드 실행
        thread = threading.Thread(
            target=execute_code,
            args=(code, sid),
            daemon=True
        )

        # 스레드를 추적 딕셔너리에 저장
        running_threads[sid] = thread

        thread.start()

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
#endregion

#region SocketIO connect/disconnect
@socketio.on('connect')
def handle_connect():
    print('클라이언트가 연결되었습니다.')
    emit('connected', {'message': '서버에 연결되었습니다.'})

@socketio.on('disconnect')
def handle_disconnect():
    print('클라이언트가 연결을 해제했습니다.')

    # 연결 해제 시 실행 중인 스레드 정리
    sid = request.sid

    # 메인 프로세스 스레드 정리
    if sid in running_threads:
        try:
            stop_flags[sid] = True
            running_threads.pop(sid, None)
            stop_flags.pop(sid, None)
        except Exception:
            pass
#endregion

# Gesture updates from frontend
@socketio.on('gesture_update')
def handle_gesture_update(data):
    sid = request.sid
    data = data.get('data')
    if data: gesture_states[sid] = data

# PID updates from frontend
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

# Slider updates from frontend
@socketio.on('slider_update')
def handle_slider_update(payload):
    sid = request.sid
    try:
        widget_id = payload.get('widget_id')
        values = payload.get('values')
        if not isinstance(values, list):
            return
        values = [float(v) for v in values]
    except Exception:
        return
    if not widget_id:
        return
    session_map = slider_states.get(sid)
    if session_map is None:
        session_map = {}
        slider_states[sid] = session_map
    session_map[widget_id] = values







@app.route("/api/cpu-usage")
def api_cpu_usage():
    """CPU 사용량 정보 반환"""
    try:
        # 전체 CPU 사용량 (평균)
        cpu_percent = psutil.cpu_percent(interval=0.1, percpu=False)

        # 개별 CPU 스레드 사용량
        cpu_percent_per_cpu = psutil.cpu_percent(interval=0.1, percpu=True)

        # CPU 개수
        cpu_count = psutil.cpu_count()

        return jsonify({
            "success": True,
            "cpu_percent": cpu_percent,
            "cpu_percent_per_cpu": cpu_percent_per_cpu,
            "cpu_count": cpu_count
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# AI-Chat은 이제 JavaScript에서 직접 처리됩니다 (llm.js 사용)









if __name__ == '__main__':
    socketio.run(app, debug=DEBUG_MODE, host='0.0.0.0', allow_unsafe_werkzeug=True, port=5000)