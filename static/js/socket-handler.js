// Socket-Handler.js
document.addEventListener('DOMContentLoaded', function() {
    // Socket 초기화
    initializeSocket();
});

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
            // console.log('Received image_data event for widget:', data.widget_id);
            if (!data || !data.image) return;

            try {
                // 바이너리(ArrayBuffer/Uint8Array/Blob) → Blob URL 변환
                let blobUrl = null;
                const fmt = (data.format || 'jpeg').toLowerCase();

                if (typeof Blob !== 'undefined' && data.image instanceof Blob) {
                    const blob = data.image.type ? data.image : new Blob([data.image], { type: `image/${fmt}` });
                    blobUrl = URL.createObjectURL(blob);
                } else if (data.image instanceof ArrayBuffer) {
                    const blob = new Blob([data.image], { type: `image/${fmt}` });
                    blobUrl = URL.createObjectURL(blob);
                } else if (ArrayBuffer.isView && ArrayBuffer.isView(data.image)) {
                    const blob = new Blob([data.image.buffer || data.image], { type: `image/${fmt}` });
                    blobUrl = URL.createObjectURL(blob);
                } else if (typeof data.image === 'string' && data.image.length > 0) {
                    // 하위호환: base64 문자열 처리
                    handleImageUpdate(data.image, data.widget_id);
                    return;
                }

                if (blobUrl) {
                    handleImageUpdate(blobUrl, data.widget_id, /*isBlobUrl=*/true); // Widget.js
                }
            } catch (e) {
                console.error('image_data handling failed:', e);
            }
        });
        socket.on('text_data', function(data) {
            // console.log('Received text_data event:', data);
            if(data.text) {handleTextUpdate(data.text, data.widget_id);} // Widget.js
        });
        // Optional: backend can broadcast latest LLM answer
        socket.on('llm_answer', function(data){
            try { window.llmLastAnswer = data && data.answer ? String(data.answer) : ''; } catch(_) {}
        });
        //#endregion

    } catch (error) {
        showToast(messages.socketio_connecting_error_msg, 'error', useConsoleDebug);
    }
}