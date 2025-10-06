#!/bin/bash
# PathFinder 모드 관리자 설치 스크립트

set -e

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_info "PathFinder 모드 관리자 설치를 시작합니다..."

# 1. 스크립트 실행 권한 부여
log_info "스크립트 실행 권한 부여 중..."
chmod +x "$(dirname "$0")/pf_mode_manager.sh"
chmod +x "$(dirname "$0")/install_mode_manager.sh"

# 2. systemd 서비스 파일 복사
log_info "systemd 서비스 파일 설치 중..."
sudo cp "$(dirname "$0")/pf_mode.service" /etc/systemd/system/

# 3. 서비스 활성화
log_info "서비스 활성화 중..."
sudo systemctl daemon-reload
sudo systemctl enable pf_mode.service

# 4. 환경 변수 초기 설정 (AP 모드)
log_info "환경 변수 초기 설정 중..."
echo "MODE=AP" | sudo tee /etc/environment

# 5. 필수 패키지 설치 확인
log_info "필수 패키지 설치 확인 중..."
sudo apt-get update
sudo apt-get install -y hostapd dnsmasq iw iproute2

# 6. hostapd 설정 파일 생성
log_info "hostapd 설정 파일 생성 중..."
sudo tee /etc/hostapd/hostapd.conf >/dev/null <<'EOF'
interface=uap0
driver=nl80211
ssid=PF_Kit_Wifi
hw_mode=g
channel=6
wmm_enabled=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=12345678
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
country_code=KR
EOF

echo 'DAEMON_CONF="/etc/hostapd/hostapd.conf"' | sudo tee /etc/default/hostapd

# 7. dnsmasq 설정 파일 생성
log_info "dnsmasq 설정 파일 생성 중..."
sudo mkdir -p /etc/dnsmasq.d
sudo tee /etc/dnsmasq.d/pathfinder-ap.conf >/dev/null <<'EOF'
interface=uap0
dhcp-range=10.42.0.10,10.42.0.200,12h
dhcp-option=3,10.42.0.1
dhcp-option=6,10.42.0.1
address=/pathfinder.wifi/10.42.0.1
address=/#/10.42.0.1
dhcp-option=114,http://10.42.0.1/
EOF

# 8. dhcpcd 설정에 AP 인터페이스 추가
log_info "dhcpcd 설정 업데이트 중..."
sudo sed -i '/# Pathfinder Kit AP 설정/,/nohook wpa_supplicant/d' /etc/dhcpcd.conf
sudo tee -a /etc/dhcpcd.conf >/dev/null <<EOF

# Pathfinder Kit AP 설정
interface uap0
static ip_address=10.42.0.1/24
nohook wpa_supplicant
EOF

# 9. IP 포워딩 설정
log_info "IP 포워딩 설정 중..."
sudo tee /etc/sysctl.d/99-pathfinder-ipforward.conf >/dev/null <<EOF
net.ipv4.ip_forward=1
EOF
sudo sysctl --system

# 10. iptables 규칙 저장
log_info "iptables 규칙 저장 중..."
sudo iptables-save > /etc/iptables/rules.v4

log_success "PathFinder 모드 관리자 설치 완료!"
log_info "재부팅 후 자동으로 AP 모드로 시작됩니다."
log_info "모드 변경 명령어:"
log_info "  AP 모드: echo 'MODE=AP' | sudo tee /etc/environment && sudo systemctl restart pf_mode"
log_info "  클라이언트 모드: echo 'MODE=CLIENT' | sudo tee /etc/environment && sudo systemctl restart pf_mode"
