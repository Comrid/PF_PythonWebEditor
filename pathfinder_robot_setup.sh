#!/bin/bash
set -e

# =============================================================================
# PathFinder 로봇 완전 자동화 설정 스크립트 v3.0
# 라즈베리파이 제로 2용 - 13단계 완전 자동화
# =============================================================================

# --- [0] 초기 변수 설정 ---
ACTUAL_USER=${SUDO_USER:-pi}
AP_IF="uap0"
WAN_IF="wlan0"
GIT_REPO_URL="https://github.com/Comrid/PF_PythonWebEditor.git"
CLONE_DIR="/home/${ACTUAL_USER}/PF_PythonWebEditor"
APP_MAIN_MODULE="app:app"
APP_WIFI_MODULE="Client_Code/app_wifi:app"

# 서버 설정
SERVER_URL="https://pathfinder-kit.duckdns.org"
CANONICAL_HOSTNAME="pathfinder-kit.duckdns.org"

echo "🚀 PathFinder 로봇 완전 자동화 설정을 시작합니다 (User=$ACTUAL_USER)"
echo "📱 라즈베리파이 제로 2용 최적화 버전"
echo "🔗 13단계 완전 자동화 프로세스"
sleep 3

# --- [1] 필수 패키지 설치 ---
echo "[1/16] 필수 패키지를 설치합니다..."
sudo apt-get update -y
echo "iptables-persistent iptables-persistent/autosave_v4 boolean true" | sudo debconf-set-selections
echo "iptables-persistent iptables-persistent/autosave_v6 boolean true" | sudo debconf-set-selections
sudo apt-get install -y hostapd dnsmasq git python3-pip python3-opencv gunicorn iptables-persistent iw iproute2 openssh-server python3-socketio python3-requests curl wget

# --- [2] 블루투스 비활성화 (라즈베리파이 제로 2 최적화) ---
echo "[2/16] 블루투스 기능을 비활성화합니다..."
grep -q "dtoverlay=disable-bt" /boot/config.txt || echo "dtoverlay=disable-bt" | sudo tee -a /boot/config.txt

# --- [3] 사용자 권한 설정 ---
echo "[3/16] 사용자($ACTUAL_USER)에게 네트워크 관리 권한을 부여합니다..."
sudo usermod -a -G netdev ${ACTUAL_USER}

# --- [4] Wi-Fi 하드웨어 준비 ---
echo "[4/16] Wi-Fi 국가 코드를 설정하고 하드웨어를 활성화합니다..."
sudo raspi-config nonint do_wifi_country KR
sudo rfkill unblock wifi
sudo systemctl unmask hostapd

# --- [5] GitHub 리포지토리 클론 ---
echo "[5/16] GitHub에서 최신 소스코드를 다운로드합니다..."
if [ -d "${CLONE_DIR}" ]; then
    echo "기존 디렉토리를 백업합니다: ${CLONE_DIR}_old"
    sudo -u ${ACTUAL_USER} mv ${CLONE_DIR} ${CLONE_DIR}_old_$(date +%s) || true
fi
sudo -u ${ACTUAL_USER} git clone ${GIT_REPO_URL} ${CLONE_DIR}

# --- [6] Python 라이브러리 설치 ---
echo "[6/16] Python 라이브러리를 설치합니다..."
sudo pip3 install flask flask-socketio psutil numpy==1.26.4 python-socketio[client] requests

# --- [7] 기존 Wi-Fi 설정 초기화 ---
echo "[7/16] OS 설치 시 저장된 Wi-Fi 설정을 초기화하여 AP 모드로 부팅을 보장합니다..."
sudo mv /etc/wpa_supplicant/wpa_supplicant.conf /etc/wpa_supplicant/wpa_supplicant.conf.bak_os_install || true
sudo tee /etc/wpa_supplicant/wpa_supplicant.conf > /dev/null << EOF
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
country=KR
EOF
sudo chmod 600 /etc/wpa_supplicant/wpa_supplicant.conf

# --- [8] 가상 AP 인터페이스(uap0) 생성 서비스 등록 ---
echo "[8/16] 가상 AP 인터페이스(uap0) 생성 서비스를 등록합니다..."
sudo tee /etc/systemd/system/wlan-virtual-if.service >/dev/null <<'UNIT'
[Unit]
Description=Create virtual AP interface uap0 on wlan0
After=network-pre.target
Wants=network-pre.target
[Service]
Type=oneshot
ExecStartPre=/usr/sbin/rfkill unblock wifi
ExecStart=/sbin/iw dev wlan0 interface add uap0 type __ap
ExecStart=/sbin/ip link set uap0 up
RemainAfterExit=yes
[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl enable wlan-virtual-if

# --- [9] 가상 AP 인터페이스에 고정 IP 할당 ---
echo "[9/16] 가상 AP 인터페이스(uap0)에 고정 IP(10.42.0.1)를 할당합니다..."
sudo sed -i '/# Pathfinder Kit AP 설정/,/nohook wpa_supplicant/d' /etc/dhcpcd.conf
sudo tee -a /etc/dhcpcd.conf >/dev/null <<EOF

# Pathfinder Kit AP 설정
interface $AP_IF
static ip_address=10.42.0.1/24
nohook wpa_supplicant
EOF

# --- [10] dnsmasq 및 hostapd 설정 (캡티브 포털 포함) ---
echo "[10/16] dnsmasq와 hostapd를 설정합니다..."
sudo mkdir -p /etc/dnsmasq.d
sudo tee /etc/dnsmasq.d/pathfinder-ap.conf >/dev/null <<'DNS'
# PathFinder 캡티브 포털 설정
interface=uap0
dhcp-range=10.42.0.10,10.42.0.200,12h
dhcp-option=3,10.42.0.1
dhcp-option=6,10.42.0.1
# 캡티브 포털을 위한 DNS 리다이렉션
address=/#/10.42.0.1
address=/pathfinder-kit.duckdns.org/10.42.0.1
address=/pathfinder.wifi/10.42.0.1
# 캡티브 포털 감지용
dhcp-option=114,http://10.42.0.1/
DNS
sudo systemctl enable dnsmasq

sudo tee /etc/hostapd/hostapd.conf >/dev/null <<'AP'
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
AP
echo 'DAEMON_CONF="/etc/hostapd/hostapd.conf"' | sudo tee /etc/default/hostapd >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable hostapd

# --- [11] Flask 앱을 위한 systemd 서비스 등록 ---
echo "[11/16] Flask 앱 서비스를 등록합니다..."
# WiFi 설정 앱 서비스 (Client_Code/app_wifi.py) - AP 모드에서 실행
sudo tee /etc/systemd/system/pathfinder-wifi-setup.service >/dev/null <<UNIT
[Unit]
Description=PathFinder WiFi Setup App (캡티브 포털)
After=hostapd.service dnsmasq.service
Wants=hostapd.service dnsmasq.service
[Service]
Type=simple
User=$ACTUAL_USER
Group=netdev
WorkingDirectory=$CLONE_DIR
ExecStart=/usr/bin/python3 Client_Code/app_wifi.py
Restart=on-failure
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT

# 메인 웹 에디터 서비스 (app.py) - 클라이언트 모드에서 실행
sudo tee /etc/systemd/system/pathfinder-webeditor.service >/dev/null <<UNIT
[Unit]
Description=PathFinder Main Web Editor
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=$ACTUAL_USER
Group=netdev
WorkingDirectory=$CLONE_DIR
ExecStart=/usr/bin/python3 app.py
Restart=on-failure
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT

# 로봇 클라이언트 서비스 (Client_Code/robot_client.py) - 클라이언트 모드에서 실행
sudo tee /etc/systemd/system/pathfinder-robot-client.service >/dev/null <<UNIT
[Unit]
Description=PathFinder Robot Client
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=$ACTUAL_USER
Group=netdev
WorkingDirectory=$CLONE_DIR
ExecStart=/usr/bin/python3 Client_Code/robot_client.py
Restart=on-failure
RestartSec=10
[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl enable pathfinder-wifi-setup.service
sudo systemctl enable pathfinder-webeditor.service
sudo systemctl enable pathfinder-robot-client.service

# --- [12] 로봇 설정 파일 생성 ---
echo "[12/16] 로봇 설정 파일을 생성합니다..."
sudo -u ${ACTUAL_USER} tee ${CLONE_DIR}/Client_Code/robot_config.py >/dev/null <<'CONFIG'
# PathFinder 로봇 설정 파일
# 이 파일은 자동으로 생성되며, WiFi 설정 시 업데이트됩니다

# 로봇 ID (서버에 등록된 ID와 동일해야 함)
ROBOT_ID = "robot_not_registered"
ROBOT_NAME = "Robot_Not_Set"

# 서버 URL
SERVER_URL = "https://pathfinder-kit.duckdns.org"

# 하드웨어 활성화 여부
import platform
HARDWARE_ENABLED = platform.system() == "Linux"

# 네트워크 설정
VERIFY_SSL = True
HEARTBEAT_INTERVAL = 10
REQUEST_TIMEOUT = 30
ROBOT_PORT = 5001
CONFIG

# --- [13] 동적 모드 전환 스크립트 생성 ---
echo "[13/16] 동적 네트워크 모드 전환 스크립트를 생성합니다..."

# 모드 전환 메인 스크립트
sudo tee /usr/local/bin/pf-netmode.sh >/dev/null <<'SH'
#!/bin/bash
set -e
MODE="$1" # 'offline' 또는 'online'
DNS_CONF="/etc/dnsmasq.d/pathfinder-ap.conf"
WAN_IF="wlan0"
ROBOT_CONFIG="/home/pi/PF_PythonWebEditor/Client_Code/robot_config.py"

drop_rule() { iptables -t nat -D POSTROUTING -o $WAN_IF -j MASQUERADE 2>/dev/null || true; }
has_rule() { iptables -t nat -C POSTROUTING -o $WAN_IF -j MASQUERADE 2>/dev/null; }
add_rule() { has_rule || iptables -t nat -A POSTROUTING -o $WAN_IF -j MASQUERADE; }

if [ "$MODE" = "offline" ]; then
    # 오프라인: WiFi 설정 앱 실행, 캡티브 포털 활성화
    tee "$DNS_CONF" >/dev/null <<DNS
# PathFinder 캡티브 포털 설정
interface=uap0
dhcp-range=10.42.0.10,10.42.0.200,12h
dhcp-option=3,10.42.0.1
dhcp-option=6,10.42.0.1
# 캡티브 포털을 위한 DNS 리다이렉션
address=/#/10.42.0.1
address=/pathfinder-kit.duckdns.org/10.42.0.1
address=/pathfinder.wifi/10.42.0.1
# 캡티브 포털 감지용
dhcp-option=114,http://10.42.0.1/
DNS
    # 인터넷 공유 비활성화
    drop_rule
    systemctl restart dnsmasq
    systemctl stop pathfinder-webeditor.service || true
    systemctl stop pathfinder-robot-client.service || true
    sleep 2
    systemctl start pathfinder-wifi-setup.service
    echo "[pf-netmode] OFFLINE 모드로 전환 완료 (WiFi 설정 앱 실행)"

elif [ "$MODE" = "online" ]; then
    # 온라인: 메인 에디터 앱 실행, 인터넷 공유 활성화
    tee "$DNS_CONF" >/dev/null <<DNS
# PathFinder 온라인 모드 설정
interface=uap0
dhcp-range=10.42.0.10,10.42.0.200,12h
dhcp-option=3,10.42.0.1
dhcp-option=6,10.42.0.1
address=/pathfinder.kit/10.42.0.1
DNS
    # 인터넷 공유 활성화
    add_rule
    echo 1 > /proc/sys/net/ipv4/ip_forward
    systemctl restart dnsmasq
    systemctl stop pathfinder-wifi-setup.service || true
    sleep 2
    systemctl start pathfinder-webeditor.service
    systemctl start pathfinder-robot-client.service
    echo "[pf-netmode] ONLINE 모드로 전환 완료 (메인 앱 실행)"
fi
iptables-save > /etc/iptables/rules.v4
SH
sudo chmod +x /usr/local/bin/pf-netmode.sh

# --- [14] dhcpcd 훅 및 sudoers 설정 ---
echo "[14/16] dhcpcd 훅과 sudoers 권한을 설정합니다..."

# dhcpcd 훅 스크립트 생성
sudo tee /etc/dhcpcd.exit-hook >/dev/null <<'HOOK'
#!/bin/bash
# 이 훅은 dhcpcd가 인터페이스 상태를 변경할 때마다 호출됩니다.
if [ "$interface" != "wlan0" ]; then
    exit 0
fi
case "$reason" in
    BOUND|RENEW|REBIND|REBOOT)
        # 인터페이스가 IP를 성공적으로 받았을 때 -> online
        /usr/local/bin/pf-netmode.sh online
        ;;
    EXPIRE|FAIL|STOP|RELEASE|NOCARRIER)
        # 인터페이스가 IP를 잃거나 연결이 끊어졌을 때 -> offline
        /usr/local/bin/pf-netmode.sh offline
        ;;
esac
HOOK
sudo chmod +x /etc/dhcpcd.exit-hook

# sudoers 권한 설정
SUDOERS_FILE="/etc/sudoers.d/010_${ACTUAL_USER}-nopasswd-wifi"
echo "${ACTUAL_USER} ALL=(ALL) NOPASSWD: /usr/sbin/wpa_passphrase, /usr/bin/tee -a /etc/wpa_supplicant/wpa_supplicant.conf, /sbin/wpa_cli -i wlan0 reconfigure, /bin/systemctl stop pathfinder-wifi-setup.service, /bin/systemctl start pathfinder-webeditor.service, /bin/systemctl start pathfinder-robot-client.service, /usr/local/bin/pf-netmode.sh" | sudo tee ${SUDOERS_FILE}
sudo chmod 440 ${SUDOERS_FILE}

# IP 포워딩 영구 적용
sudo tee /etc/sysctl.d/99-pathfinder-ipforward.conf >/dev/null <<EOF
net.ipv4.ip_forward=1
EOF
sudo sysctl --system

# --- [15] 네트워크 연결 안정성 설정 ---
echo "[15/16] 네트워크 연결 안정성을 위한 설정을 적용합니다..."

# SSH 연결 유지를 위한 설정
sudo tee /etc/ssh/sshd_config.d/99-pathfinder-keepalive.conf >/dev/null <<EOF
ClientAliveInterval 60
ClientAliveCountMax 3
TCPKeepAlive yes
EOF

# 네트워크 인터페이스 안정성 설정
sudo tee /etc/systemd/network/99-wlan0.link >/dev/null <<EOF
[Match]
Name=wlan0

[Link]
WakeOnLan=off
EOF

# --- [16] 초기 설정 및 재부팅 ---
echo "[16/16] 초기 설정을 완료하고 재부팅합니다..."

# 최초 부팅 시에는 인터넷이 없으므로 offline 모드로 시작
sudo /usr/local/bin/pf-netmode.sh offline

# SSH 서비스 활성화
sudo systemctl enable ssh
sudo systemctl restart ssh

echo ""
echo "✅ PathFinder 로봇 완전 자동화 설정이 완료되었습니다!"
echo ""
echo "📋 설정 완료 요약:"
echo "   • AP 모드: SSID='PF_Kit_Wifi', 비밀번호='12345678'"
echo "   • 캡티브 포털: http://pathfinder-kit.duckdns.org"
echo "   • 로컬 접속: http://10.42.0.1:5000"
echo "   • 서버 URL: ${SERVER_URL}"
echo ""
echo "🔄 13단계 자동화 프로세스:"
echo "   1. 전원 연결 → AP 모드 시작"
echo "   2. 사용자가 'PF_Kit_Wifi'에 연결"
echo "   3. 브라우저에서 'pathfinder-kit.duckdns.org' 접속"
echo "   4. 로봇 이름 + WiFi 정보 입력"
echo "   5. 클라이언트 모드로 자동 전환"
echo "   6. 서버에 로봇 등록"
echo "   7. robot_config.py 자동 업데이트"
echo "   8. robot_client.py 자동 실행"
echo "   9. 이후 부팅 시 자동으로 robot_client.py 실행"
echo "   10. 사용자가 원래 WiFi에 재연결"
echo "   11. 브라우저 새로고침 시 실제 서버 접속"
echo "   12. 계정에 로봇 할당하여 사용"
echo "   13. 완전 자동화 완료!"
echo ""
echo "🔄 시스템을 재부팅합니다..."
echo "   재부팅 후 위의 WiFi에 연결하고 브라우저에서 설정을 진행하세요."
echo ""
sleep 5
sudo reboot
