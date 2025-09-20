# Robot Client Configuration
# 로봇 클라이언트 설정 파일

# 중앙 서버 설정
CENTRAL_SERVER_URL = "https://pathfinder-kit.duckdns.org"

# 로봇 정보
ROBOT_ID = "robot_001"  # 고유 로봇 ID (각 로봇마다 다르게 설정)
ROBOT_NAME = "My Robot"  # 로봇 이름

# 하드웨어 설정
HARDWARE_ENABLED = True  # 하드웨어 제어 활성화 여부

# SSL 설정
VERIFY_SSL = True  # HTTPS 사용 시 SSL 검증

# 통신 설정
HEARTBEAT_INTERVAL = 10  # 하트비트 전송 간격 (초)
REQUEST_TIMEOUT = 30  # 요청 타임아웃 (초)

# 포트 설정
ROBOT_PORT = 5001  # 로봇 클라이언트 포트
