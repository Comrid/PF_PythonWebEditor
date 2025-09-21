# Robot Client Configuration
# 로봇 클라이언트 설정 파일

# 중앙 서버 URL
CENTRAL_SERVER_URL = "https://pathfinder-kit.duckdns.org"

# 로봇 정보 (app_wifi.py에서 등록한 정보와 일치해야 함)
ROBOT_ID = "robot_250abd25"  # 실제 등록된 로봇 ID로 변경
ROBOT_NAME = "asd"  # 실제 등록된 로봇 이름

# 하드웨어 설정 (PC에서는 False, 라즈베리파이에서는 True)
import platform
HARDWARE_ENABLED = platform.system() == "Linux"

# 네트워크 설정
VERIFY_SSL = True  # HTTPS 사용 시 True
HEARTBEAT_INTERVAL = 10  # 하트비트 전송 간격 (초)
REQUEST_TIMEOUT = 30  # 요청 타임아웃 (초)

# 로봇 클라이언트 포트
ROBOT_PORT = 5001  # 로봇에서 실행될 포트