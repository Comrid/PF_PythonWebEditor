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

        # 검증
        if not all([robot_name, ssid, password]):
            return jsonify({"success": False, "error": "로봇 이름, SSID, 비밀번호를 모두 입력해주세요."}), 400
        if not (8 <= len(password) <= 63):
            return jsonify({"success": False, "error": "WiFi 비밀번호는 8자 이상, 63자 이하여야 합니다."}), 400
        if not (3 <= len(robot_name) <= 10) or not re.match(r'^[a-zA-Z0-9]+$', robot_name):
            return jsonify({"success": False, "error": "로봇 이름은 3~10자의 영문자와 숫자만 사용할 수 있습니다."}), 400

        if platform.system() == "Linux":
            try:
                # --- 수정된 부분 시작 ---
                # 1. nmcli 명령어로 WiFi 연결 정보를 저장합니다. (즉시 연결은 시도하지 않음)
                print(f"Saving connection info for SSID: {ssid}...")

                # 기존에 같은 이름(SSID)의 연결 프로필이 있다면 먼저 삭제하여 중복을 방지합니다.
                # check=False로 설정하여, 프로필이 없어서 삭제에 실패해도 오류로 처리하지 않습니다.
                delete_command = ["sudo", "nmcli", "connection", "delete", ssid]
                subprocess.run(delete_command, text=True, capture_output=True)
                print(f"Attempted to delete any existing profile named '{ssid}'.")

                # 새로운 연결 프로필을 추가합니다.
                add_command = [
                    "sudo", "nmcli", "connection", "add",
                    "type", "wifi",
                    "con-name", ssid, # 연결 이름을 SSID와 동일하게 설정
                    "ifname", "wlan0",
                    "ssid", ssid,
                    "--",
                    "wifi-sec.key-mgmt", "wpa-psk",
                    "wifi-sec.psk", password
                ]
                subprocess.run(add_command, check=True, text=True, capture_output=True, timeout=15)
                print("WiFi connection info saved successfully.")
                # --- 수정된 부분 끝 ---

                # 2. 로봇 설정 업데이트 (성공 시에만 실행)
                robot_id = f"robot_{uuid.uuid4().hex[:8]}"
                update_robot_config(robot_name, robot_id)
                print(f"Robot config updated. Name: {robot_name}, ID: {robot_id}")

                # 3. CLIENT 모드로 전환 준비
                print("Switching to CLIENT mode...")
                subprocess.run("echo 'MODE=CLIENT' | sudo tee /etc/pf_env", shell=True, check=True)
                
                # 4. 모드 전환 스크립트 실행
                subprocess.run(["sudo", "/usr/local/bin/pf-netmode-bookworm.sh"], check=True)
                print("Successfully triggered CLIENT mode switch.")
                
                return jsonify({
                    "success": True,
                    "message": "WiFi 정보 저장 성공! 클라이언트 모드로 전환합니다.",
                    "robot_name": robot_name,
                    "robot_id": robot_id
                })

            except subprocess.TimeoutExpired:
                error_message = "정보 저장 시간 초과. 시스템을 확인해주세요."
                print(f"Error: {error_message}")
                return jsonify({"success": False, "error": error_message}), 500

            except subprocess.CalledProcessError as e:
                error_output = e.stderr.strip()
                print(f"Error: nmcli command failed. Stderr: {error_output}")
                error_message = f"WiFi 정보 저장 실패: {error_output}"
                return jsonify({"success": False, "error": error_message}), 500
        else:
            # 윈도우/맥 환경에서의 테스트용
            print("Windows/macOS Debug: Simulating success.")
            robot_id = f"robot_{uuid.uuid4().hex[:8]}"
            # update_robot_config(robot_name, robot_id) # 실제 파일 쓰기는 방지
            return jsonify({
                "success": True,
                "message": "시뮬레이션 성공",
                "robot_name": robot_name,
                "robot_id": robot_id
            })

    except Exception as e:
        print(f"An unexpected error occurred: {str(e)}")
        return jsonify({"success": False, "error": f"서버 내부 오류가 발생했습니다: {str(e)}"}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)