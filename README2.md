# PF Python Web Editor v2.0 - 중앙 서버 + 로봇 클라이언트 아키텍처

> 중앙 서버에서 웹 에디터를 제공하고, 원격 로봇(라즈베리파이 제로 2W)에 코드를 전송하여 실행하는 분산 시스템

<img src="static/img/app-logo.png" alt="image" width="180"/>

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Flask](https://img.shields.io/badge/Flask-2.0+-green.svg)](https://flask.palletsprojects.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-5.0+-orange.svg)](https://socket.io/)
[![Raspberry Pi](https://img.shields.io/badge/Raspberry%20Pi-Zero%202%20W-red.svg)](https://www.raspberrypi.org/)

**Backend**: Python 3.8+, Flask 2.0+, Flask-SocketIO, psutil  
**Frontend**: Monaco Editor, GridStack, MediaPipe Tasks  
**Hardware**: Raspberry Pi Zero 2 W, Picamera2, RPi.GPIO  
**AI/ML**: Google Gemini API (선택사항)

---

## 목차
- [아키텍처 개요](#아키텍처-개요)
- [시스템 구성](#시스템-구성)
- [주요 변경사항](#주요-변경사항)
- [설치 및 설정](#설치-및-설정)
- [사용법](#사용법)
- [API 명세](#api-명세)
- [보안 고려사항](#보안-고려사항)
- [트러블슈팅](#트러블슈팅)

---

## 아키텍처 개요

### 기존 구조 (v1.0)
```
┌─────────────────┐
│   Browser       │ ←────────────→  │   Raspberry Pi   │
│                 │                 │   (Flask Server) │
│ ┌─────────────┐ │                 │                 │
│ │Monaco Editor│ │                 │ ┌─────────────┐ │
│ └─────────────┘ │                 │ │Code Executor│ │
│ ┌─────────────┐ │                 │ │(Thread)     │ │
│ │GridStack    │ │                 │ └─────────────┘ │
│ │Widgets      │ │                 │                 │
│ └─────────────┘ │                 │ ┌─────────────┐ │
└─────────────────┘                 │ │Findee       │ │
                                    │ │Hardware     │ │
                                    │ │Control      │ │
                                    │ └─────────────┘ │
                                    └─────────────────┘
```

### 새로운 구조 (v2.0)
```
┌─────────────────┐    HTTP/WebSocket    ┌─────────────────┐    HTTP/WebSocket    ┌─────────────────┐
│   Browser       │ ←────────────────→  │  Central Server │ ←────────────────→  │   Robot Client  │
│                 │                     │   (Flask App)   │                     │   (Flask App)   │
│ ┌─────────────┐ │                     │                 │                     │                 │
│ │Monaco Editor│ │                     │ ┌─────────────┐ │                     │ ┌─────────────┐ │
│ └─────────────┘ │                     │ │Code Router  │ │                     │ │Code Executor│ │
│ ┌─────────────┐ │                     │ │& Manager    │ │                     │ │(Thread)     │ │
│ │GridStack    │ │                     │ └─────────────┘ │                     │ └─────────────┘ │
│ │Widgets      │ │                     │                 │                     │                 │
│ └─────────────┘ │                     │ ┌─────────────┐ │                     │ ┌─────────────┐ │
└─────────────────┘                     │ │Data Relay   │ │                     │ │Findee       │ │
                                        │ │& Forwarding │ │                     │ │Hardware     │ │
                                        │ └─────────────┘ │                     │ │Control      │ │
                                        └─────────────────┘                     │ └─────────────┘ │
                                                                                └─────────────────┘
```

---

## 시스템 구성

### 1. 중앙 서버 (Central Server)
- **역할**: 웹 에디터 제공, 코드 라우팅, 데이터 중계
- **구성요소**:
  - Flask 웹 애플리케이션
  - Monaco Editor + GridStack UI
  - 로봇 클라이언트 관리 시스템
  - 코드 실행 요청 라우터
  - 실시간 데이터 중계 서버

### 2. 로봇 클라이언트 (Robot Client)
- **역할**: 하드웨어 제어, 코드 실행, 센서 데이터 수집
- **구성요소**:
  - 경량 Flask 서버
  - Findee 하드웨어 제어 모듈
  - 코드 실행 엔진
  - 센서 데이터 수집기
  - 중앙 서버 통신 클라이언트

---

## 주요 변경사항

### 1. 코드 실행 흐름
```python
# 기존 (v1.0)
Browser → Raspberry Pi (직접 실행)

# 새로운 (v2.0)
Browser → Central Server → Robot Client → Hardware
```

### 2. 데이터 전송 방식
```python
# 기존 (v1.0)
emit_image(frame, "Image_0")  # 로컬 위젯에 직접 표시

# 새로운 (v2.0)
emit_image(frame, "Image_0")  # Robot → Central Server → Browser 위젯
```

### 3. 세션 관리
- **중앙 서버**: 사용자 세션 + 로봇 매핑 관리
- **로봇 클라이언트**: 하드웨어 리소스 관리

---

## 설치 및 설정

### 1. 중앙 서버 설정

#### 1.1 서버 환경
- **서버**: Raspberry Pi 4
- **웹 서버**: Nginx (리버스 프록시)
- **도메인**: https://pathfinder-kit.duckdns.org/
- **SSL**: Certbot (Let's Encrypt)
- **동적 DNS**: DuckDNS

#### 1.2 프로젝트 클론 및 의존성 설치
```bash
git clone https://github.com/Comrid/PF_PythonWebEditor.git
cd PF_PythonWebEditor
pip install -r requirements.txt
```

#### 1.3 환경 설정
```bash
# .env 파일 생성
cat > .env << EOF
FLASK_ENV=production
SECRET_KEY=your-secret-key-here
ROBOT_CLIENT_TIMEOUT=30
MAX_CONCURRENT_ROBOTS=10
DOMAIN=pathfinder-kit.duckdns.org
HTTPS_ENABLED=true
EOF
```

#### 1.4 Nginx 설정
```bash
# /etc/nginx/sites-available/pathfinder-kit
server {
    listen 80;
    server_name pathfinder-kit.duckdns.org;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name pathfinder-kit.duckdns.org;

    ssl_certificate /etc/letsencrypt/live/pathfinder-kit.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pathfinder-kit.duckdns.org/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 1.5 SSL 인증서 설정 (Certbot)
```bash
# Certbot 설치
sudo apt install certbot python3-certbot-nginx

# SSL 인증서 발급
sudo certbot --nginx -d pathfinder-kit.duckdns.org

# 자동 갱신 설정
sudo crontab -e
# 다음 라인 추가: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### 1.6 DuckDNS 설정
```bash
# DuckDNS 토큰 설정
echo "YOUR_DUCKDNS_TOKEN" > /etc/duckdns/duckdns_token

# DuckDNS 업데이트 스크립트
cat > /etc/duckdns/duckdns_update.sh << 'EOF'
#!/bin/bash
TOKEN=$(cat /etc/duckdns/duckdns_token)
DOMAIN="pathfinder-kit"
curl -s "https://www.duckdns.org/update?domains=$DOMAIN&token=$TOKEN"
EOF

chmod +x /etc/duckdns/duckdns_update.sh

# 5분마다 IP 업데이트
echo "*/5 * * * * /etc/duckdns/duckdns_update.sh" | sudo crontab -
```

#### 1.7 서버 실행
```bash
# Nginx 재시작
sudo systemctl restart nginx

# Flask 앱 실행 (systemd 서비스로 등록 권장)
python app.py
```

#### 1.8 Systemd 서비스 등록 (선택사항)
```bash
# /etc/systemd/system/pathfinder-editor.service
cat > /etc/systemd/system/pathfinder-editor.service << EOF
[Unit]
Description=Pathfinder Python Web Editor
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/PF_PythonWebEditor
Environment=PATH=/home/pi/PF_PythonWebEditor/.venv/bin
ExecStart=/home/pi/PF_PythonWebEditor/.venv/bin/python app.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# 서비스 활성화
sudo systemctl daemon-reload
sudo systemctl enable pathfinder-editor
sudo systemctl start pathfinder-editor
```

### 2. 로봇 클라이언트 설정

#### 2.1 로봇 클라이언트 코드 생성
```bash
# 로봇 클라이언트 디렉토리 생성
mkdir robot_client
cd robot_client

# requirements.txt 생성
cat > requirements.txt << EOF
Flask==2.3.3
Flask-SocketIO==5.3.6
requests==2.31.0
opencv-python==4.8.1.78
numpy==1.24.3
RPi.GPIO
picamera2
findee
EOF

pip install -r requirements.txt
```

#### 2.2 로봇 클라이언트 설정
```bash
# robot_config.py 생성
cat > robot_config.py << EOF
# 로봇 클라이언트 설정
CENTRAL_SERVER_URL = "https://pathfinder-kit.duckdns.org"
ROBOT_ID = "robot_001"  # 고유 로봇 ID
ROBOT_NAME = "My Robot"
HARDWARE_ENABLED = True
VERIFY_SSL = True  # HTTPS 사용 시 SSL 검증
EOF
```

#### 2.3 로봇 클라이언트 실행
```bash
python robot_client.py
```

---

## 사용법

### 1. 로봇 등록
1. 중앙 서버 웹 인터페이스 접속: https://pathfinder-kit.duckdns.org/
2. "로봇 관리" 메뉴에서 새 로봇 등록
3. 로봇 ID와 이름 설정
4. 로봇 상태 확인 (연결됨/연결 안됨)

### 2. 코드 작성 및 실행
1. **로봇 선택**: 실행할 로봇 선택
2. **코드 작성**: Monaco Editor에서 Python 코드 작성
3. **실행**: Run 버튼으로 선택된 로봇에 코드 전송
4. **모니터링**: 실시간 결과를 위젯으로 확인

### 3. 코드 예시
```python
from findee import Findee

robot = Findee()
try:
    # 카메라로 이미지 캡처
    frame = robot.get_frame()
    emit_image(frame, "Image_0")  # 중앙 서버로 전송
    
    # 초음파로 거리 측정
    distance = robot.get_distance()
    emit_text(f"Distance: {distance}cm", "Text_0")  # 중앙 서버로 전송
    
    # 모터 제어
    robot.move_forward(70, 1.0)
finally:
    robot.cleanup()
```

---

## API 명세

### 1. 중앙 서버 API

#### 1.1 로봇 관리
```http
GET https://pathfinder-kit.duckdns.org/api/robots
# 등록된 로봇 목록 조회

POST https://pathfinder-kit.duckdns.org/api/robots/register
# 새 로봇 등록
{
  "robot_id": "robot_001",
  "robot_name": "My Robot",
  "robot_url": "http://192.168.1.100:5001"
}

DELETE https://pathfinder-kit.duckdns.org/api/robots/<robot_id>
# 로봇 등록 해제
```

#### 1.2 코드 실행
```http
POST https://pathfinder-kit.duckdns.org/api/execute
# 선택된 로봇에 코드 실행
{
  "robot_id": "robot_001",
  "code": "print('Hello Robot!')",
  "session_id": "user_session_123"
}
```

#### 1.3 실시간 데이터
```http
WebSocket wss://pathfinder-kit.duckdns.org/socket.io/
# 실시간 데이터 스트리밍 (HTTPS 환경에서 WSS 사용)
- image_data: 이미지 데이터
- text_data: 텍스트 데이터
- robot_status: 로봇 상태
```

### 2. 로봇 클라이언트 API

#### 2.1 코드 실행
```http
POST /execute
# 중앙 서버로부터 코드 실행 요청 수신
{
  "code": "print('Hello Robot!')",
  "session_id": "user_session_123"
}
```

#### 2.2 데이터 전송
```http
POST /emit/image
# 이미지 데이터를 중앙 서버로 전송
{
  "image_data": "base64_encoded_image",
  "widget_id": "Image_0",
  "session_id": "user_session_123"
}

POST /emit/text
# 텍스트 데이터를 중앙 서버로 전송
{
  "text": "Hello from robot!",
  "widget_id": "Text_0",
  "session_id": "user_session_123"
}
```

---

## 보안 고려사항

### 1. 인증 및 권한
- **로봇 인증**: 로봇 등록 시 고유 토큰 발급
- **사용자 인증**: 세션 기반 사용자 관리
- **코드 검증**: 실행 전 코드 안전성 검사

### 2. 네트워크 보안
- **HTTPS/WSS**: 모든 통신 암호화 (Let's Encrypt SSL 인증서)
- **방화벽**: 필요한 포트만 개방 (80, 443, 22)
- **DuckDNS**: 동적 DNS를 통한 안전한 도메인 관리
- **Nginx 리버스 프록시**: 추가 보안 레이어 제공
- **VPN**: 로봇과 서버 간 안전한 통신 (선택사항)

### 3. 코드 실행 보안
- **샌드박스**: 로봇에서 안전한 코드 실행 환경
- **리소스 제한**: CPU/메모리 사용량 제한
- **타임아웃**: 코드 실행 시간 제한

---

## 트러블슈팅

### 1. 연결 문제
- **로봇 연결 실패**: 네트워크 설정 및 방화벽 확인
- **HTTPS 연결 실패**: SSL 인증서 유효성 및 만료일 확인
- **DuckDNS 업데이트 실패**: 토큰 설정 및 cron 작업 확인
- **데이터 전송 실패**: 대역폭 및 지연시간 확인
- **세션 끊김**: 하트비트 및 재연결 로직 확인

### 2. 성능 문제
- **실시간 지연**: 네트워크 최적화 및 압축 사용
- **메모리 부족**: 로봇 클라이언트 리소스 모니터링
- **CPU 과부하**: 코드 실행 시간 제한 및 큐잉

### 3. 하드웨어 문제
- **센서 오류**: 로봇 클라이언트에서 하드웨어 상태 확인
- **모터 제어 실패**: GPIO 권한 및 배선 확인
- **카메라 오류**: Picamera2 설정 및 권한 확인

---

## 개발 로드맵

### Phase 1: 기본 구조 구현
- [ ] 중앙 서버 코드 라우팅 시스템
- [ ] 로봇 클라이언트 기본 구조
- [ ] 실시간 데이터 중계 시스템

### Phase 2: 고급 기능
- [ ] 다중 로봇 동시 제어
- [ ] 로봇 상태 모니터링
- [ ] 코드 실행 큐잉 시스템

### Phase 3: 최적화 및 확장
- [ ] 성능 최적화
- [ ] 보안 강화
- [ ] 클라우드 배포 지원

---

## 라이선스
- 저장소의 `LICENSE` 파일을 참조하세요.

---

## 기여
- 이슈 등록 → 브랜치 생성 → PR 제출
- 코드 스타일: 가독성 우선, 명확한 네이밍, 예외/에러 처리 철저
- 대규모 변경은 이슈로 사전 논의 권장
