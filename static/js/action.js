// Action.js
document.addEventListener('DOMContentLoaded', function() {
    // 버튼 이벤트 리스너 등록
    initializeButtonAction();
});

function initializeButtonAction(){
    // Editor Buttons
    const runButton = document.getElementById('runBtn');
    runButton.addEventListener('click', handleRunButtonClick);

    const stopButton = document.getElementById('stopBtn');
    stopButton.addEventListener('click', handleStopButtonClick);

    const clearOutputBtn = document.getElementById('clearOutputBtn');
    clearOutputBtn.addEventListener('click', clearOutput);

    // Widget Buttons
    const clearAllWidgetsBtn = document.getElementById('clearAllWidgetsBtn');
    clearAllWidgetsBtn.addEventListener('click', handleClearAllWidgetsClick);

    const widgetSettingsBtn = document.getElementById('widgetSettingsBtn');
    widgetSettingsBtn.addEventListener('click', handleWidgetSettingsClick);
}

//#region Editor(Run, Stop, Clear Output Button) Event Handler
// Run 버튼 클릭 이벤트 핸들러
function handleRunButtonClick() {
    if (!monacoEditor) {
        showToast(messages.editor_not_ready_msg, 'error', useConsoleDebug);
        return;
    }

    const code = monacoEditor.getValue();

    if (!code || code.trim() === '') {
        showToast(messages.code_execution_empty_msg, 'warning', useConsoleDebug);
        return;
    }

    if (socket && socket.connected) {
        socket.emit('execute_code', {code: code});
    } else {
        showToast(messages.socketio_not_loaded_msg, 'error', useConsoleDebug);
        setTimeout(() => {
            if (socket && socket.connected) {
                handleRunButtonClick();
            } else {
                showToast(messages.socketio_connect_failed_msg, 'error', useConsoleDebug);
            }
        }, 2000);
    }
}

// Stop 버튼 클릭 이벤트 핸들러
function handleStopButtonClick() {
    if (!socket || !socket.connected) {
        showToast(messages.socketio_not_connected_msg, 'error', useConsoleDebug);
        return;
    }

    if (!codeRunning) {
        showToast(messages.code_execution_not_running_msg, 'warning', useConsoleDebug);
        return;
    }

    showToast(messages.code_execution_stop_msg, 'info', useConsoleDebug);
    socket.emit('stop_execution');
}

// Clear Output 버튼 이벤트 핸들러 - 출력 패널 초기화
function clearOutput() {
    const outputContent = document.getElementById('outputContent');
    if (outputContent) {
        outputContent.innerHTML = '';
    }
}
//#endregion

//#region Widget(Add Widget, Clear All Widgets, Widget Settings Button) Event Handler
// Add Widget 버튼 클릭 이벤트
function handleAddWidgetClick() {
    console.log('Add Widget button clicked');

    // 현재는 이미지 디스플레이 위젯만 생성
    // 나중에 위젯 선택 모달이나 드롭다운으로 확장 가능
    const widgetId = createWidget_ImageDisplay();

    if (widgetId) {
        console.log(`Widget created successfully: ${widgetId}`);
        // 성공 메시지 표시 (선택사항)
        showToast('이미지 디스플레이 위젯이 생성되었습니다: ' + widgetId, 'success');
    } else {
        console.error('Failed to create widget');
        showToast('위젯 생성에 실패했습니다.', 'error');
    }
}

// Clear All 버튼 클릭 이벤트
function handleClearAllWidgetsClick() {
    console.log('Clear All Widgets button clicked');

    if (window.mainGridStack) {
        // 코드 에디터와 출력 패널을 제외한 모든 위젯 제거
        const widgets = window.mainGridStack.getGridItems();
        widgets.forEach(widget => {
            const widgetId = widget.getAttribute('id');
            if (widgetId !== 'codeEditorWidget' && widgetId !== 'outputPanelWidget') {
                window.mainGridStack.removeWidget(widget);
            }
        });

        // 카운터 초기화
        numImageDisplayWidget = 0;
        numTextDisplayWidget = 0;

        // 웹캠 스트림 중지 및 카운터 초기화
        stopAllWebcamStreams();
        numWebcamDisplayWidget = 0;
        webcamRunning = false;

        showToast('모든 위젯이 제거되었습니다.', 'info');
    }
}

// 위젯 설정 버튼 클릭 이벤트
function handleWidgetSettingsClick() {
    console.log('Widget Settings button clicked');
    // 위젯 설정 모달이나 패널 표시 (향후 구현)
    showToast('위젯 설정 기능은 준비 중입니다.', 'info');
}
//#endregion
