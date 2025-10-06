#!/bin/bash
set -e

ACTUAL_USER=${SUDO_USER:-pi}
WAN_IF="wlan0"
AP_IF="uap0"
GIT_REPO_URL="https://github.com/Comrid/PF_PythonWebEditor.git"
CLONE_DIR="/home/${ACTUAL_USER}/PF_PythonWebEditor"
APP_MAIN_MODULE="app:app"
APP_WIFI_MODULE="app_wifi:app"

echo "🚀 Pathfinder 동시 AP+클라이언트 모드 (dhcpcd-hook 안정 버전) 설정을 시작합니다 (User=$ACTUAL_USER)"
sleep 2

# --- [1] 필수 패키지 설치 ---
echo "[1/13] 필수 패키지를 설치합니다..."
sudo apt-get update
echo "iptables-persistent iptables-persistent/autosave_v4 boolean true" | sudo debconf-set-selections
echo "iptables-persistent iptables-persistent/autosave_v6 boolean true" | sudo debconf-set-selections
sudo apt-get install -y hostapd dnsmasq git python3-pip python3-opencv gunicorn iptables-persistent iw iproute2 openssh-server

# --- [2] 블루투스 비활성화(부트로더 레벨 비활성화) ---
echo "[2/13] 블루투스 기능을 비활성화합니다..."
grep -q "dtoverlay=disable-bt" /boot/config.txt || echo "dtoverlay=disable-bt" | sudo tee -a /boot/config.txt

# --- [3] 사용자 권한 설정 ---
echo "[3/13] 사용자($ACTUAL_USER)에게 네트워크 관리 그룹(netdev) 권한을 부여합니다..."
sudo usermod -a -G netdev ${ACTUAL_USER}

# --- [4] Wi-Fi 하드웨어 준비 ---
echo "[4/13] Wi-Fi 국가 코드를 설정하고 하드웨어를 활성화합니다..."
sudo raspi-config nonint do_wifi_country KR
sudo rfkill unblock wifi
sudo systemctl unmask hostapd

# --- [5] GitHub 리포지토리 클론 ---
echo "[5/13] GitHub에서 최신 소스코드를 다운로드합니다..."
sudo -u ${ACTUAL_USER} git clone ${GIT_REPO_URL} ${CLONE_DIR}

# --- [6] Python 라이브러리 설치 ---
echo "[6/13] Python 라이브러리를 설치합니다..."
sudo pip3 install flask flask-socketio numpy==1.26.4

# --- [7] 기존 Wi-Fi 설정 초기화 ---
echo "[7/13] OS 설치 시 저장된 Wi-Fi 설정을 초기화하여 AP 모드로 부팅을 보장합니다..."
sudo rm /etc/wpa_supplicant/wpa_supplicant.conf || true
sudo tee /etc/wpa_supplicant/wpa_supplicant.conf > /dev/null << EOF
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
country=KR
EOF
sudo chmod 600 /etc/wpa_supplicant/wpa_supplicant.conf

# --- [8] 가상 AP 인터페이스(uap0) 생성 서비스 등록 ---
echo "[8/13] 가상 AP 인터페이스(uap0) 생성 서비스를 등록합니다..."
sudo tee /etc/systemd/system/wlan-virtual-if.service >/dev/null <<'UNIT'
[Unit]
Description=Create virtual AP interface uap0 on wlan0
After=network-pre.target
Wants=network-pre.target
[Service]
Type=oneshot
ExecStart=/sbin/iw dev wlan0 interface add uap0 type __ap
ExecStart=/sbin/ip link set uap0 up
RemainAfterExit=yes
[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl enable wlan-virtual-if

# --- [9] 가상 AP 인터페이스에 고정 IP 할당 ---
echo "[9/13] 가상 AP 인터페이스(uap0)에 고정 IP(10.42.0.1)를 할당합니다..."
sudo sed -i '/# Pathfinder Kit AP 설정/,/nohook wpa_supplicant/d' /etc/dhcpcd.conf
sudo tee -a /etc/dhcpcd.conf >/dev/null <<EOF

# Pathfinder Kit AP 설정
interface $AP_IF
static ip_address=10.42.0.1/24
nohook wpa_supplicant
EOF

# --- [10] dnsmasq 및 hostapd 설정 ---
echo "[10/13] dnsmasq와 hostapd를 설정합니다..."
sudo mkdir -p /etc/dnsmasq.d
sudo tee /etc/dnsmasq.d/pathfinder-ap.conf >/dev/null <<'DNS'
# 초기 설정은 offline 모드 (캡티브 포털)로 시작됩니다.
interface=uap0
dhcp-range=10.42.0.10,10.42.0.200,12h
dhcp-option=3,10.42.0.1
dhcp-option=6,10.42.0.1
address=/pathfinder.wifi/10.42.0.1
address=/#/10.42.0.1
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

# --- [11] Flask 앱을 위한 두 개의 systemd 서비스 등록 (Gunicorn 사용) ---
echo "[11/13] Gunicorn을 사용하여 Flask 앱 서비스를 등록합니다..."
# 1. 메인 웹 에디터 서비스 (app.py)
sudo tee /etc/systemd/system/webeditor.service >/dev/null <<UNIT
[Unit]
Description=Pathfinder Main Web Editor (Gunicorn)
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=$ACTUAL_USER
Group=netdev
WorkingDirectory=$CLONE_DIR
ExecStart=/usr/bin/gunicorn --workers 3 --bind 0.0.0.0:5000 $APP_MAIN_MODULE
Restart=on-failure
[Install]
WantedBy=multi-user.target
UNIT
# 2. Wi-Fi 설정 앱 서비스 (app_wifi.py)
sudo tee /etc/systemd/system/wifi_setup.service >/dev/null <<UNIT
[Unit]
Description=Pathfinder WiFi Setup App (Gunicorn)
After=hostapd.service dnsmasq.service
Wants=hostapd.service dnsmasq.service
[Service]
Type=simple
User=$ACTUAL_USER
Group=netdev
WorkingDirectory=$CLONE_DIR
ExecStart=/usr/bin/gunicorn --workers 3 --bind 0.0.0.0:5000 $APP_WIFI_MODULE
Restart=on-failure
[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl enable webeditor.service
sudo systemctl enable wifi_setup.service

# --- [12] 동적 모드 전환 스크립트 및 dhcpcd 훅 생성 ---
echo "[12/13] 동적 네트워크 모드 전환 스크립트와 dhcpcd 훅을 생성합니다..."

# 1. 모드 전환 메인 스크립트 (pf-netmode.sh)
sudo tee /usr/local/bin/pf-netmode.sh >/dev/null <<'SH'
#!/bin/bash
set -e
MODE="$1" # 'offline' 또는 'online'
DNS_CONF="/etc/dnsmasq.d/pathfinder-ap.conf"
WAN_IF="wlan0"

drop_rule() { iptables -t nat -D POSTROUTING -o $WAN_IF -j MASQUERADE 2>/dev/null || true; }
has_rule() { iptables -t nat -C POSTROUTING -o $WAN_IF -j MASQUERADE 2>/dev/null; }
add_rule() { has_rule || iptables -t nat -A POSTROUTING -o $WAN_IF -j MASQUERADE; }

if [ "$MODE" = "offline" ]; then
    # 오프라인: Wi-Fi 설정 앱 실행, 캡티브 포털 활성화
    tee "$DNS_CONF" >/dev/null <<DNS
interface=uap0
dhcp-range=10.42.0.10,10.42.0.200,12h
dhcp-option=3,10.42.0.1
dhcp-option=6,10.42.0.1
address=/pathfinder.wifi/10.42.0.1
address=/#/10.42.0.1
dhcp-option=114,http://10.42.0.1/
DNS
    # 인터넷 공유 비활성화
    drop_rule
    systemctl restart dnsmasq
    systemctl stop webeditor.service || true
    sleep 1 
    systemctl start wifi_setup.service
    echo "[pf-netmode] OFFLINE 모드로 전환 완료 (app_wifi.py 실행)"

elif [ "$MODE" = "online" ]; then
    # 온라인: 메인 에디터 앱 실행, 인터넷 공유 활성화
    tee "$DNS_CONF" >/dev/null <<DNS
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
    systemctl stop wifi_setup.service || true
    sleep 1
    systemctl start webeditor.service
    echo "[pf-netmode] ONLINE 모드로 전환 완료 (app.py 실행)"
fi
iptables-save > /etc/iptables/rules.v4
SH
sudo chmod +x /usr/local/bin/pf-netmode.sh

# 2. dhcpcd 훅 스크립트 생성
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

# --- [13] sudoers 및 초기 모드 설정 ---
echo "[13/13] sudoers 권한과 초기 모드를 설정합니다..."
SUDOERS_FILE="/etc/sudoers.d/010_${ACTUAL_USER}-nopasswd-wifi"
echo "${ACTUAL_USER} ALL=(ALL) NOPASSWD: /usr/sbin/wpa_passphrase, /usr/bin/tee -a /etc/wpa_supplicant/wpa_supplicant.conf, /sbin/wpa_cli -i wlan0 reconfigure, /bin/systemctl stop wifi_setup.service, /bin/systemctl start webeditor.service" | sudo tee ${SUDOERS_FILE}
sudo chmod 440 ${SUDOERS_FILE}

# IP 포워딩 영구 적용
sudo tee /etc/sysctl.d/99-pathfinder-ipforward.conf >/dev/null <<EOF
net.ipv4.ip_forward=1
EOF
sudo sysctl --system

# 최초 부팅 시에는 인터넷이 없으므로 offline 모드로 시작
sudo /usr/local/bin/pf-netmode.sh offline

echo "✅ 모든 설정이 완료되었습니다! 시스템을 재부팅합니다."
echo "재부팅 후 SSID='PF_Kit_Wifi'에 접속하여 'http://pathfinder.wifi'로 접속하세요."
sudo reboot