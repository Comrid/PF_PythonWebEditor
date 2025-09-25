# 간단한 로봇 클라이언트 테스트
import socketio
import time
import uuid

# 로봇 설정
ROBOT_ID = f"robot_{uuid.uuid4().hex[:8]}"
ROBOT_NAME = "Test Robot"
SERVER_URL = "https://pathfinder-kit.duckdns.org"

# SocketIO 클라이언트 생성
sio = socketio.Client()

@sio.event
def connect():
    print(f"✅ 서버에 연결됨: {SERVER_URL}")
    print(f"🔧 로봇 ID: {ROBOT_ID}")
    print(f"🔧 로봇 이름: {ROBOT_NAME}")
    
    # 서버에 로봇 등록
    print("📤 서버에 로봇 등록 요청 전송...")
    sio.emit('robot_connected', {
        'robot_id': ROBOT_ID,
        'robot_name': ROBOT_NAME,
        'hardware_enabled': False
    })

@sio.event
def disconnect():
    print("❌ 서버 연결 해제됨")

@sio.event
def robot_registered(data):
    """서버에서 로봇 등록 확인 수신"""
    if data.get('success'):
        print(f"✅ {data.get('message')}")
    else:
        print(f"❌ 로봇 등록 실패: {data.get('error')}")

@sio.event
def execute_code(data):
    """서버로부터 코드 실행 요청 수신"""
    code = data.get('code', '')
    session_id = data.get('session_id', '')
    
    print(f"\n📨 서버로부터 코드 수신:")
    print("=" * 50)
    print(code)
    print("=" * 50)
    
    # 간단한 응답 전송
    sio.emit('robot_stdout', {
        'session_id': session_id,
        'output': f'로봇 {ROBOT_NAME}에서 코드 실행: {code[:50]}...'
    })
    
    sio.emit('robot_finished', {
        'session_id': session_id,
        'output': '실행 완료'
    })

def heartbeat_thread():
    """하트비트 전송 스레드"""
    while True:
        if sio.connected:
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
    print("🚀 테스트 로봇 클라이언트 시작")
    print(f"🔗 서버 연결 시도: {SERVER_URL}")
    
    try:
        # 서버에 연결
        sio.connect(SERVER_URL)
        
        # 하트비트 스레드 시작
        import threading
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
