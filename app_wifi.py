from flask import Flask, render_template_string, request, jsonify
import subprocess
import time
import threading
import re
import os

app = Flask(__name__)

WPA_SUPPLICANT_PATH = "/etc/wpa_supplicant/wpa_supplicant.conf"

def get_saved_networks():
    """/etc/wpa_supplicant/wpa_supplicant.conf 파일에서 저장된 SSID 목록을 파싱합니다."""
    networks = []
    try:
        with open(WPA_SUPPLICANT_PATH, 'r') as f:
            content = f.read()
            # 정규표현식을 사용하여 network={...} 블록 안의 ssid="..." 값을 찾습니다.
            found = re.findall(r'network={[^}]+?ssid="([^"]+)"[^}]+?}', content)
            if found:
                networks = list(dict.fromkeys(found)) # 중복 제거
    except FileNotFoundError:
        print(f"Warning: {WPA_SUPPLICANT_PATH} not found.")
    except Exception as e:
        print(f"Error reading saved networks: {e}")
    return networks

HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>네트워크 설정</title>
    <style>
        /* --- 기존 디자인(CSS)과 동일 --- */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Arial', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 100vh; display: flex; align-items: center; justify-content: center; color: white; }
        .container { text-align: center; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border-radius: 20px; padding: 40px; border: 1px solid rgba(255, 255, 255, 0.2); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); max-width: 500px; width: 90%; }
        .title { font-size: 2rem; margin-bottom: 20px; font-weight: 600; }
        .description { font-size: 1.1rem; margin-bottom: 30px; opacity: 0.9; line-height: 1.6; }
        .wifi-form, .saved-networks, .ap-mode-section { text-align: left; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        .form-label, h3 { display: block; margin-bottom: 12px; font-weight: 500; font-size: 1.1rem; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 8px; }
        .form-input { width: 100%; padding: 15px; border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 10px; background: rgba(255, 255, 255, 0.1); color: white; font-size: 1rem; transition: all 0.3s ease; backdrop-filter: blur(10px); }
        .form-input::placeholder { color: rgba(255, 255, 255, 0.6); }
        .form-input:focus { outline: none; border-color: rgba(255, 255, 255, 0.6); background: rgba(255, 255, 255, 0.15); box-shadow: 0 0 20px rgba(255, 255, 255, 0.2); }
        .password-toggle { position: relative; }
        .toggle-btn { position: absolute; right: 15px; top: 50%; transform: translateY(-50%); background: none; border: none; color: rgba(255, 255, 255, 0.6); cursor: pointer; font-size: 1.1rem; padding: 5px; transition: color 0.3s ease; }
        .toggle-btn:hover { color: rgba(255, 255, 255, 0.8); }
        .btn { border: none; border-radius: 15px; color: white; padding: 18px 36px; font-size: 1.1rem; font-weight: 600; cursor: pointer; transition: all 0.3s ease; width: 100%; margin-bottom: 15px; }
        .btn:hover { transform: translateY(-3px); }
        .btn:active { transform: translateY(-1px); }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .connect-btn { background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%); box-shadow: 0 4px 15px rgba(74, 222, 128, 0.3); }
        .connect-btn:hover { box-shadow: 0 8px 25px rgba(74, 222, 128, 0.4); }
        .ap-mode-btn { background: linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%); box-shadow: 0 4px 15px rgba(56, 189, 248, 0.3); }
        .ap-mode-btn:hover { box-shadow: 0 8px 25px rgba(56, 189, 248, 0.4); }
        .saved-network-btn { background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); font-size: 1rem; padding: 15px 30px; }
        .saved-network-btn:hover { background: rgba(255, 255, 255, 0.25); border-color: rgba(255, 255, 255, 0.5); }
        .status { margin-top: 20px; font-size: 0.9rem; opacity: 0.8; min-height: 20px; }
        .loading { display: none; margin-top: 20px; }
        .spinner { border: 3px solid rgba(255, 255, 255, 0.3); border-top: 3px solid white; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto 10px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .wifi-icon { font-size: 3rem; margin-bottom: 20px; opacity: 0.8; }
    </style>
</head>
<body>
    <div class="container">
        <div class="wifi-icon">📡</div>
        <h1 class="title">네트워크 컨트롤 타워</h1>
        <p class="description">
            연결할 네트워크를 선택하거나, AP 모드를 유지하여 메인 에디터를 시작할 수 있습니다.
        </p>

        <!-- AP 모드 유지 섹션 -->
        <div class="ap-mode-section">
            <h3>AP 모드로 시작하기</h3>
            <button class="btn ap-mode-btn" id="apModeBtn" onclick="startInAPMode()">
                AP 모드 유지하고 메인 에디터 시작
            </button>
        </div>
        
        <!-- 저장된 네트워크 섹션 -->
        {% if saved_networks %}
        <div class="saved-networks">
            <h3>저장된 네트워크로 연결</h3>
            {% for ssid in saved_networks %}
                <button class="btn saved-network-btn" onclick="connectToSaved('{{ ssid }}')">{{ ssid }}</button>
            {% endfor %}
        </div>
        {% endif %}

        <!-- 새 네트워크 입력 폼 -->
        <div class="wifi-form">
            <h3>새로운 네트워크 추가</h3>
            <div class="form-group">
                <label class="form-label" for="ssid">WiFi 네트워크 이름 (SSID)</label>
                <input type="text" class="form-input" id="ssid" name="ssid" placeholder="새로운 WiFi 이름을 입력하세요" required>
            </div>
            <div class="form-group">
                <label class="form-label" for="password">WiFi 비밀번호</label>
                <div class="password-toggle">
                    <input type="password" class="form-input" id="password" name="password" placeholder="새로운 WiFi 비밀번호를 입력하세요" required>
                    <button type="button" class="toggle-btn" id="togglePassword" onclick="togglePassword()">🔍</button>
                </div>
            </div>
            <button class="btn connect-btn" id="connectBtn" onclick="connectToNewWiFi()">
                새 WiFi 추가 및 재부팅
            </button>
        </div>
        
        <div class="loading" id="loading">
            <div class="spinner"></div>
            <div id="loadingText"></div>
        </div>
        
        <div class="status" id="status"></div>
    </div>

    <script>
        function togglePassword() {
            const passwordInput = document.getElementById('password');
            const toggleBtn = document.getElementById('togglePassword');
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleBtn.textContent = '🙈';
            } else {
                passwordInput.type = 'password';
                toggleBtn.textContent = '🔍';
            }
        }

        function showLoading(message) {
            document.getElementById('loadingText').textContent = message;
            document.getElementById('loading').style.display = 'block';
            document.getElementById('status').textContent = '';
            // 모든 버튼 비활성화
            document.querySelectorAll('button').forEach(btn => btn.disabled = true);
        }

        function showStatus(message, isError = false) {
            document.getElementById('loading').style.display = 'none';
            const statusEl = document.getElementById('status');
            statusEl.textContent = message;
            statusEl.style.color = isError ? '#ef4444' : '#4ade80';
            // 모든 버튼 다시 활성화
            document.querySelectorAll('button').forEach(btn => btn.disabled = false);
        }

        function connectToNewWiFi() {
            const ssid = document.getElementById('ssid').value.trim();
            const password = document.getElementById('password').value.trim();
            if (!ssid || !password) {
                showStatus('새로운 WiFi 이름과 비밀번호를 모두 입력해주세요.', true);
                return;
            }
            showLoading('새로운 WiFi 설정을 저장하고 재부팅합니다...');
            fetch('/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ssid: ssid, password: password })
            })
            .then(handleResponse)
            .catch(handleError);
        }

        function connectToSaved(ssid) {
            if (!confirm(`'${ssid}' 네트워크로 연결하기 위해 재부팅하시겠습니까?`)) return;
            showLoading(`'${ssid}' 네트워크로 연결하기 위해 재부팅합니다...`);
            fetch('/connect-saved', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ssid: ssid })
            })
            .then(handleResponse)
            .catch(handleError);
        }

        function startInAPMode() {
            showLoading('AP 모드에서 메인 에디터를 시작합니다...');
            fetch('/start-main-app-in-ap-mode', { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showStatus('메인 에디터가 시작되었습니다. 잠시 후 페이지를 새로고침하세요.');
                    // 5초 후 현재 페이지를 새로고침하여 메인 에디터로 전환 시도
                    setTimeout(() => window.location.reload(), 5000);
                } else {
                    showStatus('오류: ' + data.error, true);
                }
            })
            .catch(handleError);
        }

        function handleResponse(response) {
            return response.json().then(data => {
                if (data.success) {
                    showStatus(data.message);
                } else {
                    showStatus('오류: ' + data.error, true);
                }
            });
        }

        function handleError(error) {
            showStatus('요청 오류가 발생했습니다: ' + error.message, true);
        }
    </script>
</body>
</html>
'''

@app.route('/')
def index():
    saved_networks = get_saved_networks()
    return render_template_string(HTML_TEMPLATE, saved_networks=saved_networks)

@app.route('/connect', methods=['POST'])
def connect_new_wifi():
    """새로운 Wi-Fi 정보를 wpa_supplicant.conf에 저장하고 재부팅합니다."""
    try:
        data = request.get_json()
        ssid = data.get('ssid')
        password = data.get('password')

        if not ssid or not password:
            return jsonify({"success": False, "error": "SSID 또는 비밀번호가 없습니다."}), 400

        command = f"wpa_passphrase '{ssid}' '{password}' | sudo tee -a {WPA_SUPPLICANT_PATH} > /dev/null"
        subprocess.run(command, shell=True, check=True)
        
        trigger_reboot("새로운 WiFi 정보가 저장되었으며, 시스템이 재부팅됩니다.")
        return jsonify({"success": True, "message": "설정 완료! 잠시 후 시스템이 재부팅됩니다..."})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/connect-saved', methods=['POST'])
def connect_saved_wifi():
    """저장된 네트워크로 연결하기 위해 재부팅만 실행합니다."""
    try:
        data = request.get_json()
        ssid = data.get('ssid')
        print(f"Connecting to saved network: {ssid}")
        # 실제로는 재부팅만 하면 wpa_supplicant가 알아서 연결합니다.
        # 우선순위를 높이고 싶다면 파일을 수정하는 로직을 추가할 수 있습니다.
        trigger_reboot(f"'{ssid}' 네트워크로 연결하기 위해 시스템을 재부팅합니다.")
        return jsonify({"success": True, "message": "재부팅 신호를 보냈습니다..."})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/start-main-app-in-ap-mode', methods=['POST'])
def start_main_app_in_ap_mode():
    """현재 Wi-Fi 설정 앱을 중지하고 메인 웹 에디터 앱을 시작합니다."""
    try:
        # 이 서비스(자기 자신)를 먼저 중지하고, 메인 에디터 서비스를 시작합니다.
        # 이 명령어들은 sudoers 파일에 미리 등록되어 있어야 합니다.
        subprocess.Popen("sudo systemctl stop wifi_setup.service && sudo systemctl start webeditor.service", shell=True)
        return jsonify({"success": True, "message": "메인 에디터 서비스를 시작합니다."})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def trigger_reboot(message=""):
    """응답을 먼저 보낸 후, 백그라운드에서 지연 재부팅을 실행합니다."""
    print(message)
    def delayed_reboot():
        time.sleep(2)
        os.system("sudo reboot")

    reboot_thread = threading.Thread(target=delayed_reboot)
    reboot_thread.daemon = True
    reboot_thread.start()


if __name__ == '__main__':
    print("WiFi 설정 컨트롤 타워를 시작합니다...")
    app.run(host='0.0.0.0', port=5000, debug=False)

