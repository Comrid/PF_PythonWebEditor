import ctypes
from flask import Flask, render_template, request, jsonify, Response
from flask_socketio import SocketIO, emit
from secrets import token_hex

# Modules for code execution
import threading
from traceback import format_exc
import builtins
from typing import Type



# 개발 환경 설정 (프로덕션에서는 제거)
import sys; import os
if __name__ == "__main__":
    project_root = os.path.abspath(__file__)
    while not project_root.endswith("findee"):
        project_root = os.path.dirname(project_root)
    sys.path.insert(0, project_root)
from findee import Findee, FindeeFormatter





app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['SECRET_KEY'] = token_hex(32)
socketio = SocketIO(
    app,                                    # Flask 애플리케이션 인스턴스
    cors_allowed_origins="*",               # CORS 설정 - 모든 도메인 허용
    async_mode='threading',                 # 비동기 모드 - 스레딩 사용
    logger=False,                           # SocketIO 로거 비활성화
    engineio_logger=False,                  # Engine.IO 로거 비활성화
    ping_timeout=60,                        # 핑 타임아웃 60초
    ping_interval=10,                       # 핑 간격 10초
    transports=['websocket', 'polling']     # 전송 방식 설정
)

# 실행 중인 스레드를 추적하는 딕셔너리 (메인 프로세스용)
running_threads: dict[str, threading.Thread] = {}

# 실행 중지 플래그를 추적하는 딕셔너리
stop_flags: dict[str, bool] = {}

# 안전하게 스레드에 예외를 주입하는 헬퍼 (라즈베리파이 포함 호환)
def raise_in_thread(thread: threading.Thread, exc_type: Type[BaseException] = SystemExit) -> bool:
    if thread is None or not thread.is_alive():
        return False

    func = ctypes.pythonapi.PyThreadState_SetAsyncExc
    func.argtypes = [ctypes.c_ulong, ctypes.py_object]
    func.restype = ctypes.c_int

    tid = ctypes.c_ulong(thread.ident)
    res = func(tid, ctypes.py_object(exc_type))

    if res > 1:
        # 롤백
        func(tid, ctypes.py_object(0))
        return False

    return res == 1

@app.route('/')
def index():
    return render_template('index.html')

#region Code Execution
def execute_code(code: str, sid: str):
    # 중지 플래그 초기화
    stop_flags[sid] = False

    # 원본 함수들 저장 (더 안전한 방식)
    original_print = builtins.print

    # 원본 함수를 안전한 위치에 저장
    builtins._original_print = original_print

    # 실시간 출력을 위한 커스텀 print 함수
    def realtime_print(*args, **kwargs):
        # 중지 플래그 확인
        if stop_flags.get(sid, False):
            return

        output = ' '.join(str(arg) for arg in args)
        if output:  # 빈 문자열이 아닌 경우만 전송
            socketio.emit('stdout', {'output': output}, room=sid)

    try:
        # print 함수를 안전하게 오버라이드
        builtins.print = realtime_print

        # 사용자 코드에서 socketio와 sid를 사용할 수 있도록 전역 변수 설정
        import __main__
        __main__.socketio = socketio
        __main__.sid = sid
        __main__.stop_flags = stop_flags

        # emit 함수들을 사용자 코드에서 사용할 수 있도록 전역 변수로 설정
        def emit_image(image, widget_id):
            # 중지 플래그 확인
            if stop_flags.get(sid, False):
                return
            debug_on = False
            if debug_on: print(f"DEBUG: emit_image 호출됨 : {widget_id}")
            if hasattr(image, 'shape'):  # numpy 배열인지 확인
                import time
                import base64
                import cv2
                start_time = time.time()

                # 이미지를 base64로 인코딩
                _, buffer = cv2.imencode('.jpg', image)
                encode_time = time.time() - start_time
                if debug_on: print(f"DEBUG: JPEG 인코딩 완료 - 시간: {encode_time*1000:.2f}ms")

                image_base64 = base64.b64encode(buffer).decode()
                base64_time = time.time() - start_time - encode_time
                if debug_on: print(f"DEBUG: Base64 인코딩 완료 - 시간: {base64_time*1000:.2f}ms, 크기: {len(image_base64)}")

                # socketio.emit() 사용
                socketio.emit('image_data', {
                    'image': image_base64,
                    'format': 'jpg',
                    'shape': image.shape,
                    'widget_id': widget_id
                }, room=sid)

                total_time = time.time() - start_time
                if debug_on: print(f"DEBUG: 이미지 메시지 전송 완료 - 총 시간: {total_time*1000:.2f}ms")
            else:
                print(f"DEBUG: 이미지가 numpy 배열이 아님 - 타입: {type(image)}")

        def emit_text(text, widget_id):
            if stop_flags.get(sid, False):
                return
            socketio.emit('text_data', {
                'text': text,
                'widget_id': widget_id
            }, room=sid)

        # emit 함수들을 전역 변수로 설정
        __main__.emit_image = emit_image
        __main__.emit_text = emit_text

        compiled_code = compile(code, '<string>', 'exec')
        exec(compiled_code, {'socketio': socketio,
                             'sid': sid,
                             'stop_flags': stop_flags,
                             'emit_image': emit_image,
                             'emit_text': emit_text})


    except Exception:
        # 오류 출력
        for line in format_exc().splitlines():
            socketio.emit('stderr', {'output': line}, room=sid)

    finally:
        # 반드시 원본 함수들 복원 (안전성 보장)
        try:
            builtins.print = original_print
            print(f"DEBUG: Session {sid}: 원본 print 함수 복원됨")
        except Exception as e:
            print(f"DEBUG: Session {sid}: print 함수 복원 중 오류: {str(e)}")

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

        # 3단계: 강제 종료 (필요한 경우)
        if thread.is_alive():

            # 강제 종료 전에 finally 블록 실행을 위한 안전장치
            def safe_termination():
                try:
                    builtins.print = getattr(builtins, '_original_print', print)
                    running_threads.pop(sid, None)
                    stop_flags.pop(sid, None)
                except Exception as e:
                    print(f"DEBUG: 안전장치 실행 중 오류: {str(e)}")

            # 별도 스레드에서 안전장치 실행
            safety_thread = threading.Thread(target=safe_termination, daemon=True)
            safety_thread.start()
            safety_thread.join(timeout=1.0)  # 1초 대기

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

        # 최종 정리 (이중 안전장치)
        running_threads.pop(sid, None)
        stop_flags.pop(sid, None)

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

#region Main
import multiprocessing as mp
import psutil
def monitor_cpu():
    while True:
        usage = psutil.cpu_percent(interval=1, percpu=True)
        print(" | ".join(f"CPU{i}: {u:5.1f}%" for i, u in enumerate(usage)))


if __name__ == '__main__':
    monitor = mp.Process(target=monitor_cpu, daemon=True).start()


    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
#endregion



