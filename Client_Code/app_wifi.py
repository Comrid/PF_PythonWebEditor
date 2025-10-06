# 라즈베리파이 제로 2에 AP 연결시 나오는 개인 전용 웹 사이트
# 사용자가 연결할 와이파이, 비밀번호를 입력하면 와이파이 정보를 wpa_supplicant.conf에 저장하고 재설정
# 로봇 이름은 랜덤 ID를 부여하고 robot_config.py에 저장(단, 이름 중복 문제가 있음. 나중에 개선 필요)
# 이후 로봇 클라이언트가 이 파일을 읽어서 와이파이 정보와 로봇 이름을 사용
# 클라이언트 모드로 변경

from flask import Flask, render_template, request, jsonify, redirect
import subprocess
import re
import uuid
import time
import os
import platform

AP_IP = "10.42.0.1"
WPA_SUPPLICANT_PATH = "/etc/wpa_supplicant/wpa_supplicant.conf"
SERVER_URL = "https://pathfinder-kit.duckdns.org"

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

def update_robot_config(robot_name, robot_id):
    current_dir = os.path.dirname(os.path.abspath(__file__))
    config_path = os.path.join(current_dir, "robot_config.py")

    with open(config_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    updated_lines = []
    for line in lines:
        if line.startswith('ROBOT_ID ='):
            updated_lines.append(f'ROBOT_ID = "{robot_id}"\n')
        elif line.startswith('ROBOT_NAME ='):
            updated_lines.append(f'ROBOT_NAME = "{robot_name}"\n')
        else:
            updated_lines.append(line)

    with open(config_path, 'w') as f:
        f.writelines(updated_lines)



# --- 모든 요청이 라우트 함수에 도달하기 전에 실행됩니다. ---
@app.before_request
def redirect_to_canonical_host():
    """msftconnecttest.com 등 원치 않는 호스트 이름으로 접속 시, SERVER_URL으로 리디렉션합니다."""
    pass
    # host = request.host.split(':')[0]
    # if host not in [SERVER_URL, AP_IP]:
    #     return redirect(f"http://{SERVER_URL}{request.full_path}", code=302)


@app.route("/generate_204")
def captive_probe_redirect():
    return redirect(SERVER_URL, code=302)



@app.route('/connect', methods=['POST'])
def setup_robot():
    try:
        data = request.get_json()
        robot_name = data.get('robot_name')
        ssid = data.get('ssid')
        password = data.get('password')

        # 검증(필수 입력, 비밀번호 길이, 로봇 이름 형식)
        if not robot_name or not ssid or not password:
            return jsonify({"success": False, "error": "로봇 이름, SSID, 비밀번호를 모두 입력해주세요."}), 400

        if len(password) < 8:
            return jsonify({"success": False, "error": "WiFi 비밀번호는 8자 이상이어야 합니다."}), 400
        if len(password) > 63:
            return jsonify({"success": False, "error": "WiFi 비밀번호는 63자 이하여야 합니다."}), 400

        if not re.match(r'^[a-zA-Z0-9]+$', robot_name):
            return jsonify({"success": False, "error": "로봇 이름은 영문자와 숫자만 사용할 수 있습니다."}), 400
        if len(robot_name) > 10:
            return jsonify({"success": False, "error": "로봇 이름은 10자 이하여야 합니다."}), 400
        if len(robot_name) < 3:
            return jsonify({"success": False, "error": "로봇 이름은 3자 이상이어야 합니다."}), 400

        if platform.system() == "Linux":
            try:
                # 1. nmcli 명령어로 WiFi에 연결합니다. (Bookworm 방식)
                # 이 명령어 하나로 연결, 프로필 저장이 모두 처리됩니다.
                print(f"Connecting to SSID: {ssid}...")
                connect_command = [
                    "sudo", "nmcli", "device", "wifi", "connect",
                    ssid, "password", password
                ]
                # 30초 타임아웃 및 오류 출력을 위해 capture_output 설정
                subprocess.run(connect_command, check=True, text=True, capture_output=True, timeout=30)

                # 2. 연결 성공 시, CLIENT 모드로 전환합니다.
                print("WiFi connection successful. Switching to CLIENT mode...")
                # /etc/pf_env 파일 업데이트
                subprocess.run(
                    "echo 'MODE=CLIENT' | sudo tee /etc/pf_env",
                    shell=True, check=True
                )

                # Bookworm 전용 모드 전환 스크립트 실행
                subprocess.run(
                    ["sudo", "/usr/local/bin/pf-netmode-bookworm.sh"],
                    check=True
                )

                print("Successfully switched to CLIENT mode.")
                # 성공 메시지를 UI로 보내는 로직이 여기에 위치하면 좋습니다.

            except subprocess.TimeoutExpired:
                # 연결 시간 초과 시 오류 처리
                error_message = "Error: Connection timed out. Please check SSID and password."
                print(error_message)
                # 오류 메시지를 UI로 보내는 로직 추가

            except subprocess.CalledProcessError as e:
                # nmcli 명령어 실패 시 오류를 분석하여 더 친절하게 안내
                error_output = e.stderr.strip()
                if "Error: No network with SSID" in error_output:
                    error_message = f"Error: SSID '{ssid}' not found. Please check the Wi-Fi name."
                elif "Error: Connection activation failed: (7) Secrets were required" in error_output:
                    error_message = "Error: Incorrect password."
                else:
                    error_message = f"Error: Connection failed. Details: {error_output}"
                print(error_message)
                # 오류 메시지를 UI로 보내는 로직 추가

        else:
            print("Window Debug")

        robot_id = f"robot_{uuid.uuid4().hex[:8]}"
        update_robot_config(robot_name, robot_id)

        return jsonify({
            "success": True,
            "robot_name": robot_name,
            "robot_id": robot_id
        })

    except Exception as e:
        return jsonify({"success": False, "error": f"설정 중 오류가 발생했습니다: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)