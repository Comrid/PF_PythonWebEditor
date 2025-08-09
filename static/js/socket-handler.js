function initializeSocket() {
    try {
        if (typeof window.io === 'undefined') {
            showToast(messages.socketio_not_loaded_msg, 'error', useConsoleDebug);
            return;
        }

        socket = window.io();

        // Listener

        //#region connect and disconnect events
        socket.on('connect', function() {
            isConnected = true;
            updateRunButtons(false);
            updateConnectionStatus(true);
            showToast(messages.server_connected_msg, 'success', useConsoleDebug);
        });
        socket.on('disconnect', function() {
            isConnected = false;
            updateRunButtons(true);
            updateConnectionStatus(false);
            showToast(messages.server_disconnected_msg, 'error', useConsoleDebug);
        });
        //#endregion

        //#region execution events
        socket.on('execution_started', function() {
            codeRunning = true;
            updateRunButtons(true);
            updateExecutionStatus('실행 중');
            showToast(messages.code_execution_started_msg, 'info', useConsoleDebug);
        });
        socket.on('execution_stopped', function() {
            codeRunning = false;
            updateRunButtons(false);
            updateExecutionStatus('중지됨');
            showToast(messages.code_execution_stopped_msg, 'warning', useConsoleDebug);
        });
        socket.on('finished', function() {
            codeRunning = false;
            updateRunButtons(false);
            updateExecutionStatus('완료');
            showToast(messages.code_execution_completed_msg, 'success', useConsoleDebug);
            addOutput('execution ended', 'success');
        });
        socket.on('execution_error', function(data) {
            codeRunning = false;
            updateRunButtons(false);
            updateExecutionStatus('오류');
            showToast(messages.code_execution_error_msg + data.error, 'error', useConsoleDebug);
        });
        //#endregion

        //#region stdout and stderr events
        socket.on('stdout', function(data) {
            addOutput(data.output, 'info');
        });
        socket.on('stderr', function(data) {
            addOutput(data.output, 'error');
        });
        //#endregion

        //#region image_data event, custom_data event
        socket.on('image_data', function(data) {
            console.log('Received image_data event for widget:', data.widget_id);
            if (data.image) {handleImageUpdate(data.image, data.widget_id);}
        });
        socket.on('text_data', function(data) {
            console.log('Received text_data event:', data);
            if(data.text) {handleTextUpdate(data.text, data.widget_id);}
        });
        //#endregion

    } catch (error) {
        showToast(messages.socketio_connecting_error_msg, 'error', useConsoleDebug);
    }
}





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

