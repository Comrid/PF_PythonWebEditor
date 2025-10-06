#!/bin/bash
set -e

ACTUAL_USER=${SUDO_USER:-pi}
WAN_IF="wlan0"
AP_SSID="PF_Kit_Wifi"
AP_PASSWORD="12345678"
COUNTRY_CODE="KR"
GIT_REPO_URL="https://github.com/Comrid/PF_PythonWebEditor.git"
CLONE_DIR="/home/${ACTUAL_USER}/PF_PythonWebEditor"
APP_MAIN_MODULE="app:app"
APP_WIFI_MODULE="app_wifi:app"

echo "🚀 Pathfinder 순차적 모드 전환 (wlan0 직접 사용) 설정을 시작합니다 (User=$ACTUAL_USER)"
sleep 2

# --- [1] 필수 패키지 설치 ---
echo "[1/11] 필수 패키지를 설치합니다..."
sudo apt-get update
echo "iptables-persistent iptables-persistent/autosave_v4 boolean true" | sudo debconf-set-selections
echo "iptables-persistent iptables-persistent/autosave_v6 boolean true" | sudo debconf-set-selections
sudo apt-get install -y hostapd dnsmasq git python3-pip python3-opencv iptables-persistent iw iproute2 openssh-server

# --- [2] 블루투스 비활성화(부트로더 레벨 비활성화) ---
echo "[2/11] 블루투스 기능을 비활성화합니다..."
grep -q "dtoverlay=disable-bt" /boot/config.txt || echo "dtoverlay=disable-bt" | sudo tee -a /boot/config.txt

# --- [3] 사용자 권한 설정 ---
echo "[3/11] 사용자($ACTUAL_USER)에게 네트워크 관리 그룹(netdev) 권한을 부여합니다..."
sudo usermod -a -G netdev ${ACTUAL_USER}

# --- [4] Wi-Fi 하드웨어 준비 ---
echo "[4/11] Wi-Fi 국가 코드를 설정하고 하드웨어를 활성화합니다..."
sudo raspi-config nonint do_wifi_country KR
sudo rfkill unblock wifi
sudo systemctl unmask hostapd

# --- [5] GitHub 리포지토리 클론 ---
echo "[5/11] GitHub에서 최신 소스코드를 다운로드합니다..."
sudo -u ${ACTUAL_USER} git clone ${GIT_REPO_URL} ${CLONE_DIR}

# --- [6] Python 라이브러리 설치 ---
echo "[6/11] Python 라이브러리를 설치합니다..."
sudo pip3 install flask flask-socketio numpy==1.26.4

# --- [7] 기존 Wi-Fi 설정 초기화 ---
echo "[7/11] OS 설치 시 저장된 Wi-Fi 설정을 초기화하여 AP 모드로 부팅을 보장합니다..."
sudo rm /etc/wpa_supplicant/wpa_supplicant.conf || true
sudo tee /etc/wpa_supplicant/wpa_supplicant.conf > /dev/null << EOF
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
country=KR
EOF
sudo chmod 600 /etc/wpa_supplicant/wpa_supplicant.conf

# --- [8] wlan0에 고정 IP 할당 (AP 모드용) ---
echo "[8/11] wlan0에 고정 IP(10.42.0.1)를 할당합니다..."
sudo tee -a /etc/dhcpcd.conf >/dev/null << EOF
# Pathfinder Kit AP 설정
interface $WAN_IF
static ip_address=10.42.0.1/24
nohook wpa_supplicant
EOF

# --- [9] dnsmasq 및 hostapd 설정 ---
echo "[9/11] dnsmasq와 hostapd를 설정합니다..."
sudo mkdir -p /etc/dnsmasq.d
sudo tee /etc/dnsmasq.d/pathfinder-ap.conf >/dev/null << EOF
# 초기 설정은 offline 모드 (캡티브 포털)로 시작됩니다.
interface=wlan0
dhcp-range=10.42.0.10,10.42.0.200,12h
dhcp-option=3,10.42.0.1
dhcp-option=6,10.42.0.1
address=/pathfinder-kit.duckdns.org/10.42.0.1
address=/#/10.42.0.1
dhcp-option=114,http://10.42.0.1/
EOF
sudo systemctl enable dnsmasq

sudo tee /etc/hostapd/hostapd.conf >/dev/null << EOF
interface=wlan0
driver=nl80211
ssid=$AP_SSID
hw_mode=g
channel=6
ht_capab=[SHORT-GI-20]
wmm_enabled=1 # Wifi Multi Media
beacon_int=100
dtim_period=1 # 1이면 실시간, 2이면 절전
max_num_sta=8
# 안정성 설정
auth_algs=1
ignore_broadcast_ssid=0
macaddr_acl=0
# 보안 설정
wpa=2
wpa_passphrase=$AP_PASSWORD
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
country_code=KR
EOF
echo 'DAEMON_CONF="/etc/hostapd/hostapd.conf"' | sudo tee /etc/default/hostapd >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable hostapd

# --- [10] 로봇 클라이언트용 systemd 서비스 등록 ---
echo "[10/11] 로봇 클라이언트용 서비스를 등록합니다..."
# 1. WiFi 설정 서비스 (app_wifi.py)
sudo tee /etc/systemd/system/wifi_setup.service >/dev/null <<UNIT
[Unit]
Description=Pathfinder WiFi Setup App
After=hostapd.service dnsmasq.service
Wants=hostapd.service dnsmasq.service
[Service]
Type=simple
User=$ACTUAL_USER
Group=netdev
WorkingDirectory=$CLONE_DIR/Client_Code
ExecStart=/usr/bin/python3 app_wifi.py
Restart=on-failure
[Install]
WantedBy=multi-user.target
UNIT
# 2. 로봇 클라이언트 서비스 (robot_client.py)
sudo tee /etc/systemd/system/robot_client.service >/dev/null <<UNIT
[Unit]
Description=Pathfinder Robot Client
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=$ACTUAL_USER
Group=netdev
WorkingDirectory=$CLONE_DIR/Client_Code
ExecStart=/usr/bin/python3 robot_client.py
Restart=on-failure
[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl enable wifi_setup.service
sudo systemctl enable robot_client.service

# --- [11] 동적 모드 전환 스크립트 생성 ---
echo "[11/11] 동적 네트워크 모드 전환 스크립트를 생성합니다..."

# 1. 모드 전환 메인 스크립트 (pf-netmode.sh)
sudo tee /usr/local/bin/pf-netmode.sh >/dev/null << EOF
#!/bin/bash
set -e
# 환경 변수 파일에서 모드 읽기
source /etc/pf_env

DNS_CONF="/etc/dnsmasq.d/pathfinder-ap.conf"
WAN_IF="wlan0"

drop_rule() { iptables -t nat -D POSTROUTING -o $WAN_IF -j MASQUERADE 2>/dev/null || true; }
has_rule() { iptables -t nat -C POSTROUTING -o $WAN_IF -j MASQUERADE 2>/dev/null; }
add_rule() { has_rule || iptables -t nat -A POSTROUTING -o $WAN_IF -j MASQUERADE; }

if [ "\$MODE" = "AP" ]; then
    tee $DNS_CONF >/dev/null <<DNS
interface=wlan0
dhcp-range=10.42.0.10,10.42.0.200,12h
dhcp-option=3,10.42.0.1
dhcp-option=6,10.42.0.1
address=/pathfinder-kit.duckdns.org/10.42.0.1
address=/#/10.42.0.1
dhcp-option=114,http://10.42.0.1/
DNS
    # 인터넷 공유 비활성화
    drop_rule
    systemctl restart dnsmasq
    systemctl stop robot_client.service || true
    sleep 1
    systemctl start wifi_setup.service
    echo "[pf-netmode] AP 모드로 전환 완료 (app_wifi.py 실행)"

elif [ "\$MODE" = "CLIENT" ]; then
    # AP 모드 중지
    systemctl stop hostapd || true
    systemctl stop dnsmasq || true

    # wlan0 인터페이스 재시작
    ip link set wlan0 down
    ip link set wlan0 up

    # wpa_supplicant 시작 및 재설정
    systemctl start wpa_supplicant
    systemctl enable wpa_supplicant

    # DNS 설정 (클라이언트 모드용)
    tee $DNS_CONF >/dev/null <<DNS
interface=wlan0
dhcp-range=10.42.0.10,10.42.0.200,12h
dhcp-option=3,10.42.0.1
dhcp-option=6,10.42.0.1
address=/pathfinder-kit.duckdns.org/10.42.0.1
DNS
    # 인터넷 공유 활성화
    add_rule
    echo 1 > /proc/sys/net/ipv4/ip_forward
    systemctl restart dnsmasq
    systemctl stop wifi_setup.service || true
    sleep 1
    systemctl start robot_client.service
    echo "[pf-netmode] CLIENT 모드로 전환 완료 (robot_client.py 실행)"
fi
iptables-save > /etc/iptables/rules.v4
EOF
sudo chmod +x /usr/local/bin/pf-netmode.sh

# --- sudoers 및 초기 모드 설정 ---
echo "sudoers 권한과 초기 모드를 설정합니다..."
SUDOERS_FILE="/etc/sudoers.d/010_${ACTUAL_USER}-nopasswd-wifi"
echo "${ACTUAL_USER} ALL=(ALL) NOPASSWD: /usr/sbin/wpa_passphrase, /usr/bin/tee -a /etc/wpa_supplicant/wpa_supplicant.conf, /sbin/wpa_cli -i wlan0 reconfigure, /bin/systemctl stop wifi_setup.service, /bin/systemctl start robot_client.service" | sudo tee ${SUDOERS_FILE}
sudo chmod 440 ${SUDOERS_FILE}

# IP 포워딩 영구 적용
sudo tee /etc/sysctl.d/99-pathfinder-ipforward.conf >/dev/null <<EOF
net.ipv4.ip_forward=1
EOF
sudo sysctl --system

# 최초 부팅 시에는 인터넷이 없으므로 AP 모드로 시작
echo "MODE=AP" | sudo tee /etc/pf_env >/dev/null
sudo /usr/local/bin/pf-netmode.sh

echo "✅ 모든 설정이 완료되었습니다! 시스템을 재부팅합니다."
echo "재부팅 후 SSID='$AP_SSID'에 접속하여 'http://pathfinder-kit.duckdns.org'로 접속하세요."
sudo reboot
