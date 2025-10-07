#!/bin/bash
set -e

ACTUAL_USER=${SUDO_USER:-pi}
WAN_IF="wlan0"
AP_SSID="PF_Kit_Wifi"
AP_PASSWORD="12345678"
GIT_REPO_URL="https://github.com/Comrid/PF_PythonWebEditor.git"
CLONE_DIR="/home/${ACTUAL_USER}/PF_PythonWebEditor"

echo "🚀 Pathfinder Kit Setup (User=$ACTUAL_USER)"
sleep 1


echo "# 필수 패키지 설치 #"
sudo apt-get update
echo "iptables-persistent iptables-persistent/autosave_v4 boolean true" | sudo debconf-set-selections
echo "iptables-persistent iptables-persistent/autosave_v6 boolean true" | sudo debconf-set-selections
sudo apt-get install -y git python3-pip python3-opencv iw iproute2 network-manager iptables-persistent


echo "# 블루투스 비활성화 #"
grep -q "dtoverlay=disable-bt" /boot/config.txt || echo "dtoverlay=disable-bt" | sudo tee -a /boot/config.txt


echo "# 사용자 권한 설정 #"
sudo usermod -a -G netdev ${ACTUAL_USER}


echo "# GitHub 리포지토리 클론 #"
if [ -d "$CLONE_DIR" ]; then
    sudo rm -rf "$CLONE_DIR"
fi
sudo -u ${ACTUAL_USER} git clone ${GIT_REPO_URL} ${CLONE_DIR}


echo "# Python 라이브러리 설치 #"
sudo pip3 install flask flask-socketio numpy==1.26.4 websocket-client --break-system-package


echo '# AP 모드 프로필 생성 #'
sudo nmcli connection add type wifi ifname ${WAN_IF} con-name "Pathfinder-AP" autoconnect no mode ap ssid "${AP_SSID}"
sudo nmcli connection modify "Pathfinder-AP" 802-11-wireless-security.key-mgmt wpa-psk
sudo nmcli connection modify "Pathfinder-AP" 802-11-wireless-security.psk "${AP_PASSWORD}"
sudo nmcli connection modify "Pathfinder-AP" ipv4.method shared
sudo nmcli connection modify "Pathfinder-AP" ipv4.addresses 10.42.0.1/24


echo "# 와이파이 설정 서비스 등록 #"
sudo tee /etc/systemd/system/wifi_setup.service >/dev/null <<UNIT
[Unit]
Description=Pathfinder WiFi Setup App (Bookworm)
[Service]
Type=simple
User=${ACTUAL_USER}
Group=netdev
WorkingDirectory=${CLONE_DIR}/Client_Code
ExecStart=/usr/bin/python3 app_wifi.py
Restart=on-failure
TimeoutStopSec=5
KillMode=mixed
[Install]
WantedBy=multi-user.target
UNIT


echo '# 로봇 클라이언트 서비스 등록 #'
sudo tee /etc/systemd/system/robot_client.service >/dev/null <<UNIT
[Unit]
Description=Pathfinder Robot Client (Bookworm)
[Service]
Type=simple
User=${ACTUAL_USER}
Group=netdev
WorkingDirectory=${CLONE_DIR}/Client_Code
ExecStart=/usr/bin/python3 robot_client.py
Restart=on-failure
TimeoutStopSec=5
KillMode=mixed
[Install]
WantedBy=multi-user.target
UNIT


echo "# 동적 모드 전환 스크립트 생성 #"
sudo tee /usr/local/bin/pf-netmode-bookworm.sh >/dev/null << 'EOF'
#!/bin/bash
set -e

if [ ! -f /etc/pf_env ]; then
    echo "MODE=AP" | sudo tee /etc/pf_env > /dev/null
fi
source /etc/pf_env
CURRENT_CONNECTION=$(nmcli -t -f NAME,DEVICE con show --active | grep 'wlan0' | cut -d: -f1 || true)

if [ "$MODE" = "AP" ]; then
    echo "[pf-netmode] Switching to AP mode..."
    if [[ "$CURRENT_CONNECTION" && "$CURRENT_CONNECTION" != "Pathfinder-AP" ]]; then
        sudo nmcli con down "$CURRENT_CONNECTION"
    fi
    sudo nmcli con up "Pathfinder-AP"

    echo "[pf-netmode] Waiting for IP address (10.42.0.1) to be assigned to wlan0..."
    while ! ip -4 addr show wlan0 | grep -q "inet 10.42.0.1"; do
        sleep 1
    done
    echo "[pf-netmode] IP address is ready."

    sudo iptables -F
    sudo iptables -t nat -F
    sudo iptables -A INPUT -i wlan0 -p udp --dport 53 -j ACCEPT
    sudo iptables -A INPUT -i wlan0 -p tcp --dport 5000 -j ACCEPT
    sudo iptables -t nat -A PREROUTING -i wlan0 -p tcp --dport 80 -j REDIRECT --to-port 5000

    sudo systemctl stop robot_client.service || true
    sudo systemctl start wifi_setup.service
    echo "[pf-netmode] AP mode and captive portal activation completed."

elif [ "$MODE" = "CLIENT" ]; then
    sleep 3
    echo "[pf-netmode] Switching to CLIENT mode..."
    if [ "$CURRENT_CONNECTION" = "Pathfinder-AP" ]; then
        sudo nmcli con down "Pathfinder-AP"
    fi

    sudo iptables -F
    sudo iptables -t nat -F

    if nmcli con show "Pathfinder-Client" > /dev/null 2>&1; then
        echo "[pf-netmode] Attempting to activate Pathfinder-Client profile..."
        sudo nmcli con up "Pathfinder-Client"
    fi

    sleep 1
    sudo systemctl start robot_client.service
    sudo systemctl stop wifi_setup.service || true
    echo "[pf-netmode] CLIENT mode switching completed."
fi

sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null
EOF
sudo chmod +x /usr/local/bin/pf-netmode-bookworm.sh


echo "# 네트워크 모드 초기화 서비스 등록 #"
sudo tee /etc/systemd/system/pf-netmode.service >/dev/null <<'UNIT'
[Unit]
Description=Pathfinder Network Mode Initializer
After=NetworkManager.service
[Service]
Type=oneshot
ExecStart=/usr/local/bin/pf-netmode-bookworm.sh
[Install]
WantedBy=multi-user.target
UNIT


echo "# sudoers 권한 설정 #"
SUDOERS_FILE="/etc/sudoers.d/010_${ACTUAL_USER}-nopasswd-wifi"
echo "${ACTUAL_USER} ALL=(ALL) NOPASSWD: /usr/bin/nmcli, /bin/systemctl" | sudo tee ${SUDOERS_FILE}
sudo chmod 440 ${SUDOERS_FILE}


echo "# 서비스 활성화 및 초기 AP 모드 설정 #"
sudo systemctl daemon-reload
sudo systemctl enable pf-netmode.service
echo "MODE=AP" | sudo tee /etc/pf_env >/dev/null


echo "# 기존 Wi-Fi 프로필 삭제 및 시스템 재부팅 #"
while IFS= read -r line; do
    con_name=$(echo "$line" | cut -d: -f1)
    if [ "$con_name" != "" ] && [ "$con_name" != "Pathfinder-AP" ]; then
        echo "Deleting existing Wi-Fi profile '$con_name'."
        sudo nmcli con delete "$con_name" || true
    fi
done <<< "$(nmcli -t -f NAME,TYPE con show | grep ':802-11-wireless')"

sleep 3
sudo reboot

