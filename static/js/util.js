// 전역 변수들
let isConnected = false;
let codeRunning = false;

//region Toast
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {toast.remove();}, 3000);
}

function showWelcomeToast() {
    setTimeout(() => {showToast('Welcome to Findee Python Web Editor!', 'success');}, 100);
}
//endregion

//region Execution Status
// 실행 상태 업데이트 함수
function updateExecutionStatus(status) {
    const statusElement = document.getElementById('executionStatus');
    if (statusElement) {
        statusElement.textContent = status;
    }
}

// 실행 버튼 상태 업데이트 함수
function updateExecutionButtons(running) {
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

// 출력 메시지 추가 함수
function addOutput(message, type = 'info') {
    const outputContent = document.querySelector('.output-content');
    if (!outputContent) return;

    const outputItem = document.createElement('div');
    outputItem.className = `output-item ${type}`;
    outputItem.textContent = message;

    outputContent.appendChild(outputItem);

    // 자동 스크롤
    outputContent.scrollTop = outputContent.scrollHeight;
}

// Export functions for global use
window.showToast = showToast;
window.showWelcomeToast = showWelcomeToast;
window.updateExecutionStatus = updateExecutionStatus;
window.updateExecutionButtons = updateExecutionButtons;
window.addOutput = addOutput;