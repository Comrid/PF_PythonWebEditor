from flask import Flask, render_template_string, request, jsonify, redirect, url_for
import subprocess
import re
import os

app = Flask(__name__)

# --- AP 모드일 때 사용할 표준 주소와 IP를 정의합니다. ---
CANONICAL_HOSTNAME = "pathfinder.kit"
AP_IP = "10.42.0.1"
# ---------------------------------------------------

WPA_SUPPLICANT_PATH = "/etc/wpa_supplicant/wpa_supplicant.conf"

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
    host = request.host.split(':')[0]
    if host not in [CANONICAL_HOSTNAME, AP_IP]:
        return redirect(f"http://{CANONICAL_HOSTNAME}{request.full_path}", code=302)

HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>네트워크 설정</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Arial', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; color: white; padding: 20px 0; }
        .container { text-align: center; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border-radius: 20px; padding: 40px; border: 1px solid rgba(255, 255, 255, 0.2); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); max-width: 500px; width: 90%; }
        .title { font-size: 2rem; margin-bottom: 20px; font-weight: 600; }
        .description { font-size: 1.1rem; margin-bottom: 30px; opacity: 0.9; line-height: 1.6; }
        .wifi-form, .saved-networks { text-align: left; margin-bottom: 30px; }
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
        <h1 class="title">네트워크 설정</h1>
        <p class="description">
            인터넷에 연결하여 메인 에디터를 시작하려면,<br>아래 목록에서 Wi-Fi를 선택하거나 새로운 네트워크를 추가하세요.
        </p>
        
        {% if saved_networks %}
        <div class="saved-networks">
            <h3>저장된 네트워크로 연결</h3>
            {% for ssid in saved_networks %}
                <button class="btn saved-network-btn" onclick="connectToSaved('{{ ssid }}')">{{ ssid }}</button>
            {% endfor %}
        </div>
        {% endif %}

        <div class="wifi-form">
            <h3>새로운 네트워크 추가</h3>
            <div class="form-group">
                <label class="form-label" for="ssid">WiFi 이름 (SSID)</label>
                <input type="text" class="form-input" id="ssid" name="ssid" required>
            </div>
            <div class="form-group">
                <label class="form-label" for="password">WiFi 비밀번호</label>
                <input type="password" class="form-input" id="password" name="password" required>
            </div>
            <button class="btn connect-btn" id="connectBtn" onclick="connectToNewWiFi()">새 WiFi 추가 및 연결 시도</button>
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

        function connectToNewWiFi() {
            const ssid = document.getElementById('ssid').value.trim();
            const password = document.getElementById('password').value.trim();
            if (!ssid || !password) {
                showStatus('새로운 WiFi 이름과 비밀번호를 모두 입력해주세요.', true);
                return;
            }
            showLoading('새로운 WiFi 설정을 저장하고 연결을 시도합니다...');
            fetch('/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ssid: ssid, password: password })
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
                    showLoading(data.message); // 로딩 상태 유지
                    checkConnectionStatus(); // 상태 확인 시작
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

@app.route("/generate_204") # ... and other captive portal routes
def captive_probe_redirect():
    return redirect(f"http://{CANONICAL_HOSTNAME}", code=302)

@app.route('/')
def index():
    saved_networks = get_saved_networks()
    return render_template_string(HTML_TEMPLATE, saved_networks=saved_networks)

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

