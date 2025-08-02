
from flask import Flask, render_template, request, jsonify, Response
from flask_socketio import SocketIO, emit
import subprocess
import sys, os
import tempfile
import threading
import secrets

#region Findee Import(Window)
import sys; import os
if __name__ == "__main__":
    project_root = os.path.abspath(__file__)
    while not project_root.endswith("findee"):
        project_root = os.path.dirname(project_root)
    sys.path.insert(0, project_root)
from findee import Findee, FindeeFormatter
robot = Findee()
#endregion

app = Flask(__name__, static_folder='../static', template_folder='../templates')
app.config['SECRET_KEY'] = secrets.token_hex(32)
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='threading',
    logger=False,
    engineio_logger=False,
    ping_timeout=60,
    ping_interval=10,
    transports=['websocket', 'polling']
)



@app.route('/video_feed')
def video_feed():
    return Response(
        robot.camera.generate_frames(quality=100),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )

def start_camera_feed():
    """카메라 피드를 이미지 위젯에 전달하는 함수"""
    try:
        import cv2
        import base64
        import time
        
        # 카메라에서 프레임을 가져와서 이미지 위젯에 전송
        for frame in robot.camera.generate_frames(quality=100):
            if frame is not None:
                # OpenCV 이미지를 JPEG로 인코딩
                success, buffer = cv2.imencode('.jpg', frame)
                if success:
                    # base64로 인코딩
                    image_base64 = base64.b64encode(buffer).decode('utf-8')
                    
                    # Socket.IO를 통해 이미지 위젯에 전송
                    socketio.emit('camera_feed_update', {
                        'widget_name': 'Image_Display_1',  # 기본 이미지 위젯 이름
                        'image_data': f'data:image/jpeg;base64,{image_base64}'
                    })
                
                # 프레임 레이트 제어 (30fps)
                time.sleep(0.033)
                
    except Exception as e:
        print(f"카메라 피드 전송 오류: {str(e)}")

# 카메라 피드 시작 함수 호출 (백그라운드에서 실행)
def start_camera_background():
    """백그라운드에서 카메라 피드 시작"""
    camera_thread = threading.Thread(target=start_camera_feed, daemon=True)
    camera_thread.start()

# 실행 중인 프로세스를 추적하는 딕셔너리
running_processes = {}

@app.route('/')
def index():
    return render_template('index.html')

#region 코드 실행 부분
def _stream_lines(pipe, sid, stream_type):
    """파이프에서 라인을 읽어서 클라이언트에 전송"""
    try:
        for line in iter(pipe.readline, ''):
            if line:
                # stdout, stderr 핸들러 실행
                socketio.emit(stream_type, {'output': line.strip()}, room=sid)
    except Exception as e:
        socketio.emit('stderr', {'output': f'스트리밍 오류: {str(e)}'}, room=sid)
    finally:
        pipe.close()

def handle_image_request(widget_name, image_data):
    try:
        import cv2
        if len(image_data.shape) == 3 and image_data.shape[2] == 3:
            image_data = cv2.cvtColor(image_data, cv2.COLOR_BGR2RGB)

        # 이미지를 JPEG로 인코딩
        success, buffer = cv2.imencode('.jpg', image_data)
        if success:
            image_bytes = buffer.tobytes()
            socketio.emit('image_update', {
                'widget_name': widget_name,
                'image_data': image_bytes
            })
    except Exception as e:
        print(f"Error sending image: {str(e)}")

def execute_code(code: str, sid: str):
    """코드 실행 함수"""
    # 테스트 이미지 생성 및 전송
    try:
        def make_randome_image():
            import numpy as np
            import time
            while True:
                image = np.random.randint(0, 256, size=(100, 100, 3), dtype=np.uint8)
                handle_image_request('Image_Display_1', image)
                time.sleep(0.01)
        #thread = threading.Thread(target=make_randome_image)
        #thread.start()
    except Exception as e:
        print(f"Error creating test image: {str(e)}")

    # 임시 파일 생성
    with tempfile.NamedTemporaryFile(
        mode='w', suffix='.py', delete=False, encoding='utf-8'
    ) as tmp:
        tmp.write(code)
        tmp_path = tmp.name

    try:
        # 파이프 생성 (임시 파일 사용)
        process = subprocess.Popen(
            [sys.executable, '-u', tmp_path],  # 임시 파일 경로 사용
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=0  # 버퍼링 완전 비활성화
        )

        # 프로세스를 추적 딕셔너리에 저장
        running_processes[sid] = process

        threading.Thread(target=_stream_lines,
                         args=(process.stdout, sid, 'stdout'),
                         daemon=True).start()
        threading.Thread(target=_stream_lines,
                         args=(process.stderr, sid, 'stderr'),
                         daemon=True).start()

        process.wait()

    except Exception as e:
        socketio.emit('execution_error', {'error': f'코드 실행 중 오류: {str(e)}'}, room=sid)
    finally:
        # 프로세스 추적에서 제거
        if sid in running_processes:
            del running_processes[sid]

        # 임시 파일 정리
        try:
            os.unlink(tmp_path)
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
            target=execute_code,
            args=(code, sid)
        )
        thread.daemon = True
        thread.start()

    except Exception as e:
        emit('execution_error', {'error': f'코드 실행 중 오류가 발생했습니다: {str(e)}'})
#endregion

#region 소켓 연결 부분
@socketio.on('connect')
def handle_connect():
    """클라이언트가 연결되었을 때 호출"""
    print('클라이언트가 연결되었습니다.')
    emit('connected', {'message': '서버에 연결되었습니다.'})
    
    # 카메라 피드 시작
    start_camera_background()


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

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)