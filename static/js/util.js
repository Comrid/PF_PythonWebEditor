// Import Util.js First
// # Function List
// - showWelcomeToast()
// - addOutput()
// - clearOutput()
// - updateExecutionStatus()
// - updateRunButtons()
// - updateConnectionStatus()
// 나머진 코드 관련

document.addEventListener('DOMContentLoaded', function() {
    console.info('DOM Content Loaded');
    showToast(messages.welcome_msg, 'success');
    loadVideoDevices();

    // Gemini API 키 설정 확인
    checkGeminiAPIKey();
});

// Gemini API 키 확인 및 설정
function checkGeminiAPIKey() {
    // 환경변수에서 API 키 확인 (서버에서 전달받은 경우)
    if (typeof window.GEMINI_API_KEY !== 'undefined' && window.GEMINI_API_KEY) {
        console.log('Gemini API 키가 환경변수에서 설정되었습니다.');
        return;
    }

    // 로컬 스토리지에서 API 키 확인
    const storedKey = localStorage.getItem('GEMINI_API_KEY');
    if (storedKey) {
        window.GEMINI_API_KEY = storedKey;
        console.log('Gemini API 키가 로컬 스토리지에서 로드되었습니다.');
        return;
    }

    // API 키가 없는 경우 사용자에게 안내
    showToast('Gemini API 키가 설정되지 않았습니다. 설정에서 API 키를 입력하세요.', 'warning');
}

// API 키 설정 함수 (사용자가 직접 입력할 수 있도록)
function setGeminiAPIKey(apiKey) {
    if (apiKey && apiKey.trim()) {
        window.GEMINI_API_KEY = apiKey.trim();
        localStorage.setItem('GEMINI_API_KEY', apiKey.trim());
        showToast('Gemini API 키가 설정되었습니다.', 'success');

        // LLM 자동 로드 시도
        if (typeof window.loadLLM === 'function') {
            window.loadLLM().catch(() => {});
        }
    } else {
        showToast('유효한 API 키를 입력하세요.', 'error');
    }
}

// 전역 함수로 노출
window.setGeminiAPIKey = setGeminiAPIKey;

// Toast with console debug
const useConsoleDebug = true;

// global variables
let isConnected = false;
let codeRunning = false;
let monacoEditor = null;
let fontSize = 16;

// Widget Variables
let numImageDisplayWidget = 0;
let numTextDisplayWidget = 0;
let numWebcamDisplayWidget = 0;
let numSliderWidget = 0;
let numPidControllerWidget = 0;
let aiAssistantRunning = false; // single-instance guard for AI Assistant
let aiControllerRunning = false; // single-instance guard for AI Controller

// Webcam globals
let webcamStreams = new Map();
let videoInputDevices = [];

let webcamRunning = false;
let mediapipeRunning = false;

async function loadVideoDevices() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            showToast(messages.navigator_media_devices_not_supported_msg, 'warning', useConsoleDebug);
            return;
        }
        const devices = await navigator.mediaDevices.enumerateDevices();
        videoInputDevices = devices.filter(d => d.kind === 'videoinput');
        maxWebcamCount = videoInputDevices.length;
        if (maxWebcamCount === 0) {
            showToast(messages.navigator_no_camera_found_msg, 'warning', useConsoleDebug);
        }
    } catch (e) {
        showToast(messages.navigator_media_devices_enumerate_devices_error_msg, 'error', useConsoleDebug);
    }
}

// Hand Gesture globals (per-widget control)
window.handGestureEnabledByWidget = window.handGestureEnabledByWidget || new Map();
window.handGestureHandsByWidget = window.handGestureHandsByWidget || new Map();
window.handGestureRafByWidget = window.handGestureRafByWidget || new Map();
window.mediapipeHandsLibLoaded = window.mediapipeHandsLibLoaded || false;
// Latest gesture result storage (per widget)
window.gestureLastResultByWidget = window.gestureLastResultByWidget || new Map();
// Latest LLM answer storage (frontend-side; single instance expected)
window.llmLastAnswer = window.llmLastAnswer || '';
// Ensure AI Assistant guard is accessible via window namespace
window.aiAssistantRunning = window.aiAssistantRunning || aiAssistantRunning;

// Blob URL cache for image widgets to revoke old URLs and avoid leaks
window.__imageBlobUrlByWidget = window.__imageBlobUrlByWidget || new Map();




// messages
const messages = {
    // navigator
    'navigator_media_devices_not_supported_msg': '이 브라우저는 카메라 열거를 지원하지 않습니다.',
    'navigator_no_camera_found_msg': '연결된 카메라를 찾을 수 없습니다.',
    'navigator_media_devices_enumerate_devices_error_msg': '카메라 장치 목록을 가져오는 중 오류가 발생했습니다.',

    'welcome_msg': 'Welcome to Findee Python Web Editor!',
    'error_msg': 'An error occurred',
    'warning_msg': 'A warning occurred',
    'info_msg': 'An info message',
    'success_msg': 'A success message',

    // action.js
    'editor_not_ready_msg': 'Monaco Editor가 초기화되지 않았습니다.',
    'code_not_found_msg': 'Code not found',
    'connection_failed_msg': 'Connection failed',
    'execution_stopped_msg': 'Execution stopped',
    'execution_started_msg': 'Execution started',
    'execution_completed_msg': 'Execution completed',
    'code_execution_empty_msg': '실행할 코드가 없습니다.',
    // socket-handler.js
    'socketio_not_loaded_msg': 'Socket.IO가 초기화되지 않았습니다.',
    'socketio_connecting_error_msg': 'Socket.IO 연결 중 오류가 발생했습니다.',
    'socketio_connect_failed_msg': '연결에 실패했습니다. 페이지를 새로고침해주세요.',
    'server_connected_msg': '서버에 연결되었습니다.',
    'server_disconnected_msg': '서버와의 연결이 끊어졌습니다.',
    'code_execution_started_msg': '코드 실행을 시작합니다.',
    'code_execution_stop_msg': '코드 실행을 중지합니다.',
    'code_execution_stopped_msg': '코드 실행이 중지되었습니다.',
    'code_execution_not_running_msg': '실행 중인 코드가 없습니다.',
    'code_execution_completed_msg': '코드 실행이 완료되었습니다.',
    'code_execution_error_msg': '코드 실행 중 오류가 발생했습니다.',

    // editor.js
    'monaco_edirtor_loader_load_fail_msg': 'Monaco Editor 로더 로드 실패',
    'editor_init_failed_msg': 'Monaco Editor 초기화에 실패했습니다.',

    // socket-handler missing key fix
    'socketio_not_connected_msg': 'Socket.IO가 연결되어 있지 않습니다.'
}


// html control functions
function showToast(message, type = 'info', console_debug = false) {
    // message: message
    // type: info, success, warning, error
    // console_debug: console use

    if (console_debug) {
        // console은 log, info, warn, error, debug
        switch (type) {
            case 'info': console.info(message); break;
            case 'success': console.log("%c" + message, "color: green;"); break;
            case 'warning': console.warn(message); break;
            case 'error': console.error(message); break;
            default: console.log(message); break;
        }
    }

    // toast는 info, success, warning, error
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {toast.remove();}, 3000);
}

function addOutput(message, type = 'info') {
    // outputContent에 출력 메시지 추가
    const outputContent = document.getElementById('outputContent');

    const outputItem = document.createElement('div');

    // type: system, success, warning, error
    outputItem.className = `output-item ${type}`;
    outputItem.textContent = message;
    outputContent.appendChild(outputItem);

    outputContent.scrollTop = outputContent.scrollHeight;
}

function updateExecutionStatus(status) {
    // executionStatus 텍스트 업데이트
    const statusElement = document.getElementById('executionStatus');
    if (statusElement) {
        statusElement.textContent = status;
    }
}

function updateRunButtons(running) {
    // 코드 실행 중 runBtn, stopBtn 버튼 상태 업데이트
    const runButton = document.getElementById('runBtn');
    const stopButton = document.getElementById('stopBtn');

    if (runButton) {
        runButton.disabled = running;
        runButton.style.opacity = running ? '0.5' : '1';
    }

    if (stopButton) {
        stopButton.disabled = !running;
        stopButton.style.opacity = !running ? '0.5' : '1';
    }
}

function updateConnectionStatus(connected) {
    // update status dot and text(화면 우측 상단)
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    if (statusDot && statusText) {
        statusDot.className = 'status-dot';
        if (connected) {
            statusText.textContent = 'Connected';
        } else {
            statusDot.classList.add('error');
            statusText.textContent = 'Disconnected';
        }
    }
}

function getInitialCode() {
    return getEditorDefaultCode();
}

//#region Custom Code
function getCode1(){
    return `from time import sleep
i = 1
while(True):
    print(i)
    i+=1
    sleep(0.1)`;
}

function getCode2(){
    return `import numpy as np
import cv2
import time

# 30fps = 1/30초 간격
fps = 30
interval = 1.0 / fps

print(f"30fps 랜덤 이미지 전송 시작 (간격: {interval:.3f}초)")

try:
    while True:
        # 640x480 1채널 랜덤 이미지 생성
        start = time.time()
        random_image = np.random.randint(0, 256, (480, 640), dtype=np.uint8)

        # 이미지 전송
        emit_image(random_image, 'image_data')

        # 30fps 간격으로 대기
        print(f"time = {time.time() - start}")
        time.sleep(interval)

except KeyboardInterrupt:
    print("전송 중지됨")`;
}

function getCode3(){
    return `from time import sleep
for i in range(20):
    print(i)
    sleep(0.1)`;
}

function getCode4(){
    return `import cv2

robot = Findee()

from time import sleep

while(1):
    frame = robot.get_frame()
    height, width = frame.shape[:2]
    center = (width // 2, height // 2)
    cv2.circle(frame, center, 50, (0, 255, 0), 2)
    emit_image(frame, 'RobotCam')
    sleep(0.05)`;
}

function getCode5(){
    return `import numpy as np
import cv2
import time

# 30fps = 1/30초 간격
fps = 30
interval = 1.0 / fps

print(f"30fps 랜덤 이미지 전송 시작 (간격: {interval:.3f}초)")

try:
    while True:
        # 640x480 1채널 랜덤 이미지 생성
        start = time.time()
        random_image1 = np.random.randint(0, 256, (480, 640), dtype=np.uint8)
        random_image2 = np.random.randint(50, 100, (100, 100), dtype=np.uint8)

        # 이미지 전송
        emit_image(random_image1, 'Image_0')
        emit_image(random_image2, 'Image_1')

        time.sleep(interval)

except KeyboardInterrupt:
    print("전송 중지됨")`;
}

function getCode6(){
    return `import numpy as np
import cv2
import time

# 30fps = 1/30초 간격
fps = 30
interval = 1.0 / fps

print(f"30fps 랜덤 이미지 전송 시작 (간격: {interval:.3f}초)")
cnt = 1

while True:
    # 640x480 1채널 랜덤 이미지 생성
    start = time.time()
    random_image1 = np.random.randint(0, 256, (480, 640), dtype=np.uint8)
    random_image2 = np.random.randint(50, 100, (100, 100), dtype=np.uint8)

    # 이미지 전송
    emit_image(random_image1, 'Image_0')
    emit_image(random_image2, 'Image_1')
    print(f"{cnt}: Display Success!")
    cnt += 1

    time.sleep(interval)`;
}
//#endregion

// 기본 코드
function getEditorDefaultCode(){
    return `# Pathfinder Python Web Editor

robot = Findee()

try:
    pass # 여기에 코드를 작성해주세요.

except Exception as e:
    print(e)
finally:
    robot.cleanup()`;
}

// 에디터 사용 예제 코드
function getEditorExampleCode(){
    return `# Editor Example Code
import numpy

# 이 에디터에서만 사용 가능한 함수인 emit_image(), emit_text()
# 를 사용하는 방법에 대한 예제입니다.
# Run 버튼을 눌러 결과를 확인해보세요!

random_image = numpy.random.randint(0, 255, (50, 50, 3), dtype=numpy.uint8)
emit_image(random_image, "Image_0") # 전달할 이미지, 이미지를 띄울 위젯의 이름

random_image = numpy.random.randint(0, 255, (48, 64, 3), dtype=numpy.uint8)
emit_image(random_image, "Random_Image") # 이미지 위젯의 이름은 변경 가능

random_number = numpy.random.randint(0, 100)
text = f"Random Number1: {random_number}"
emit_text(text, "Text_0") # 전달할 텍스트, 텍스트를 띄울 위젯의 이름

random_number = numpy.random.randint(0, 100)
text = f"Random Number2: {random_number}"
emit_text(text, "Random_Text") # 텍스트 위젯의 이름은 변경 가능`;
}

// 카메라 예제 코드
function getCameraExampleCode(){
    return `# Camera Example Code
import time

robot = Findee()

fps = 30
interval = 1 / fps

try:
    while True:
        start = time.time()
        frame = robot.get_frame()
        emit_image(frame, 'Camera')
        emit_text(f"Time for 1 frame: {(time.time() - start)*1000:.3f}ms", 'Text')
        time.sleep(interval)
except Exception as e:
    print(e)
finally:
    robot.cleanup()`;
}

// 모터 예제 코드
function getMotorExampleCode(){
    return `# Motor Example Code
import time

robot = Findee()

try:
    robot.move_forward(100, 1.0) # 100%의 속도로 1초 동안 전진

    robot.move_backward(100) # 100%의 속도로 후진
    time.sleep(1)
    robot.stop() # 방향만 반대이고 첫 줄과 동일한 시간 효과

    robot.turn_left(50, 2.0) # 50%의 속도로 2초 동안 제자리 좌회전
    robot.turn_right(70, 1.5) # 70%의 속도로 1.5초 동안 제자리 우회전

    robot.curve_left(100, 30, 2.0) # 100%의 속도로 30도 각도로 왼쪽 커브
    robot.curve_right(70, 10, 1.0) # 70%의 속도로 10도 각도로 오른쪽 커브
except Exception as e:
    print(e)
finally:
    robot.cleanup()`;
}

// 초음파 예제 코드
function getUltrasonicExampleCode(){
    return `# Ultrasonic Example Code
import time

robot = Findee()
close_threshold = 5
far_threshold = 20

try:
    while True:
        distance = robot.get_distance()
        emit_text(f"Distance: {distance}cm", "Dis")

        if(distance <= close_threshold):
            text = f"{close_threshold}cm 이하"
        elif(distance < far_threshold):
            text = f"{close_threshold}cm 이상 {far_threshold}cm 이하"
        else:
            text = f"{far_threshold}cm 이상"
        emit_text(f"거리 상태: {text}", "State")

        time.sleep(0.1)
except Exception as e:
    print(e)
finally:
    robot.cleanup()`;
}

// 차선 인식 예제 코드
function getLaneDetectionExampleCode(){
    return `# Lane Detection Example Code
import cv2
import numpy as np
import time

def detect_lanes(image):
    # 그레이스케일 변환
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # 가우시안 블러
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Canny 엣지 검출
    edges = cv2.Canny(blurred, 50, 150)

    # 관심 영역 설정 (ROI)
    height, width = edges.shape
    roi_vertices = np.array([
        [(0, height), (width/2, height/2), (width, height)]
    ], dtype=np.int32)

    # 마스크 적용
    mask = np.zeros_like(edges)
    cv2.fillPoly(mask, roi_vertices, 255)
    masked_edges = cv2.bitwise_and(edges, mask)

    # Hough 변환으로 직선 검출
    lines = cv2.HoughLinesP(masked_edges, 1, np.pi/180, 50,
                           minLineLength=100, maxLineGap=50)

    # 결과 그리기
    result = image.copy()
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            cv2.line(result, (x1, y1), (x2, y2), (0, 255, 0), 2)

    return result

# Findee 카메라에서 실시간 차선 인식
robot = Findee()

try:
    while True:
        # Findee 카메라에서 프레임 가져오기
        frame = robot.get_frame()

        # 차선 인식
        result = detect_lanes(frame)

        # 결과 전송
        emit_image(result, "LaneDetection")
        emit_text("차선 인식 완료", "Status")

        time.sleep(0.1)
except Exception as e:
    print(e)
finally:
    robot.cleanup()`;
}

// 장애물 회피 예제 코드
function getObstacleAvoidanceExampleCode(){
    return `# Obstacle Avoidance Example Code
from time import sleep, time
import random

# RORO 스타일 구성/상태
def get_config() -> dict:
    return {
        "loop_hz": 10,
        "median_samples": 5,
        "stop_threshold": 8.0,       # cm
        "avoid_threshold": 20.0,     # cm
        "clear_threshold": 30.0,     # cm
        "hysteresis_margin": 2.0,    # cm
        "speed_fast": 70,
        "speed_slow": 40,
        "t_turn": 0.5,               # s
        "t_back": 0.3,               # s
        "stuck_timeout": 3.0,        # s (이 시간 동안 개선 없으면 복구)
        "max_avoid_tries": 4,
    }

def read_distance(robot, *, samples: int) -> dict:
    vals = []
    for _ in range(samples):
        d = robot.get_distance()
        if d and 1.0 <= d <= 400.0: vals.append(float(d))
        sleep(0.001)
    if not vals: return {"is_valid": False, "distance_cm": None}
    vals.sort()
    mid = vals[len(vals)//2]
    return {"is_valid": True, "distance_cm": mid}

def classify(distance_cm: float, cfg: dict) -> str:
    m = cfg["hysteresis_margin"]
    if distance_cm < cfg["stop_threshold"]: return "TOO_CLOSE"
    if distance_cm < cfg["avoid_threshold"] - m: return "APPROACHING"
    if distance_cm >= cfg["clear_threshold"]: return "CLEAR"
    return "APPROACHING"

def decide_action(state: dict, reading: dict, cfg: dict) -> dict:
    if not reading["is_valid"]:
        return {"command": "STOP"}  # 센서 불가 → 보수적으로 정지
    d = reading["distance_cm"]
    phase = classify(d, cfg)
    if phase == "CLEAR":
        state["approach_since"] = None
        state["avoid_tries"] = 0
        return {"command": "FORWARD", "speed": cfg["speed_fast"], "note": f"{d:.1f}cm"}
    if phase == "APPROACHING":
        state.setdefault("approach_since", time())
        return {"command": "FORWARD", "speed": cfg["speed_slow"], "note": f"{d:.1f}cm"}
    # TOO_CLOSE: 회피
    dir_pref = state.get("last_turn", random.choice(["LEFT", "RIGHT"]))
    # 번갈아 + 랜덤 소량
    turn_dir = "RIGHT" if dir_pref == "LEFT" else "LEFT" if random.random() < 0.5 else dir_pref
    state["last_turn"] = turn_dir
    state["avoid_tries"] = state.get("avoid_tries", 0) + 1
    if state["avoid_tries"] > cfg["max_avoid_tries"] or (state.get("stuck_since") and time()-state["stuck_since"] > cfg["stuck_timeout"]):
        state["avoid_tries"] = 0
        state["stuck_since"] = None
        return {"command": "RECOVER"}  # 후진+대회전
    state.setdefault("stuck_since", time())
    return {"command": "AVOID", "dir": turn_dir, "t": cfg["t_turn"], "note": f"{d:.1f}cm"}

def apply_action(robot, action: dict, cfg: dict) -> None:
    cmd = action["command"]
    if cmd == "FORWARD":
        robot.move_forward(action["speed"])
    elif cmd == "STOP":
        robot.stop()
    elif cmd == "AVOID":
        robot.stop()
        sleep(0.05)
        if action["dir"] == "LEFT": robot.turn_left(cfg["speed_slow"], action["t"])
        else: robot.turn_right(cfg["speed_slow"], action["t"])
    elif cmd == "RECOVER":
        robot.move_backward(cfg["speed_slow"], cfg["t_back"])
        robot.turn_right(cfg["speed_slow"], cfg["t_turn"] * 2.0)

def loop():
    cfg = get_config()
    robot = Findee()
    hz = cfg["loop_hz"]
    dt = 1.0 / hz
    state = {"last_turn": "LEFT", "avoid_tries": 0, "stuck_since": None, "approach_since": None}
    try:
        while True:
            reading = read_distance(robot, samples=cfg["median_samples"])
            action = decide_action(state, reading, cfg)
            apply_action(robot, action, cfg)
            msg = f"{action['command']} | note={action.get('note','-')} | tries={state.get('avoid_tries',0)}"
            emit_text(msg, "State")
            sleep(dt)
    except Exception as e:
        emit_text(f"ERR: {e}", "State")
    finally:
        robot.stop()
        robot.cleanup()

loop()`;
}

function getMediapipeExampleCode(){
    return `# Mediapipe Example Code
from time import sleep

robot = Findee()
interval = 0.2

try:
    while True:
        Hand1Gesture = get_gesture().get("Hand1", {}).get("gesture", "None")
        Hand2Gesture = get_gesture().get("Hand2", {}).get("gesture", "None")
        emit_text(f"Hand1 : {Hand1Gesture}  |  Hand2 : {Hand2Gesture}", "Gestures")
        command = "정지"
        speed = 100

        if Hand1Gesture == "Pointing_Up": # 전진
            if Hand2Gesture == "Thumb_Up": # 오른쪽 커브
                command = "오른쪽 커브"
                robot.curve_right(speed, 30)
            elif Hand2Gesture == "Thumb_Down": # 왼쪽 커브
                command = "왼쪽 커브"
                robot.curve_left(speed, 30)
            else:
                command = "전진"
                robot.move_forward(speed)
        elif Hand1Gesture == "Victory":
            command = "후진"
            robot.move_backward(speed)
        elif Hand1Gesture == "Thumb_Up":
            command = "제자리 우회전"
            robot.turn_right(speed)
        elif Hand1Gesture == "Thumb_Down":
            command = "제자리 좌회전"
            robot.turn_left(speed)
        else:
            command = "정지"
            robot.stop()

        emit_text(command, "Command")
        emit_image(robot.get_frame(), "RobotCam")
        sleep(interval)
except Exception as e:
    print(e)
finally:
    robot.cleanup()`;
}

function getSliderExampleCode(){
    return `# Slider Example Code
import numpy as np
import cv2
import math
import time

# 출력할 위젯 ID
IMAGE_WIDGET = "Image_0"

H, W = 200, 200
cx, cy = W // 2, H // 2
radius = 70

while True:
    # Slider_0: 꼭짓점 개수(3~100)
    n = int(get_slider_value("Slider_0"))
    if n < 3: n = 3
    if n > 100: n = 100

    # Slider_1: 색상(R,G,B) - 내부 슬라이더 3개
    r, g, b = map(int, get_slider_value("Slider_1"))

    # 배경(흰색)
    img = np.full((H, W, 3), 255, dtype=np.uint8)

    # 정N각형 꼭짓점 계산
    pts = []
    for k in range(n):
        ang = 2 * math.pi * k / n - math.pi / 2
        x = int(cx + radius * math.cos(ang))
        y = int(cy + radius * math.sin(ang))
        pts.append([x, y])
    pts = np.array(pts, dtype=np.int32).reshape((-1, 1, 2))

    # 도형 채우기 (OpenCV는 BGR 순서)
    cv2.fillPoly(img, [pts], color=(b, g, r))

    emit_image(img, IMAGE_WIDGET)
    time.sleep(0.05)`;
}

// PID 제어 예제 코드
function getPIDControlExampleCode(){
    return `# PID Control Example Code
import time

robot = Findee()

# PID 제어를 위한 변수들
target_distance = 20.0  # 목표 거리 (cm)
current_distance = 0.0
last_error = 0.0
integral = 0.0

# PID 계수 (위젯에서 조정 가능)
Kp = 1.0  # 비례 계수
Ki = 0.1  # 적분 계수
Kd = 0.05 # 미분 계수

def pid_control(error):
    global last_error, integral

    # 비례 항
    proportional = Kp * error

    # 적분 항
    integral += error * 0.1  # 0.1초 간격
    integral = max(-100, min(100, integral))  # 적분 한계

    # 미분 항
    derivative = Kd * (error - last_error) / 0.1

    # PID 출력 계산
    output = proportional + Ki * integral + derivative

    # 출력 범위 제한 (-100 ~ 100)
    output = max(-100, min(100, output))

    last_error = error
    return output

try:
    while True:
        # 현재 거리 읽기
        current_distance = robot.get_distance()

        # 오차 계산
        error = target_distance - current_distance

        # PID 제어
        control_output = pid_control(error)

        # 모터 제어
        if abs(error) < 2.0:  # 목표 거리 근처면 정지
            robot.stop()
            action = "STOP"
        elif error > 0:  # 너무 멀면 전진
            speed = int(abs(control_output))
            robot.move_forward(speed)
            action = f"FORWARD({speed}%)"
        else:  # 너무 가까우면 후진
            speed = int(abs(control_output))
            robot.move_backward(speed)
            action = f"BACKWARD({speed}%)"

        # 상태 출력
        status_text = f"거리: {current_distance:.1f}cm, 목표: {target_distance}cm, 오차: {error:.1f}cm"
        emit_text(status_text, "Distance")

        control_text = f"제어: {action}, PID 출력: {control_output:.1f}"
        emit_text(control_text, "Control")

        # PID 값들 출력
        pid_text = f"P: {Kp}, I: {Ki}, D: {Kd}"
        emit_text(pid_text, "PID Values")

        time.sleep(0.1)

except Exception as e:
    print(f"PID 제어 오류: {e}")
finally:
    robot.stop()
    robot.cleanup()`;
}

function getCode7(){
    return `import threading
import psutil
import time
def monitor_cpu_background(interval: float = 1.0, stop_event = None):
    if stop_event is None:
        stop_event = threading.Event()

    def _monitor():
        print("CPU 모니터링 시작 (백그라운드)")
        print("=" * 40)

        while not stop_event.is_set():
            try:
                cpu_percent = psutil.cpu_percent(interval=interval)
                cpu_per_core = psutil.cpu_percent(interval=interval, percpu=True)

                print(f"CPU: {cpu_percent:5.1f}% | "
                      f"코어별: {', '.join([f'{u:4.1f}%' for u in cpu_per_core])}")

            except Exception as e:
                print(f"모니터링 오류: {e}")
                break

    monitor_thread = threading.Thread(target=_monitor, daemon=True)
    monitor_thread.start()

    return stop_event
stop_monitoring = monitor_cpu_background(interval=1.0)


# Pathfinder Python Web Editor

robot = Findee()

try:
    while True:
        frame = robot.get_frame()
        emit_image(frame, "Image_0")
        time.sleep(0.05)
except Exception as e:
    print(e)
finally:
    robot.cleanup()
    stop_monitoring.set()`;
}




// Ctrl + 휠 확대/축소 방지
document.addEventListener('wheel', function(e) {
    if (e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
}, { passive: false });

// 추가적인 확대/축소 방지 (키보드 단축키)
document.addEventListener('keydown', function(e) {
    // Ctrl + '+' (확대)
    if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
    
    // Ctrl + '-' (축소)
    if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
    
    // Ctrl + 0 (100%로 복원)
    if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
});

// 터치 제스처 확대/축소 방지 (모바일/태블릿)
document.addEventListener('gesturestart', function(e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
});

document.addEventListener('gesturechange', function(e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
});

document.addEventListener('gestureend', function(e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
});