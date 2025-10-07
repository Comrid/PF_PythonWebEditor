#!/bin/bash
set -e

# --- 변수 설정 ---
ACTUAL_USER=${SUDO_USER:-pi}
WAN_IF="wlan0"
AP_SSID="PF_Kit_Wifi"
AP_PASSWORD="12345678"
GIT_REPO_URL="https://github.com/Comrid/PF_PythonWebEditor.git"
CLONE_DIR="/home/${ACTUAL_USER}/PF_PythonWebEditor"

echo "🚀 (Bookworm version) Starting Pathfinder sequential mode switching setup (User=$ACTUAL_USER)"
sleep 2

# --- [1] Install essential packages ---
echo "[1/12] Installing essential packages (NetworkManager focused)..."
sudo apt-get update
echo "iptables-persistent iptables-persistent/autosave_v4 boolean true" | sudo debconf-set-selections
echo "iptables-persistent iptables-persistent/autosave_v6 boolean true" | sudo debconf-set-selections
sudo apt-get install -y git python3-pip python3-opencv iw iproute2 network-manager iptables-persistent

# --- [2] Disable Bluetooth ---
echo "[2/12] Disabling Bluetooth functionality..."
grep -q "dtoverlay=disable-bt" /boot/config.txt || echo "dtoverlay=disable-bt" | sudo tee -a /boot/config.txt

# --- [3] Set user permissions ---
echo "[3/12] Granting network management group (netdev) permissions to user ($ACTUAL_USER)..."
sudo usermod -a -G netdev ${ACTUAL_USER}

# --- [4] Clone GitHub repository ---
echo "[4/12] Downloading latest source code from GitHub..."
if [ -d "$CLONE_DIR" ]; then
    sudo rm -rf "$CLONE_DIR"
fi
sudo -u ${ACTUAL_USER} git clone ${GIT_REPO_URL} ${CLONE_DIR}

# --- [5] Install Python libraries ---
echo "[5/12] Installing Python libraries..."
sudo pip3 install flask flask-socketio numpy==1.26.4 --break-system-packages

# --- [6] Create and initialize NetworkManager profiles ---
echo "[6/12] Creating and initializing NetworkManager persistent network profiles..."

# 6-1. Delete all existing Wi-Fi client connection profiles to ensure AP mode boot.
while IFS= read -r line; do
    con_name=$(echo "$line" | cut -d: -f1)
    if [ "$con_name" != "" ] && [ "$con_name" != "Pathfinder-AP" ]; then
        echo "Deleting existing Wi-Fi profile '$con_name'."
        sudo nmcli con delete "$con_name" || true
    fi
done <<< "$(nmcli -t -f NAME,TYPE con show | grep ':802-11-wireless')"


# 6-2. Create persistent AP mode profile.
sudo nmcli connection add type wifi ifname ${WAN_IF} con-name "Pathfinder-AP" autoconnect no mode ap ssid "${AP_SSID}"
sudo nmcli connection modify "Pathfinder-AP" 802-11-wireless-security.key-mgmt wpa-psk
sudo nmcli connection modify "Pathfinder-AP" 802-11-wireless-security.psk "${AP_PASSWORD}"
sudo nmcli connection modify "Pathfinder-AP" ipv4.method shared
sudo nmcli connection modify "Pathfinder-AP" ipv4.addresses 10.42.0.1/24

# --- [7] Register systemd services for robot client ---
echo "[7/12] Registering services for robot client..."

# WiFi setup service (runs in AP mode)
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

# Robot client service (runs in Client mode)
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

# --- [8] Create dynamic mode switching script ---
echo "[8/12] Creating dynamic mode switching script with captive portal functionality..."
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

    sudo systemctl start robot_client.service
    sudo systemctl stop wifi_setup.service || true
    echo "[pf-netmode] CLIENT mode switching completed."
fi

sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null
EOF
sudo chmod +x /usr/local/bin/pf-netmode-bookworm.sh

# --- [9] Register service for network mode initialization at boot ---
echo "[9/12] Registering service for automatic network mode setup at boot..."
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

# --- [10] Configure sudoers ---
echo "[10/12] Setting up sudoers permissions..."
SUDOERS_FILE="/etc/sudoers.d/010_${ACTUAL_USER}-nopasswd-wifi"
echo "${ACTUAL_USER} ALL=(ALL) NOPASSWD: /usr/bin/nmcli, /bin/systemctl" | sudo tee ${SUDOERS_FILE}
sudo chmod 440 ${SUDOERS_FILE}

# --- [11] Activate services and set initial mode (key modification) ---
echo "[11/12] Activating services and setting initial AP mode..."
sudo systemctl daemon-reload
sudo systemctl enable pf-netmode.service

# Set to start in AP mode on initial boot.
echo "MODE=AP" | sudo tee /etc/pf_env >/dev/null

# --- [12] Completion and reboot ---
echo "[12/12] ✅ All setup completed! Rebooting the system."
sleep 5
sudo reboot

