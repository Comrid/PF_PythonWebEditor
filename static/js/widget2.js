
function removeWidget_WebcamDisplay(widgetId){
    removeWidget(widgetId);
    webcamRunning = false;
    mediapipeRunning = false;
}

//#region WebcamDisplayWidget 관련 함수
function createWidget_WebcamDisplay(){
    // 생성 제한: 연결된 카메라 수만큼만 생성
    if (webcamRunning) {
        showToast('이미 웹캠 위젯이 생성되어 있습니다.', 'warning');
        return null;
    }

    const widgetId = `webcamDisplayWidget`;

    const widgetHTML = `
        <div class="grid-stack-item" id="${widgetId}" gs-w="14" gs-h="12" gs-min-w="4" gs-min-h="6" gs-locked="true">
            <div class="grid-stack-item-content widget-content">
                <div class="widget-header">
                    <h4>
                        <i class="fas fa-video"></i>
                        <span class="widget-title">Webcam</span>
                    </h4>
                    <div class="widget-controls">
                        <select class="form-select" id="dropdown_webcam"></select>
                    </div>
                    <button class="btn-icon webcam-settings-btn" title="Settings" onclick="toggleWebcamSettingsPopover(this, '${widgetId}')">
                        <i class="fas fa-cog"></i>
                    </button>
                    <button class="widget-close-btn" onclick="removeWebcamWidget('${widgetId}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="widget-body">
                    <div class="image-display" id="webcamDisplay_${widgetId}" style="position: relative;">
                        <div class="placeholder-text">웹캠이 여기에 표시됩니다</div>
                        <video id="webcamVideo_${widgetId}" autoplay playsinline muted style="max-width: 100%; max-height: 100%; object-fit: contain; display: none;"></video>
                        <canvas id="webcamOverlay_${widgetId}" style="position:absolute; left:0; top:0; width:100%; height:100%; pointer-events:none;"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;

    createWidgetByHTML(widgetHTML);
    populateAndBindWebcamSelector(widgetId, 0);
    return widgetId;
}

function startWebcamStream(widgetId, deviceIndex){
    const video = document.getElementById(`webcamVideo_${widgetId}`);
    const placeholder = document.querySelector(`#webcamDisplay_${widgetId} .placeholder-text`);
    if (!video || !placeholder) return;

    const constraints = deviceIndex !== undefined && Array.isArray(videoInputDevices) && videoInputDevices[deviceIndex]
        ? { video: { deviceId: { exact: videoInputDevices[deviceIndex].deviceId } }, audio: false }
        : { video: true, audio: false };

    navigator.mediaDevices?.getUserMedia(constraints)
        .then(stream => {
            // 기존 스트림 정지 후 교체
            stopWebcamStream(widgetId);
            webcamStreams.set(widgetId, { stream, deviceIndex });
            video.srcObject = stream;
            video.onloadedmetadata = () => {
                video.style.display = 'block';
                placeholder.style.display = 'none';
                video.play().catch(()=>{});
            };
        })
        .catch(async err => {
            console.error('웹캠 접근 실패:', err, constraints);
            const name = err && err.name ? err.name : 'Error';

            // 선택한 deviceId가 더 이상 유효하지 않거나 매칭 실패한 경우 → 기본 장치로 1회 폴백
            if (name === 'OverconstrainedError' || name === 'NotFoundError') {
                try {
                    const fallbackConstraints = { video: true, audio: false };
                    const stream2 = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
                    stopWebcamStream(widgetId);
                    webcamStreams.set(widgetId, { stream: stream2, deviceIndex: undefined });
                    video.srcObject = stream2;
                    video.onloadedmetadata = () => {
                        video.style.display = 'block';
                        placeholder.style.display = 'none';
                        video.play().catch(()=>{});
                    };
                    showToast('선택한 카메라를 찾을 수 없어 기본 장치로 연결했습니다.', 'warning');
                    return;
                } catch (err2) {
                    console.error('기본 장치로도 웹캠 연결 실패:', err2);
                }
            }

            // 권한 거부/보안 맥락 문제
            if (name === 'NotAllowedError') {
                if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
                    showToast('보안 맥락(HTTPS/localhost)에서만 카메라 사용 가능합니다. localhost:5000으로 접속하세요.', 'error');
                } else {
                    showToast('브라우저에서 카메라 권한이 거부되었습니다. 사이트 권한을 허용하세요.', 'error');
                }
                return;
            }

            // 다른 앱이 카메라를 점유 중
            if (name === 'NotReadableError') {
                showToast('다른 프로그램이 카메라를 사용 중입니다. 해당 프로그램을 종료 후 다시 시도하세요.', 'error');
                return;
            }

            // 일반 오류
            showToast('웹캠 접근에 실패했습니다. 브라우저 권한과 장치를 확인하세요.', 'error');
        });
}

function stopWebcamStream(widgetId){
    const entry = webcamStreams && webcamStreams.get ? webcamStreams.get(widgetId) : null;
    const stream = entry && entry.stream ? entry.stream : null;
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    if (webcamStreams && webcamStreams.delete) {
        webcamStreams.delete(widgetId);
    }
}

function stopAllWebcamStreams(){
    if (!webcamStreams) return;
    Array.from(webcamStreams.keys()).forEach(stopWebcamStream);
    // disable hand gesture overlays for all webcam widgets
    try {
        if (typeof window.handGestureEnabledByWidget !== 'undefined' && window.handGestureEnabledByWidget.forEach) {
            window.handGestureEnabledByWidget.forEach((enabled, wid) => {
                if (enabled && typeof window.disableHandGesture === 'function') {
                    window.disableHandGesture(wid);
                }
            });
        }
    } catch (_) { /* no-op */ }
}

function removeWebcamWidget(widgetId){
    // 핸드 제스처 비활성화
    try { if (typeof window.disableHandGesture === 'function') window.disableHandGesture(widgetId); } catch (_) {}
    stopWebcamStream(widgetId);
    removeWidget(widgetId);
}

function populateAndBindWebcamSelector(widgetId){
    const selector = document.getElementById(`dropdown_webcam`);
    if (!selector) return;

    // 옵션 채우기
    selector.innerHTML = '';
    if (Array.isArray(videoInputDevices) && videoInputDevices.length > 0) {
        videoInputDevices.forEach((dev, i) => {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = dev.label || `Camera ${i}`;
            if (i === 0) opt.selected = true;
            selector.appendChild(opt);
        });
    } else {
        const opt = document.createElement('option');
        opt.value = '0';
        opt.textContent = 'No Camera';
        selector.appendChild(opt);
    }

    // 초기 스트림 시작
    startWebcamStream(widgetId, 0);

    // 변경 이벤트 바인딩
    selector.addEventListener('change', (e) => {
        const newIdx = Number(selector.value);
        startWebcamStream(widgetId, newIdx);
    });
}
//#endregion