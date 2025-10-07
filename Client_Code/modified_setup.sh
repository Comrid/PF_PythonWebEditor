#!/bin/bash
set -e

# --- 변수 설정 ---
ACTUAL_USER=${SUDO_USER:-pi}
WAN_IF="wlan0"
AP_SSID="PF_Kit_Wifi"
AP_PASSWORD="12345678"
GIT_REPO_URL="https://github.com/Comrid/PF_PythonWebEditor.git"
CLONE_DIR="/home/${ACTUAL_USER}/PF_PythonWebEditor"

echo "🚀 (Bookworm 버전) Pathfinder 순차적 모드 전환 설정을 시작합니다 (User=$ACTUAL_USER)"
sleep 2

# --- [1] 필수 패키지 설치 ---
echo "[1/12] 필수 패키지를 설치합니다 (NetworkManager 중심)..."
sudo apt-get update
echo "iptables-persistent iptables-persistent/autosave_v4 boolean true" | sudo debconf-set-selections
echo "iptables-persistent iptables-persistent/autosave_v6 boolean true" | sudo debconf-set-selections
sudo apt-get install -y git python3-pip python3-opencv iw iproute2 network-manager iptables-persistent

# --- [2] 블루투스 비활성화 ---
echo "[2/12] 블루투스 기능을 비활성화합니다..."
grep -q "dtoverlay=disable-bt" /boot/config.txt || echo "dtoverlay=disable-bt" | sudo tee -a /boot/config.txt

# --- [3] 사용자 권한 설정 ---
echo "[3/12] 사용자($ACTUAL_USER)에게 네트워크 관리 그룹(netdev) 권한을 부여합니다..."
sudo usermod -a -G netdev ${ACTUAL_USER}

# --- [4] GitHub 리포지토리 클론 ---
echo "[4/12] GitHub에서 최신 소스코드를 다운로드합니다..."
if [ -d "$CLONE_DIR" ]; then
    sudo rm -rf "$CLONE_DIR"
fi
sudo -u ${ACTUAL_USER} git clone ${GIT_REPO_URL} ${CLONE_DIR}

# --- [5] Python 라이브러리 설치 ---
echo "[5/12] Python 라이브러리를 설치합니다..."
sudo pip3 install flask flask-socketio numpy==1.26.4 --break-system-packages

# --- [6] NetworkManager 프로필 생성 및 초기화 ---
echo "[6/12] NetworkManager 영구 네트워크 프로필을 생성 및 초기화합니다..."

# 6-1. 기존에 존재할 수 있는 모든 Wi-Fi 클라이언트 연결 프로필을 삭제하여 AP 모드로 부팅되도록 보장합니다.
# 'nmcli -t -f NAME,TYPE con show'로 모든 연결을 가져와 'wifi' 타입인 것만 반복 처리
while IFS= read -r line; do
    # 'preconfigured' 또는 사용자가 추가했을 수 있는 다른 Wi-Fi 프로필을 삭제
    con_name=$(echo "$line" | cut -d: -f1)
    if [ "$con_name" != "" ] && [ "$con_name" != "Pathfinder-AP" ]; then
        echo "기존 Wi-Fi 프로필 '$con_name'을(를) 삭제합니다."
        sudo nmcli con delete "$con_name" || true
    fi
done <<< "$(nmcli -t -f NAME,TYPE con show | grep ':802-11-wireless')"


# 6-2. 영구적인 AP 모드 프로필을 생성합니다.
sudo nmcli connection add type wifi ifname ${WAN_IF} con-name "Pathfinder-AP" autoconnect no mode ap ssid "${AP_SSID}"
sudo nmcli connection modify "Pathfinder-AP" 802-11-wireless-security.key-mgmt wpa-psk
sudo nmcli connection modify "Pathfinder-AP" 802-11-wireless-security.psk "${AP_PASSWORD}"
sudo nmcli connection modify "Pathfinder-AP" ipv4.method shared
sudo nmcli connection modify "Pathfinder-AP" ipv4.addresses 10.42.0.1/24

# --- [7] 로봇 클라이언트용 systemd 서비스 등록 ---
echo "[7/12] 로봇 클라이언트용 서비스를 등록합니다..."

# WiFi 설정 서비스 (AP 모드에서 실행)
sudo tee /etc/systemd/system/wifi_setup.service >/dev/null <<UNIT
[Unit]
Description=Pathfinder WiFi Setup App (Bookworm)
After=pf-netmode.service
[Service]
Type=simple
User=${ACTUAL_USER}
Group=netdev
WorkingDirectory=${CLONE_DIR}/Client_Code
ExecStart=/usr/bin/python3 app_wifi.py
Restart=on-failure
[Install]
WantedBy=multi-user.target
UNIT

# 로봇 클라이언트 서비스 (Client 모드에서 실행)
sudo tee /etc/systemd/system/robot_client.service >/dev/null <<UNIT
[Unit]
Description=Pathfinder Robot Client (Bookworm)
After=pf-netmode.service
[Service]
Type=simple
User=${ACTUAL_USER}
Group=netdev
WorkingDirectory=${CLONE_DIR}/Client_Code
ExecStart=/usr/bin/python3 robot_client.py
Restart=on-failure
[Install]
WantedBy=multi-user.target
UNIT

# --- [8] 동적 모드 전환 스크립트 생성 ---
echo "[8/12] 캡티브 포털 기능이 포함된 동적 모드 전환 스크립트를 생성합니다..."
sudo tee /usr/local/bin/pf-netmode-bookworm.sh >/dev/null << 'EOF'
#!/bin/bash
set -e

# /etc/pf_env 파일이 없으면 AP 모드를 기본값으로 사용
if [ ! -f /etc/pf_env ]; then
    echo "MODE=AP" | sudo tee /etc/pf_env > /dev/null
fi
source /etc/pf_env

# 현재 wlan0 인터페이스에서 활성화된 연결을 가져옴 (없으면 공백)
CURRENT_CONNECTION=$(nmcli -t -f NAME,DEVICE con show --active | grep 'wlan0' | cut -d: -f1)

if [ "$MODE" = "AP" ]; then
    echo "[pf-netmode] AP 모드로 전환합니다..."
    # 1. 다른 Wi-Fi 연결이 활성화되어 있다면 비활성화
    if [[ "$CURRENT_CONNECTION" && "$CURRENT_CONNECTION" != "Pathfinder-AP" ]]; then
        sudo nmcli con down "$CURRENT_CONNECTION"
    fi

    # 2. AP 프로필 활성화
    sudo nmcli con up "Pathfinder-AP"

    # 3. 캡티브 포털을 위한 방화벽 규칙 설정
    echo "[pf-netmode] 캡티브 포털을 위한 방화벽을 설정합니다..."
    sudo iptables -F
    sudo iptables -t nat -F
    # NetworkManager의 내장 DHCP/DNS(포트 53)와 웹서버(포트 5000) 허용
    sudo iptables -A INPUT -i wlan0 -p udp --dport 53 -j ACCEPT
    sudo iptables -A INPUT -i wlan0 -p tcp --dport 5000 -j ACCEPT
    # HTTP(80) 요청을 웹서버(5000)로 리디렉션
    sudo iptables -t nat -A PREROUTING -i wlan0 -p tcp --dport 80 -j REDIRECT --to-port 5000

    # 4. 서비스 전환
    sudo systemctl stop robot_client.service || true
    sudo systemctl start wifi_setup.service
    echo "[pf-netmode] AP 모드 및 캡티브 포털 활성화 완료."

elif [ "$MODE" = "CLIENT" ]; then
    echo "[pf-netmode] CLIENT 모드로 전환합니다..."
    # 1. AP 프로필 비활성화
    if [ "$CURRENT_CONNECTION" = "Pathfinder-AP" ]; then
        sudo nmcli con down "Pathfinder-AP"
    fi
    
    # 2. 캡티브 포털 방화벽 규칙 초기화
    echo "[pf-netmode] AP 모드 방화벽 규칙을 초기화합니다..."
    sudo iptables -F
    sudo iptables -t nat -F

    # 3. 클라이언트 프로필 활성화
    # app_wifi.py가 생성한 클라이언트 프로필이 'autoconnect=yes'이므로
    # NetworkManager가 AP 연결이 끊어지면 자동으로 해당 프로필에 연결을 시도합니다.
    # 만약 'Pathfinder-Client' 프로필이 존재한다면 수동으로 활성화해줄 수도 있습니다.
    if nmcli con show "Pathfinder-Client" > /dev/null 2>&1; then
        sudo nmcli con up "Pathfinder-Client"
    fi

    # 4. 서비스 전환
    sudo systemctl stop wifi_setup.service || true
    sudo systemctl start robot_client.service
    echo "[pf-netmode] CLIENT 모드 전환 완료."
fi

# 변경된 방화벽 규칙을 저장하여 재부팅 후에도 유지되도록 합니다.
sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null
EOF
sudo chmod +x /usr/local/bin/pf-netmode-bookworm.sh

# --- [9] 부팅 시 네트워크 모드를 설정하는 서비스 등록 ---
echo "[9/12] 부팅 시 네트워크 모드를 자동으로 설정하는 서비스를 등록합니다..."
sudo tee /etc/systemd/system/pf-netmode.service >/dev/null <<'UNIT'
[Unit]
Description=Pathfinder Network Mode Initializer
After=NetworkManager.service
Before=network-online.target
[Service]
Type=oneshot
ExecStart=/usr/local/bin/pf-netmode-bookworm.sh
[Install]
WantedBy=multi-user.target
UNIT

# --- [10] sudoers 설정 ---
echo "[10/12] sudoers 권한을 설정합니다..."
SUDOERS_FILE="/etc/sudoers.d/010_${ACTUAL_USER}-nopasswd-wifi"
# app_wifi.py가 nmcli와 systemctl을 비밀번호 없이 사용하도록 권한 부여
echo "${ACTUAL_USER} ALL=(ALL) NOPASSWD: /usr/bin/nmcli, /bin/systemctl" | sudo tee ${SUDOERS_FILE}
sudo chmod 440 ${SUDOERS_FILE}

# --- [11] 서비스 활성화 및 초기 모드 설정 ---
echo "[11/12] 서비스를 활성화하고 초기 AP 모드를 설정합니다..."
sudo systemctl daemon-reload
sudo systemctl enable robot_client.service
sudo systemctl enable wifi_setup.service
# 새로 만든 pf-netmode 서비스를 활성화하여 부팅 시마다 실행되도록 합니다.
sudo systemctl enable pf-netmode.service

# 최초 부팅 시에는 AP 모드로 시작하도록 설정합니다.
echo "MODE=AP" | sudo tee /etc/pf_env >/dev/null

# --- [12] 완료 및 재부팅 ---
echo "[12/12] ✅ 모든 설정이 완료되었습니다! 시스템을 재부팅합니다."
sleep 5
sudo reboot
