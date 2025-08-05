// Toast with console debug
const useConsoleDebug = true;
//window.messages = messages;

// global variables
let isConnected = false;
let codeRunning = false;
let monacoEditor = null;

// messages
const messages = {
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
    'editor_init_failed_msg': 'Monaco Editor 초기화에 실패했습니다.',
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

function showWelcomeToast() {
    setTimeout(() => {showToast(messages.welcome_msg, 'success');}, 1000);
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

function clearOutput() {
    // 출력 패널 초기화
    const outputContent = document.getElementById('outputContent');
    if (outputContent) {
        outputContent.innerHTML = '';
    }
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
    return getCode5();
}

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
        emit_image(random_image1, 'imageDisplayWidget_0')
        emit_image(random_image2, 'imageDisplayWidget_1')

        time.sleep(interval)
        #time.sleep(1)


except KeyboardInterrupt:
    print("전송 중지됨")`;
}