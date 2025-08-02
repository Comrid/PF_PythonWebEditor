from flask import Flask, render_template, request, jsonify, Response
from flask_socketio import SocketIO, emit
from secrets import token_hex

# Modules for code execution
import subprocess, sys, os, tempfile, threading
from tempfile import NamedTemporaryFile
from pathlib import Path
import json
from util import get_flask_url

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

# 실행 중인 프로세스를 추적하는 딕셔너리
running_processes: dict[str, subprocess.Popen] = {}

@app.route('/')
def index():
    return render_template('index.html')

#region Code Execution
# sid 가 필요한 이유: 클라이언트가 여러 개인 경우 메시지를 구분하기 위해서
def _stream_lines(pipe, sid, stream_type):
    try:
        for line in iter(pipe.readline, ''):
            if line:
                # stdout, stderr 핸들러 실행
                socketio.emit(stream_type, {'output': line.strip()}, room=sid)
    except Exception as e:
        socketio.emit('stderr', {'output': f'Stream Error: {str(e)}'}, room=sid)
    finally:
        pipe.close()

def execute_code_with_direct_emit(code: str, sid: str):
    """직접 emit을 사용한 코드 실행"""

    print(f"DEBUG: 코드 실행 시작 - sid: {sid}")
    print(f"DEBUG: 코드 길이: {len(code)}")

    # 사용자 코드에 emit 함수 추가
    enhanced_code = f"""
import base64
import numpy as np
import cv2
import json
import sys

# emit 함수 정의
def emit_image(image, event='image_data'):
    print(f"DEBUG: emit_image 호출됨 - event: {{event}}")
    if isinstance(image, np.ndarray):
        import time
        start_time = time.time()

        # 이미지를 base64로 인코딩
        _, buffer = cv2.imencode('.jpg', image)
        encode_time = time.time() - start_time
        print(f"DEBUG: JPEG 인코딩 완료 - 시간: {{encode_time*1000:.2f}}ms")

        image_base64 = base64.b64encode(buffer).decode()
        base64_time = time.time() - start_time - encode_time
        print(f"DEBUG: Base64 인코딩 완료 - 시간: {{base64_time*1000:.2f}}ms, 크기: {{len(image_base64)}}")

        # 메인 프로세스로 전송
        message = {{
            'type': 'emit_image',
            'event': event,
            'image': image_base64,
            'shape': image.shape
        }}
        sys.stdout.write(f"EMIT_MESSAGE:{{json.dumps(message)}}\\n")
        sys.stdout.flush()

        total_time = time.time() - start_time
        print(f"DEBUG: 이미지 메시지 전송 완료 - 총 시간: {{total_time*1000:.2f}}ms")
    else:
        print(f"DEBUG: 이미지가 numpy 배열이 아님 - 타입: {{type(image)}}")

def emit_data(data, event='custom_data'):
    print(f"DEBUG: emit_data 호출됨 - event: {{event}}")
    message = {{
        'type': 'emit_data',
        'event': event,
        'data': data
    }}
    sys.stdout.write(f"EMIT_MESSAGE:{{json.dumps(message)}}\\n")
    sys.stdout.flush()
    print(f"DEBUG: 데이터 메시지 전송 완료")

print("DEBUG: 서브 프로세스 시작")
print("DEBUG: 사용자 코드 실행 시작")

# 사용자 코드
{code}

print("DEBUG: 사용자 코드 실행 완료")
"""

    # 임시 파일로 실행
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as tmp:
        tmp.write(enhanced_code)
        tmp_path = tmp.name
        print(f"DEBUG: 임시 파일 생성: {tmp_path}")

    try:
        print(f"DEBUG: 프로세스 시작")
        process = subprocess.Popen(
            [sys.executable, '-u', tmp_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=0
        )

        # 프로세스를 추적 딕셔너리에 저장
        running_processes[sid] = process
        print(f"DEBUG: 프로세스 PID: {process.pid}")

        # stdout과 stderr를 별도 스레드에서 모니터링 (기존 방식과 동일)
        print(f"DEBUG: 출력 모니터링 시작")

        def monitor_stdout_with_emit():
            try:
                for line in iter(process.stdout.readline, ''):
                    if line:
                        #print(f"DEBUG: 서브 프로세스 stdout: {line.strip()}")
                        if line.startswith('EMIT_MESSAGE:'):
                            # emit 메시지 처리
                            try:
                                import time
                                start_time = time.time()

                                message_data = line.strip().split(':', 1)[1]
                                message = json.loads(message_data)

                                parse_time = time.time() - start_time
                                print(f"DEBUG: 메시지 파싱 완료 - 타입: {message['type']}, 파싱 시간: {parse_time*1000:.2f}ms")

                                if message['type'] == 'emit_image':
                                    # 이미지 emit 처리
                                    print(f"DEBUG: 이미지 emit 처리 시작")
                                    emit_start = time.time()
                                    socketio.emit(message['event'], {
                                        'image': message['image'],
                                        'format': 'jpg',
                                        'shape': message['shape']
                                    }, room=sid)
                                    emit_time = time.time() - emit_start
                                    print(f"DEBUG: 이미지 emit 처리 완료 - emit 시간: {emit_time*1000:.2f}ms")
                                elif message['type'] == 'emit_data':
                                    # 데이터 emit 처리
                                    print(f"DEBUG: 데이터 emit 처리 시작")
                                    socketio.emit(message['event'], message['data'], room=sid)
                                    print(f"DEBUG: 데이터 emit 처리 완료")

                            except Exception as e:
                                print(f"DEBUG: Emit 처리 오류: {str(e)}")
                                socketio.emit('stderr', {'output': f'Emit 처리 오류: {str(e)}'}, room=sid)
                        else:
                            # 일반 출력
                            socketio.emit('stdout', {'output': line.strip()}, room=sid)
            except Exception as e:
                print(f"DEBUG: stdout 모니터링 오류: {str(e)}")

        def monitor_stderr():
            try:
                for line in iter(process.stderr.readline, ''):
                    if line:
                        print(f"DEBUG: 서브 프로세스 stderr: {line.strip()}")
                        socketio.emit('stderr', {'output': line.strip()}, room=sid)
            except Exception as e:
                print(f"DEBUG: stderr 모니터링 오류: {str(e)}")

        # 스레드 시작
        stdout_thread = threading.Thread(target=monitor_stdout_with_emit, daemon=True)
        stderr_thread = threading.Thread(target=monitor_stderr, daemon=True)
        stdout_thread.start()
        stderr_thread.start()

        print(f"DEBUG: 프로세스 완료 대기")
        process.wait()
        print(f"DEBUG: 프로세스 완료 - 종료 코드: {process.returncode}")

        # 종료 코드가 0이 아니면 오류
        if process.returncode != 0:
            print(f"DEBUG: 프로세스가 오류로 종료됨 - 종료 코드: {process.returncode}")
            socketio.emit('stderr', {'output': f'프로세스가 오류로 종료됨 (종료 코드: {process.returncode})'}, room=sid)

    except Exception as e:
        print(f"DEBUG: 코드 실행 오류: {str(e)}")
        socketio.emit('execution_error', {'error': f'코드 실행 중 오류: {str(e)}'}, room=sid)
    finally:
        # 프로세스 추적에서 제거
        if sid in running_processes:
            del running_processes[sid]

        # 임시 파일 정리
        try:
            os.unlink(tmp_path)
            print(f"DEBUG: 임시 파일 삭제 완료")
        except OSError:
            print(f"DEBUG: 임시 파일 삭제 실패")

    # 코드 실행 완료 알림
    print(f"DEBUG: 실행 완료 알림 전송")
    socketio.emit('finished', {}, room=sid)

def execute_code(code: str, sid: str):
    # 임시 파일 생성
    with NamedTemporaryFile(
        mode='w',           # 파일 모드 (쓰기 모드)
        suffix='.py',       # 파일 확장자
        delete=False,       # 컨텍스트 종료 시 자동 삭제 여부
        encoding='utf-8'    # 파일 인코딩
    ) as tmp:
        tmp.write(code)
        tmp_path = Path(tmp.name)

    try:
        # 파이프 생성 (임시 파일 사용)
        process = subprocess.Popen(
            [sys.executable, '-u', str(tmp_path)],  # 임시 파일 경로 사용
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=0
        )

        # 프로세스를 추적 딕셔너리에 저장
        running_processes[sid] = process
        threading.Thread(target=_stream_lines, args=(process.stdout, sid, 'stdout'), daemon=True).start()
        threading.Thread(target=_stream_lines, args=(process.stderr, sid, 'stderr'), daemon=True).start()
        process.wait()

    except Exception as e:
        socketio.emit('execution_error', {'error': f'코드 실행 중 오류: {str(e)}'}, room=sid)
    finally:
        running_processes.pop(sid, None) # 프로세스를 추적 딕셔너리에서 제거

        try:
            if tmp_path.exists():
                    tmp_path.unlink()
        except OSError:
            pass

    # 코드 실행 완료 알림
    socketio.emit('finished', {}, room=sid)

@socketio.on('stop_execution')
def handle_stop_execution():
    """실행 중인 코드를 중지"""
    try:
        sid = request.sid

        if sid in running_processes:
            process = running_processes[sid]

            # 프로세스와 자식 프로세스들을 모두 종료
            try:
                process.terminate()

                import time
                for _ in range(10):
                    if process.poll() is not None:
                        break
                    time.sleep(0.1)

                if process.poll() is None:
                    process.kill()

            except Exception as e:
                print(f"프로세스 종료 중 오류: {str(e)}")
                socketio.emit('execution_error', {'error': f'프로세스 종료 중 오류: {str(e)}'}, room=sid)
                return

            running_processes.pop(sid, None)  # KeyError 방지
            socketio.emit('execution_stopped', {'message': '코드 실행이 중지되었습니다.'}, room=sid)
        else:
            socketio.emit('execution_error', {'error': '실행 중인 코드가 없습니다.'}, room=sid)

    except Exception as e:
        emit('execution_error', {'error': f'코드 중지 중 오류가 발생했습니다: {str(e)}'})

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
            #target=execute_code,
            target=execute_code_with_direct_emit,
            args=(code, sid)
        )
        thread.daemon = True
        thread.start()

    except Exception as e:
        emit('execution_error', {'error': f'코드 실행 중 오류가 발생했습니다: {str(e)}'})
#endregion

#region SocketIO connect/disconnect
@socketio.on('connect')
def handle_connect():
    """클라이언트가 연결되었을 때 호출"""
    print('클라이언트가 연결되었습니다.')
    emit('connected', {'message': '서버에 연결되었습니다.'})

@socketio.on('disconnect')
def handle_disconnect():
    """클라이언트가 연결을 해제했을 때 호출"""
    print('클라이언트가 연결을 해제했습니다.')

    # 연결 해제 시 실행 중인 프로세스 정리
    sid = request.sid
    if sid in running_processes:
        try:
            process = running_processes[sid]
            process.terminate()
            del running_processes[sid]
        except Exception:
            pass
#endregion

#region Main
if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
#endregion