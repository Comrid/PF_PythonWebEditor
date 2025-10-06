#!/bin/bash
# PathFinder 모드 관리 스크립트
# 환경 변수 MODE에 따라 AP 모드 또는 클라이언트 모드로 전환

set -e

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 환경 변수 읽기
if [ -f /etc/environment ]; then
    source /etc/environment
else
    log_error "/etc/environment 파일을 찾을 수 없습니다."
    exit 1
fi

# MODE 변수 확인
if [ -z "$MODE" ]; then
    log_error "MODE 환경 변수가 설정되지 않았습니다."
    exit 1
fi

log_info "현재 모드: $MODE"

# 현재 디렉토리 설정
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# AP 모드 설정 함수
setup_ap_mode() {
    log_info "AP 모드로 설정 중..."
    
    # 1. 기존 WiFi 연결 해제
    log_info "기존 WiFi 연결 해제 중..."
    sudo wpa_cli -i wlan0 disconnect 2>/dev/null || true
    sudo wpa_cli -i wlan0 remove_network all 2>/dev/null || true
    
    # 2. 가상 AP 인터페이스 생성 (이미 있으면 무시)
    log_info "가상 AP 인터페이스 생성 중..."
    if ! ip link show uap0 >/dev/null 2>&1; then
        sudo iw dev wlan0 interface add uap0 type __ap
        sudo ip link set uap0 up
        log_success "가상 AP 인터페이스(uap0) 생성 완료"
    else
        log_info "가상 AP 인터페이스(uap0)가 이미 존재합니다."
    fi
    
    # 3. AP 인터페이스에 고정 IP 할당
    log_info "AP 인터페이스에 고정 IP 할당 중..."
    sudo ip addr add 10.42.0.1/24 dev uap0 2>/dev/null || true
    
    # 4. hostapd 설정 확인 및 시작
    log_info "hostapd 서비스 시작 중..."
    sudo systemctl stop hostapd 2>/dev/null || true
    sudo systemctl start hostapd
    sudo systemctl enable hostapd
    
    # 5. dnsmasq 설정 확인 및 시작
    log_info "dnsmasq 서비스 시작 중..."
    sudo systemctl stop dnsmasq 2>/dev/null || true
    sudo systemctl start dnsmasq
    sudo systemctl enable dnsmasq
    
    # 6. IP 포워딩 비활성화 (오프라인 모드)
    log_info "IP 포워딩 비활성화 중..."
    echo 0 > /proc/sys/net/ipv4/ip_forward
    sudo iptables -t nat -D POSTROUTING -o wlan0 -j MASQUERADE 2>/dev/null || true
    
    # 7. WiFi 설정 앱 시작
    log_info "WiFi 설정 앱 시작 중..."
    sudo pkill -f "app_wifi.py" 2>/dev/null || true
    sleep 1
    cd "$PROJECT_DIR"
    sudo -u pi python3 "$SCRIPT_DIR/app_wifi.py" &
    
    log_success "AP 모드 설정 완료"
    log_info "SSID: PF_Kit_Wifi"
    log_info "IP: 10.42.0.1"
    log_info "웹사이트: http://pathfinder.wifi 또는 http://10.42.0.1:5000"
}

# 클라이언트 모드 설정 함수
setup_client_mode() {
    log_info "클라이언트 모드로 설정 중..."
    
    # 1. AP 모드 서비스 중지
    log_info "AP 모드 서비스 중지 중..."
    sudo systemctl stop hostapd 2>/dev/null || true
    sudo systemctl stop dnsmasq 2>/dev/null || true
    sudo pkill -f "app_wifi.py" 2>/dev/null || true
    
    # 2. WiFi 인터페이스 재시작
    log_info "WiFi 인터페이스 재시작 중..."
    sudo ip link set wlan0 down
    sleep 2
    sudo ip link set wlan0 up
    sleep 2
    
    # 3. WiFi 연결 시도
    log_info "WiFi 연결 시도 중..."
    sudo wpa_cli -i wlan0 reconfigure
    sleep 5
    
    # 4. IP 주소 확인
    WLAN_IP=$(ip addr show wlan0 | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)
    if [ -n "$WLAN_IP" ] && [ "$WLAN_IP" != "10.42.0.1" ]; then
        log_success "WiFi 연결 성공: $WLAN_IP"
        
        # 5. 인터넷 연결 확인
        if ping -c 1 8.8.8.8 >/dev/null 2>&1; then
            log_success "인터넷 연결 확인됨"
            
            # 6. IP 포워딩 활성화 (온라인 모드)
            log_info "IP 포워딩 활성화 중..."
            echo 1 > /proc/sys/net/ipv4/ip_forward
            sudo iptables -t nat -A POSTROUTING -o wlan0 -j MASQUERADE 2>/dev/null || true
            
            # 7. 로봇 클라이언트 시작
            log_info "로봇 클라이언트 시작 중..."
            sudo pkill -f "robot_client.py" 2>/dev/null || true
            sleep 1
            cd "$PROJECT_DIR"
            sudo -u pi python3 "$SCRIPT_DIR/robot_client.py" &
            
            log_success "클라이언트 모드 설정 완료"
            log_info "로봇이 서버에 연결되었습니다."
        else
            log_warning "인터넷 연결 실패. AP 모드로 복귀합니다."
            setup_ap_mode
        fi
    else
        log_warning "WiFi 연결 실패. AP 모드로 복귀합니다."
        setup_ap_mode
    fi
}

# 메인 실행 로직
case "$MODE" in
    "AP")
        log_info "AP 모드로 시작합니다."
        setup_ap_mode
        ;;
    "CLIENT")
        log_info "클라이언트 모드로 시작합니다."
        setup_client_mode
        ;;
    *)
        log_error "알 수 없는 모드: $MODE"
        log_info "사용 가능한 모드: AP, CLIENT"
        exit 1
        ;;
esac

log_success "PathFinder 모드 설정 완료!"
