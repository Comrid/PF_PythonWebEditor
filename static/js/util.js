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
});

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
        #time.sleep(1)


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
from findee import Findee

robot = Findee()

from time import sleep

while(1):
    frame = robot.camera.get_frame()
    height, width = frame.shape[:2]
    center = (width // 2, height // 2)
    cv2.circle(frame, center, 50, (0, 255, 0), 2)
    emit_image(frame)
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
        #time.sleep(1)


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
from findee import Findee

robot = Findee()

try:
    # 여기에 코드를 작성해주세요.
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
from findee import Findee
import time

robot = Findee()
robot.camera.start_frame_capture()

fps = 30
interval = 1 / fps

try:
    while True:
        start = time.time()
        emit_image(robot.camera.current_frame, 'Camera')
        emit_text(f"Time for 1 frmae: {(time.time() - start)*1000:.3f}ms", 'Text')
        time.sleep(interval)
except Exception as e:
    print(e)
finally:
    robot.cleanup()`;
}

// 모터 예제 코드
function getMotorExampleCode(){
    return `# Motor Example Code
from findee import Findee
import time

robot = Findee()

try:
    robot.motor.move_forward(100, 1) # 100%의 속도로 1초 동안 전진

    robot.motor.move_backward(100) # 100%의 속도로 후진
    time.sleep(1)
    robot.motor.stop() # 방향만 반대이고 첫 줄과 동일한 시간 효과

    robot.motor.turn_left(50, 2) # 50%의 속도로 2초 동안 제자리 좌회전
    robot.motor.turn_right(70, 1.5) # 70%의 속도로 1.5초 동안 제자리 우회전

    robot.motor.curve_left(100, 30, 2) # 100%의 속도로 30도 각도로 왼쪽 커브
    robot.motor.curve_right(70, 10, 1) # 70%의 속도로 10도 각도로 오른쪽 커브
except Exception as e:
    print(e)
finally:
    robot.cleanup()`;
}

// 초음파 예제 코드
function getUltrasonicExampleCode(){
    return `# Ultrasonic Example Code
from findee import Findee
import time

robot = Findee()
close_threshold = 5
far_threshold = 20

try:
    while True:
        distance = robot.ultrasonic.get_distance()
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

function getObstacleAvoidanceExampleCode(){
    return `# Obstacle Avoidance Example Code
from findee import Findee
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

def read_distance(robot: "Findee", *, samples: int) -> dict:
    vals = []
    for _ in range(samples):
        d = robot.ultrasonic.get_distance()
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

def apply_action(robot: "Findee", action: dict, cfg: dict) -> None:
    cmd = action["command"]
    if cmd == "FORWARD":
        robot.motor.move_forward(action["speed"])
    elif cmd == "STOP":
        robot.motor.stop()
    elif cmd == "AVOID":
        robot.motor.stop()
        sleep(0.05)
        if action["dir"] == "LEFT": robot.motor.turn_left(cfg["speed_slow"], action["t"])
        else: robot.motor.turn_right(cfg["speed_slow"], action["t"])
    elif cmd == "RECOVER":
        robot.motor.move_backward(cfg["speed_slow"], cfg["t_back"])
        robot.motor.turn_right(cfg["speed_slow"], cfg["t_turn"] * 2.0)

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
        robot.motor.stop()
        robot.cleanup()

loop()`;
}

function getMediapipeExampleCode(){
    return `# Mediapipe Example Code
from findee import Findee
from time import sleep

robot = Findee()
interval = 0.2

try:
    while True:
        Hand1Gesture = get_gesture().get("Hand1").get("gesture")
        Hand2Gesture = get_gesture().get("Hand2").get("gesture")
        emit_text(f"Hand1 : {Hand1Gesture}  |  Hand2 : {Hand2Gesture}", "Gestures")
        command = "정지"
        speed = 100

        if Hand1Gesture == "Pointing_Up": # 전진
            if Hand2Gesture == "Thumb_Up": # 오른쪽 커브
                command = "오른쪽 커브"
                robot.motor.curve_right(speed, 30)
            elif Hand2Gesture == "Thumb_Down": # 왼쪽 커브
                command = "왼쪽 커브"
                robot.motor.curve_left(speed, 30)
            else:
                command = "전진"
                robot.motor.move_forward(speed)
        elif Hand1Gesture == "Victory":
            command = "후진"
            robot.motor.move_backward(speed)
        elif Hand1Gesture == "Thumb_Up":
            command = "제자리 우회전"
            robot.motor.turn_right(speed)
        elif Hand1Gesture == "Thumb_Down":
            command = "제자리 좌회전"
            robot.motor.turn_left(speed)

        else:
            command = "정지"
            robot.motor.stop()

        emit_text(command, "Command")
        emit_image(robot.camera.get_frame(), "RobotCam")
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