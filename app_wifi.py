from flask import Flask, render_template_string, request, jsonify, redirect, url_for
import subprocess
import re
import os
import requests
import uuid
import time

app = Flask(__name__)

# --- AP 모드일 때 사용할 표준 주소와 IP를 정의합니다. ---
CANONICAL_HOSTNAME = "https://pathfinder-kit.duckdns.org"
AP_IP = "10.42.0.1"
# ---------------------------------------------------

WPA_SUPPLICANT_PATH = "/etc/wpa_supplicant/wpa_supplicant.conf"
SERVER_URL = "https://pathfinder-kit.duckdns.org"

def generate_robot_id():
    """고유한 로봇 ID 생성"""
    return f"robot_{uuid.uuid4().hex[:8]}"

def register_to_server(robot_name, robot_id):
    """서버에 로봇 등록"""
    try:
        # 1. 먼저 인터넷 연결 확인
        print("인터넷 연결 확인 중...")
        test_response = requests.get("https://www.google.com", timeout=10)
        if test_response.status_code != 200:
            print("인터넷 연결 실패")
            return False
        
        # 2. DNS 해석 테스트
        print("DNS 해석 테스트 중...")
        import socket
        try:
            socket.gethostbyname("pathfinder-kit.duckdns.org")
            print("DNS 해석 성공")
        except socket.gaierror as e:
            print(f"DNS 해석 실패: {e}")
            # DNS 서버 변경 시도
            print("DNS 서버를 8.8.8.8로 변경 시도...")
            subprocess.run("echo 'nameserver 8.8.8.8' | sudo tee /etc/resolv.conf", shell=True)
            subprocess.run("echo 'nameserver 8.8.4.4' | sudo tee -a /etc/resolv.conf", shell=True)
            time.sleep(2)
        
        # 3. 서버 등록 시도
        print(f"서버 등록 시도: {SERVER_URL}/api/robot/register")
        response = requests.post(f"{SERVER_URL}/api/robot/register", 
                               json={
                                   "robot_name": robot_name,
                                   "robot_id": robot_id,
                                   "status": "available"
                               },
                               timeout=30)
        
        if response.status_code == 200:
            print(f"로봇이 서버에 성공적으로 등록되었습니다: {robot_name}")
            return True
        else:
            print(f"로봇 등록 실패: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"서버 등록 오류: {e}")
        return False

def get_saved_networks():
    """/etc/wpa_supplicant/wpa_supplicant.conf 파일에서 저장된 SSID 목록을 파싱합니다."""
    networks = []
    try:
        with open(WPA_SUPPLICANT_PATH, 'r') as f:
            content = f.read()
            found = re.findall(r'network={[^}]+?ssid="([^"]+)"[^}]+?}', content)
            if found:
                networks = list(dict.fromkeys(found))
    except Exception:
        pass
    return networks

# --- 모든 요청이 라우트 함수에 도달하기 전에 실행됩니다. ---
@app.before_request
def redirect_to_canonical_host():
    """msftconnecttest.com 등 원치 않는 호스트 이름으로 접속 시, CANONICAL_HOSTNAME으로 리디렉션합니다."""
    pass
    # host = request.host.split(':')[0]
    # if host not in [CANONICAL_HOSTNAME, AP_IP]:
    #     return redirect(f"http://{CANONICAL_HOSTNAME}{request.full_path}", code=302)

HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>로봇 설정</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Arial', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; color: white; padding: 20px 0; }
        .container { text-align: center; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border-radius: 20px; padding: 40px; border: 1px solid rgba(255, 255, 255, 0.2); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); max-width: 500px; width: 90%; }
        .title { font-size: 2rem; margin-bottom: 20px; font-weight: 600; }
        .description { font-size: 1.1rem; margin-bottom: 30px; opacity: 0.9; line-height: 1.6; }
        .setup-form, .saved-networks { text-align: left; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        .form-label, h3 { display: block; margin-bottom: 12px; font-weight: 500; font-size: 1.1rem; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 8px; }
        .form-input { width: 100%; padding: 15px; border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 10px; background: rgba(255, 255, 255, 0.1); color: white; font-size: 1rem; transition: all 0.3s ease; backdrop-filter: blur(10px); }
        .btn { border: none; border-radius: 15px; color: white; padding: 18px 36px; font-size: 1.1rem; font-weight: 600; cursor: pointer; transition: all 0.3s ease; width: 100%; margin-bottom: 15px; }
        .connect-btn { background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%); }
        .saved-network-btn { background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); font-size: 1rem; padding: 15px 30px; }
        .status { margin-top: 20px; font-size: 0.9rem; opacity: 0.8; min-height: 20px; }
        .loading { display: none; margin-top: 20px; }
        .spinner { border: 3px solid rgba(255, 255, 255, 0.3); border-top: 3px solid white; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto 10px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="title">로봇 설정</h1>
        <p class="description">
            로봇을 웹 에디터와 연동하기 위해<br>로봇 이름과 와이파이 정보를 입력하세요.
        </p>
        
        <div class="setup-form">
            <h3>로봇 및 네트워크 설정</h3>
            <div class="form-group">
                <label class="form-label" for="robot_name">로봇 이름</label>
                <input type="text" class="form-input" id="robot_name" name="robot_name" placeholder="연동에 사용할 로봇 이름" required>
            </div>
            <div class="form-group">
                <label class="form-label" for="ssid">WiFi 이름 (SSID)</label>
                <input type="text" class="form-input" id="ssid" name="ssid" placeholder="와이파이 이름" required>
            </div>
            <div class="form-group">
                <label class="form-label" for="password">WiFi 비밀번호</label>
                <input type="password" class="form-input" id="password" name="password" placeholder="와이파이 비밀번호" required>
            </div>
            <button class="btn connect-btn" id="setupBtn" onclick="setupRobot()">로봇 설정 완료</button>
        </div>
        
        {% if saved_networks %}
        <div class="saved-networks">
            <h3>저장된 네트워크로 연결</h3>
            {% for ssid in saved_networks %}
                <button class="btn saved-network-btn" onclick="connectToSaved('{{ ssid }}')">{{ ssid }}</button>
            {% endfor %}
        </div>
        {% endif %}
        
        <div class="manual-register" style="margin-top: 20px;">
            <h3>수동 서버 등록</h3>
            <p style="font-size: 0.9rem; opacity: 0.8; margin-bottom: 15px;">
                자동 등록이 실패한 경우, 로봇 이름만으로 수동 등록할 수 있습니다.
            </p>
            <div class="form-group">
                <label class="form-label" for="manual_robot_name">로봇 이름</label>
                <input type="text" class="form-input" id="manual_robot_name" placeholder="등록할 로봇 이름" required>
            </div>
            <button class="btn connect-btn" onclick="registerManual()">수동 등록</button>
        </div>
        
        <div class="loading" id="loading">
            <div class="spinner"></div>
            <div id="loadingText"></div>
        </div>
        <div class="status" id="status"></div>
    </div>

    <script>
        let statusInterval;

        function showLoading(message) {
            document.getElementById('loadingText').textContent = message;
            document.getElementById('loading').style.display = 'block';
            document.getElementById('status').textContent = '';
            document.querySelectorAll('button').forEach(btn => btn.disabled = true);
        }

        function showStatus(message, isError = false) {
            document.getElementById('loading').style.display = 'none';
            const statusEl = document.getElementById('status');
            statusEl.textContent = message;
            statusEl.style.color = isError ? '#ef4444' : '#4ade80';
            document.querySelectorAll('button').forEach(btn => btn.disabled = false);
            if(statusInterval) clearInterval(statusInterval);
        }

        function checkConnectionStatus() {
            statusInterval = setInterval(() => {
                fetch('/api/status')
                    .then(response => response.json())
                    .then(data => {
                        if (data.status === 'connected') {
                            clearInterval(statusInterval);
                            showStatus(`연결 성공! 이제 PC를 '${data.ssid}'에 연결하고 http://${data.ip}:5000 또는 http://raspberrypi.local:5000 으로 접속하세요.`);
                        } else {
                            document.getElementById('loadingText').textContent = `연결 시도 중... (상태: ${data.status})`;
                        }
                    })
                    .catch(err => {
                        // Polling 중 에러는 무시할 수 있음
                    });
            }, 2000);
        }

        function setupRobot() {
            const robotName = document.getElementById('robot_name').value.trim();
            const ssid = document.getElementById('ssid').value.trim();
            const password = document.getElementById('password').value.trim();
            
            if (!robotName || !ssid || !password) {
                showStatus('로봇 이름, WiFi 이름, 비밀번호를 모두 입력해주세요.', true);
                return;
            }
            
            showLoading('로봇을 설정하고 서버에 등록합니다...');
            fetch('/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    robot_name: robotName,
                    ssid: ssid, 
                    password: password 
                })
            })
            .then(handleResponse)
            .catch(handleError);
        }

        function connectToSaved(ssid) {
            showLoading(`'${ssid}' 네트워크로 연결을 시도합니다...`);
            fetch('/connect-saved', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ssid: ssid })
            })
            .then(handleResponse)
            .catch(handleError);
        }

        function handleResponse(response) {
            return response.json().then(data => {
                if (data.success) {
                    if (data.robot_name) {
                        // 로봇 설정 완료
                        showStatus(data.message, false);
                        // 5초 후 페이지 새로고침 또는 안내 메시지
                        setTimeout(() => {
                            showStatus('설정이 완료되었습니다. 이제 웹 에디터에서 로봇을 연동할 수 있습니다.', false);
                        }, 3000);
                    } else {
                        // 기존 와이파이 연결
                        showLoading(data.message);
                        checkConnectionStatus();
                    }
                } else {
                    showStatus('오류: ' + data.error, true);
                }
            });
        }

        function handleError(error) {
            showStatus('요청 오류가 발생했습니다: ' + error.message, true);
        }

        function registerManual() {
            const robotName = document.getElementById('manual_robot_name').value.trim();
            
            if (!robotName) {
                showStatus('로봇 이름을 입력해주세요.', true);
                return;
            }
            
            showLoading('서버에 로봇을 등록합니다...');
            fetch('/register-manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ robot_name: robotName })
            })
            .then(handleResponse)
            .catch(handleError);
        }
    </script>
</body>
</html>
'''

@app.route("/generate_204") # ... and other captive portal routes
def captive_probe_redirect():
    return redirect(f"http://{CANONICAL_HOSTNAME}", code=302)

@app.route('/')
def index():
    saved_networks = get_saved_networks()
    return render_template_string(HTML_TEMPLATE, saved_networks=saved_networks)

@app.route('/setup', methods=['POST'])
def setup_robot():
    try:
        data = request.get_json()
        robot_name = data.get('robot_name')
        ssid = data.get('ssid')
        password = data.get('password')

        if not robot_name or not ssid or not password:
            return jsonify({"success": False, "error": "로봇 이름, SSID, 비밀번호를 모두 입력해주세요."}), 400

        # 1. 와이파이 설정
        command_wpa = f"wpa_passphrase '{ssid}' '{password}' | sudo tee -a {WPA_SUPPLICANT_PATH} > /dev/null"
        subprocess.run(command_wpa, shell=True, check=True)
        
        command_reconfigure = "sudo wpa_cli -i wlan0 reconfigure"
        subprocess.run(command_reconfigure, shell=True, check=True)
        
        # 2. 잠시 대기 후 인터넷 연결 확인
        time.sleep(5)
        
        # 3. 서버에 로봇 등록 시도
        robot_id = generate_robot_id()
        server_registered = register_to_server(robot_name, robot_id)
        
        if server_registered:
            return jsonify({
                "success": True, 
                "message": f"로봇 '{robot_name}'이 성공적으로 설정되고 서버에 등록되었습니다! 웹 에디터에서 로봇 이름 '{robot_name}'으로 연동하세요.",
                "robot_name": robot_name,
                "robot_id": robot_id,
                "server_registered": True
            })
        else:
            # 서버 등록 실패해도 로봇 설정은 완료
            return jsonify({
                "success": True, 
                "message": f"로봇 '{robot_name}' 설정이 완료되었습니다. 서버 등록은 나중에 수동으로 진행하세요. (로봇 이름: '{robot_name}')",
                "robot_name": robot_name,
                "robot_id": robot_id,
                "server_registered": False
            })
            
    except Exception as e:
        return jsonify({"success": False, "error": f"설정 중 오류가 발생했습니다: {str(e)}"}), 500

@app.route('/register-manual', methods=['POST'])
def register_manual():
    """수동으로 서버에 로봇 등록"""
    try:
        data = request.get_json()
        robot_name = data.get('robot_name')
        
        if not robot_name:
            return jsonify({"success": False, "error": "로봇 이름을 입력해주세요."}), 400
        
        robot_id = generate_robot_id()
        if register_to_server(robot_name, robot_id):
            return jsonify({
                "success": True, 
                "message": f"로봇 '{robot_name}'이 서버에 성공적으로 등록되었습니다!",
                "robot_name": robot_name,
                "robot_id": robot_id
            })
        else:
            return jsonify({
                "success": False, 
                "error": "서버 등록에 실패했습니다. 네트워크 연결을 확인해주세요."
            })
            
    except Exception as e:
        return jsonify({"success": False, "error": f"등록 중 오류가 발생했습니다: {str(e)}"}), 500

@app.route('/connect', methods=['POST'])
def connect_new_wifi():
    try:
        data = request.get_json()
        ssid = data.get('ssid')
        password = data.get('password')

        if not ssid or not password:
            return jsonify({"success": False, "error": "SSID 또는 비밀번호가 없습니다."}), 400

        command_wpa = f"wpa_passphrase '{ssid}' '{password}' | sudo tee -a {WPA_SUPPLICANT_PATH} > /dev/null"
        subprocess.run(command_wpa, shell=True, check=True)
        
        command_reconfigure = "sudo wpa_cli -i wlan0 reconfigure"
        subprocess.run(command_reconfigure, shell=True, check=True)
        
        return jsonify({"success": True, "message": "설정 저장 완료! 연결 상태를 확인합니다..."})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/connect-saved', methods=['POST'])
def connect_saved_wifi():
    try:
        command_reconfigure = "sudo wpa_cli -i wlan0 reconfigure"
        subprocess.run(command_reconfigure, shell=True, check=True)
        return jsonify({"success": True, "message": "연결을 시도합니다! 상태를 확인합니다..."})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/status')
def get_status():
    """wlan0 인터페이스의 현재 연결 상태를 반환합니다."""
    try:
        # iwgetid: 현재 연결된 Wi-Fi의 SSID를 가져옵니다.
        result_ssid = subprocess.run(['iwgetid', '-r', 'wlan0'], capture_output=True, text=True)
        # ip addr: 인터페이스의 IP 주소 정보를 가져옵니다.
        result_ip = subprocess.run(['ip', 'addr', 'show', 'wlan0'], capture_output=True, text=True)

        if result_ssid.returncode == 0 and result_ssid.stdout.strip():
            ssid = result_ssid.stdout.strip()
            ip_match = re.search(r'inet (\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', result_ip.stdout)
            ip_address = ip_match.group(1) if ip_match else 'IP 할당 중...'
            return jsonify({'status': 'connected', 'ssid': ssid, 'ip': ip_address})
        else:
            return jsonify({'status': 'connecting...'})
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)

