# PathFinder 모드 관리자

라즈베리파이에서 환경 변수 `MODE`에 따라 AP 모드와 클라이언트 모드를 자동으로 전환하는 시스템입니다.

## 🚀 설치 방법

```bash
cd /home/pi/PF_PythonWebEditor/Client_Code
chmod +x install_mode_manager.sh
./install_mode_manager.sh
```

## 📋 모드 설명

### AP 모드 (`MODE=AP`)
- 라즈베리파이가 WiFi 핫스팟으로 동작
- SSID: `PF_Kit_Wifi`
- IP: `10.42.0.1`
- 웹사이트: `http://pathfinder.wifi` 또는 `http://10.42.0.1:5000`
- `app_wifi.py` 실행 (WiFi 설정 웹서버)

### 클라이언트 모드 (`MODE=CLIENT`)
- 라즈베리파이가 WiFi 클라이언트로 동작
- 인터넷에 연결
- `robot_client.py` 실행 (서버 연결)

## 🔄 모드 전환 방법

### AP 모드로 전환
```bash
echo "MODE=AP" | sudo tee /etc/environment
sudo systemctl restart pf_mode
```

### 클라이언트 모드로 전환
```bash
echo "MODE=CLIENT" | sudo tee /etc/environment
sudo systemctl restart pf_mode
```

## 📁 파일 구조

```
Client_Code/
├── pf_mode_manager.sh      # 메인 모드 관리 스크립트
├── pf_mode.service         # systemd 서비스 파일
├── install_mode_manager.sh # 설치 스크립트
├── app_wifi.py            # WiFi 설정 웹서버
├── robot_client.py        # 로봇 클라이언트
└── robot_config.py        # 로봇 설정 파일
```

## 🔧 동작 원리

1. **부팅 시**: `/etc/environment`에서 `MODE` 변수 읽기
2. **AP 모드**: 
   - 가상 AP 인터페이스(`uap0`) 생성
   - hostapd, dnsmasq 서비스 시작
   - `app_wifi.py` 실행
3. **클라이언트 모드**:
   - WiFi 연결 시도
   - 인터넷 연결 확인
   - `robot_client.py` 실행

## 🐛 문제 해결

### 로그 확인
```bash
sudo journalctl -u pf_mode -f
```

### 서비스 상태 확인
```bash
sudo systemctl status pf_mode
```

### 수동 실행
```bash
sudo /home/pi/PF_PythonWebEditor/Client_Code/pf_mode_manager.sh
```

## 📝 주의사항

- AP 모드에서 클라이언트 모드로 전환 시 WiFi 연결이 실패하면 자동으로 AP 모드로 복귀
- 클라이언트 모드에서 인터넷 연결이 실패하면 자동으로 AP 모드로 복귀
- 재부팅 시 `MODE` 환경 변수에 따라 자동으로 해당 모드로 시작
