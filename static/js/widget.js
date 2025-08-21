// Initialize Main GridStack
document.addEventListener('DOMContentLoaded', function() {
    function initializeMainGridStack() {
        try {
            if (typeof GridStack === 'undefined') {
                console.error('GridStack is not loaded');
                return null;
            }

            const gridElement = document.getElementById('mainGridStack');
            if (!gridElement) {
                console.error('Main GridStack element not found');
                return null;
            }

        const grid = GridStack.init({
            float: true,
                cellHeight: 40,
                margin: '0px',
                disableOneColumnMode: false,
            animate: true,
            resizable: {
                    handles: 'se, s, w, e'
                },
                draggable: {
                    handle: '.widget-header'
                },
                column: 50,  // 더 많은 열로 셀 너비를 작게 만듦
                minRow: 1,
                removable: false
        });

        // Store grid instance globally
            window.mainGridStack = grid;

            console.log('Main GridStack initialized successfully');
        return grid;
        } catch (error) {
            console.error('Error initializing Main GridStack:', error);
            return null;
        }
    }

    // GridStack 초기화
    initializeMainGridStack();
});

//#region 위젯 공용 함수
function createWidgetByHTML(widgetHTML){
    // GridStack에 위젯 추가
    if (window.mainGridStack) {
        const gridContainer = document.getElementById('mainGridStack');

        if (gridContainer) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(widgetHTML.trim(), 'text/html');
            const widgetElement = doc.body.firstElementChild;

            try {
                gridContainer.appendChild(widgetElement);
                window.mainGridStack.makeWidget(widgetElement);
            } catch (error) {
                console.error('GridStack widget registration error:', error);
            }
        } else {
            console.error('Grid container not found');
            return null;
        }
    } else {
        console.error('GridStack is not initialized');
        return null;
    }
}

// 공용: 위젯 ID를 클립보드에 복사
function copyWidgetId(widgetId){
    const text = widgetId;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => showToast(`\`${text}\` 복사 완료`, 'success'))
            .catch(() => fallbackCopyText(text));
    } else {
        fallbackCopyText(text);
    }
}

function fallbackCopyText(text){
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast(`\`${text}\` 복사 완료`, 'success');
    } catch (_) {
        showToast('복사에 실패했습니다.', 'error');
    }
}

// 공용: 입력 요소를 내용 길이에 맞춰 자동 크기 조정
function autosizeIdInput(inputEl){
    if (!inputEl) return;
    // 임시 숨은 스팬으로 텍스트 폭 측정
    const span = document.createElement('span');
    span.style.visibility = 'hidden';
    span.style.position = 'fixed';
    span.style.left = '-9999px';
    span.style.whiteSpace = 'pre';
    span.style.font = getComputedStyle(inputEl).font;
    span.textContent = inputEl.value || inputEl.placeholder || '';
    document.body.appendChild(span);
    const minPx = parseInt(getComputedStyle(inputEl).minWidth || '160', 10);
    const padding = 16; // 좌우 여유
    const width = Math.max(minPx, Math.ceil(span.getBoundingClientRect().width) + padding);
    inputEl.style.width = width + 'px';
    document.body.removeChild(span);
}
//#endregion

function removeWidget(widgetId) {
    // 위젯 삭제 함수
    try {
        if (window.mainGridStack) {
            const widgetElement = document.getElementById(widgetId);
            if (widgetElement) {
                // 이미지 Blob URL 정리 (있다면)
                try {
                    const prev = window.__imageBlobUrlByWidget && window.__imageBlobUrlByWidget.get ? window.__imageBlobUrlByWidget.get(widgetId) : null;
                    if (prev && typeof URL !== 'undefined' && URL.revokeObjectURL) {
                        URL.revokeObjectURL(prev);
                        window.__imageBlobUrlByWidget.delete(widgetId);
                    }
                } catch (_) {}
                window.mainGridStack.removeWidget(widgetElement);
            } else {
                console.error(`Widget element not found: ${widgetId}`);
            }
        } else {
            console.error('GridStack is not initialized');
        }
    } catch (error) {
        console.error(`Error removing widget ${widgetId}:`, error);
    }
}

// TODO: 레이아웃 저장/불러오기 기능 추가
// 레이아웃 저장
function saveLayout() {
    if (!window.mainGridStack) return;
    const layout = window.mainGridStack.save(true); // 위젯 HTML까지 저장
    localStorage.setItem('gridstack_layout', JSON.stringify(layout));
    showToast('레이아웃이 저장되었습니다.', 'success');
}

// 레이아웃 복원
function loadLayout() {
    if (!window.mainGridStack) return;
    const raw = localStorage.getItem('gridstack_layout');
    if (!raw) { showToast('저장된 레이아웃이 없습니다.', 'warning'); return; }
    const layout = JSON.parse(raw);
    window.mainGridStack.removeAll(); // 현재 위젯 비우기(선택)
    window.mainGridStack.load(layout);
    showToast('레이아웃을 복원했습니다.', 'success');
}
//#endregion

//#region ID 편집 관련
function updateWidgetId(inputElement) {
    // 위젯 ID 업데이트 함수
    const newWidgetId = inputElement.value.trim();

    if (!newWidgetId) { // 빈 값이면 원래 ID로 복원
        inputElement.value = inputElement.closest('.grid-stack-item').id;
        return;
    }

    if (newWidgetId === inputElement.closest('.grid-stack-item').id) {
        return; // 변경사항이 없음
    }

    try { // 위젯 요소를 현재 DOM에서 찾기 (부모 요소를 통해)
        const widgetElement = inputElement.closest('.grid-stack-item');
        if (!widgetElement) {
            inputElement.value = inputElement.closest('.grid-stack-item').id;
            return;
        }

        const currentWidgetId = widgetElement.id;
        widgetElement.id = newWidgetId;

        // ImageDisplayWidget
        const imageDisplay = widgetElement.querySelector(`#imageDisplay_${currentWidgetId}`);
        const displayImage = widgetElement.querySelector(`#displayImage_${currentWidgetId}`);
        if (imageDisplay) {imageDisplay.id = `imageDisplay_${newWidgetId}`;}
        if (displayImage) {displayImage.id = `displayImage_${newWidgetId}`;}

        // TextDisplayWidget
        const textDisplay = widgetElement.querySelector(`#textDisplay_${currentWidgetId}`);
        const displayText = widgetElement.querySelector(`#displayText_${currentWidgetId}`);
        if (textDisplay) {textDisplay.id = `textDisplay_${newWidgetId}`;}
        if (displayText) {displayText.id = `displayText_${newWidgetId}`;}

    } catch (error) {
        console.error(`Error updating widget ID:`, error);
        inputElement.value = inputElement.closest('.grid-stack-item').id;
    }
}

function handleWidgetId_KeyPress(event, inputElement, oldWidgetId) {
    // 위젯 ID 편집 시 키보드 이벤트 처리
    if (event.key === 'Enter') {
        inputElement.blur();
    } else if (event.key === 'Escape') {
        const widgetElement = inputElement.closest('.grid-stack-item');
        if (widgetElement) {
            inputElement.value = widgetElement.id;
        } else {
            inputElement.value = oldWidgetId;
        }
        inputElement.blur();
    }
}

function handleWidgetId_Focus(inputElement) {
    // 커서 올리면 하이라이트 상태
    inputElement.select();
}
//#endregion

//#region ImageDisplayWidget 관련 함수
function createWidget_ImageDisplay(){
    // 이미지 위젯 생성
    const widgetId = `Image_${numImageDisplayWidget++}`;

    const widgetHTML = `
        <div class="grid-stack-item" id="${widgetId}" gs-w="8" gs-h="10" gs-min-w="4" gs-min-h="6" gs-locked="true">
            <div class="grid-stack-item-content widget-content">
                <div class="widget-header">
                    <h4>
                        <i class="fas fa-image"></i>
                        <input type="text" class="widget-id-editor" value="${widgetId}"
                               onblur="updateWidgetId(this)"
                               onkeydown="handleWidgetId_KeyPress(event, this, '${widgetId}')"
                               onfocus="handleWidgetId_Focus(this)">
                    </h4>
                    <button class="widget-close-btn" onclick="removeWidget(this.closest('.grid-stack-item').id)">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="widget-body">
                    <div class="image-display" id="imageDisplay_${widgetId}">
                        <div class="placeholder-text">이미지가 여기에 표시됩니다</div>
                        <img id="displayImage_${widgetId}" src="" alt="Display Image" style="max-width: 100%; max-height: 100%; object-fit: contain; display: none;">
                    </div>
                </div>
            </div>
        </div>
    `;

    createWidgetByHTML(widgetHTML);

    // 입력 폭 자동 조절 바인딩
    setTimeout(() => {
        const input = document.querySelector(`#${CSS.escape(widgetId)} .widget-id-editor`);
        if (input) {
            autosizeIdInput(input);
            input.addEventListener('input', () => autosizeIdInput(input));
        }
    }, 0);

    // 제목 클릭 복사 바인딩 (입력 값 기준)
    // setTimeout(() => {
    //     const input = document.querySelector(`#${CSS.escape(widgetId)} .widget-id-editor`);
    //     if (input) {
    //         input.addEventListener('click', () => copyWidgetId(input.value));
    //     }
    // }, 0);

    return widgetId;
}

function handleImageUpdate(imageData, widgetId) {
    // 특정 위젯에 이미지 업데이트하는 함수
    const placeholder = document.querySelector(`#imageDisplay_${widgetId} .placeholder-text`);
    const image = document.getElementById(`displayImage_${widgetId}`);

    if (!placeholder || !image) {
        console.error(`Image widget elements not found for widget: ${widgetId}`);
        console.log('Available image displays:', document.querySelectorAll('[id^="imageDisplay_"]'));
        console.log('Available display images:', document.querySelectorAll('[id^="displayImage_"]'));
        return;
    }

    try {
        // imageData가 blob URL인지(base64가 아닌) 판단
        const isBlobUrl = typeof imageData === 'string' && imageData.startsWith('blob:');

        // 공통 로드/에러 핸들러
        image.onload = function() {
            image.style.display = 'block';
            placeholder.style.display = 'none';
        };
        image.onerror = function() {
            console.error(`Failed to load image for widget: ${widgetId}`);
            image.style.display = 'none';
            placeholder.style.display = 'block';
            placeholder.textContent = '이미지 로드 실패';
        };

        // 이전 blob URL 정리
        try {
            const prev = window.__imageBlobUrlByWidget && window.__imageBlobUrlByWidget.get ? window.__imageBlobUrlByWidget.get(widgetId) : null;
            if (prev && prev !== imageData && typeof URL !== 'undefined' && URL.revokeObjectURL) {
                URL.revokeObjectURL(prev);
                window.__imageBlobUrlByWidget.delete(widgetId);
            }
        } catch (_) {}

        if (isBlobUrl) {
            image.src = imageData;
            try { window.__imageBlobUrlByWidget && window.__imageBlobUrlByWidget.set && window.__imageBlobUrlByWidget.set(widgetId, imageData); } catch(_){}
        } else {
            // base64 문자열로 가정하고 data URL 구성(기존 하위호환)
            image.src = `data:image/jpeg;base64,${imageData}`;
        }

    } catch (error) {
        console.error(`Error processing image for widget ${widgetId}:`, error);
        image.style.display = 'none';
        placeholder.style.display = 'block';
        placeholder.textContent = '이미지 처리 오류';
    }
}
//#endregion

//#region TextDisplayWidget 관련 함수
// TODO: 여러 줄 전달 시 제대로 출력되도록. 지금은 한줄로 다 나옴
function createWidget_TextDisplay(){
    // 텍스트 위젯 생성
    const widgetId = `Text_${numTextDisplayWidget++}`;

    const widgetHTML = `
        <div class="grid-stack-item" id="${widgetId}" gs-w="8" gs-h="3" gs-min-w="4" gs-min-h="2" gs-locked="true">
            <div class="grid-stack-item-content widget-content">
                <div class="widget-header">
                    <h4>
                        <i class="fas fa-font"></i>
                        <input type="text" class="widget-id-editor" value="${widgetId}"
                               onblur="updateWidgetId(this)"
                               onkeydown="handleWidgetId_KeyPress(event, this, '${widgetId}')"
                               onfocus="handleWidgetId_Focus(this)">
                    </h4>
                    <button class="widget-close-btn" onclick="removeWidget(this.closest('.grid-stack-item').id)">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="widget-body">
                    <div class="text-display" id="textDisplay_${widgetId}">
                        <div class="placeholder-text">텍스트가 여기에 표시됩니다</div>
                        <div id="displayText_${widgetId}" style="display:none;"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    createWidgetByHTML(widgetHTML);

    // 입력 폭 자동 조절 바인딩
    setTimeout(() => {
        const input = document.querySelector(`#${CSS.escape(widgetId)} .widget-id-editor`);
        if (input) {
            autosizeIdInput(input);
            input.addEventListener('input', () => autosizeIdInput(input));
        }
    }, 0);

    // 제목 클릭 복사 바인딩 (입력 값 기준)
    // setTimeout(() => {
    //     const input = document.querySelector(`#${CSS.escape(widgetId)} .widget-id-editor`);
    //     if (input) {
    //         input.addEventListener('click', () => copyWidgetId(input.value));
    //     }
    // }, 0);

    return widgetId;
}

// 텍스트 업데이트 핸들러
function handleTextUpdate(textData, widgetId) {
    const placeholder = document.querySelector(`#textDisplay_${widgetId} .placeholder-text`);
    const textElem = document.getElementById(`displayText_${widgetId}`);

    if (!placeholder || !textElem) {
        console.error(`Text widget elements not found for widget: ${widgetId}`);
        return;
    }

    try {
        textElem.textContent = typeof textData === 'string' ? textData : JSON.stringify(textData);
        textElem.style.display = 'block';
        placeholder.style.display = 'none';
    } catch (error) {
        console.error(`Error processing text for widget ${widgetId}:`, error);
        textElem.style.display = 'none';
        placeholder.style.display = 'block';
        placeholder.textContent = '텍스트 처리 오류';
    }
}
//#endregion

//#region Slider Widget 관련 함수수
function createWidget_Slider(){
    const widgetId = `Slider_${numSliderWidget++}`;

    const widgetHTML = `
        <div class="grid-stack-item" id="${widgetId}" gs-w="16" gs-h="4" gs-min-w="10" gs-min-h="4" gs-locked="true">
            <div class="grid-stack-item-content widget-content">
                <div class="widget-header">
                    <h4>
                        <i class="fas fa-sliders-h"></i>
                        <span class="widget-title pid-widget-title" id="title_${widgetId}" draggable="false">${widgetId}</span>
                    </h4>
                    <div class="widget-controls">
                        <button class="btn-icon" id="btnAdd_${widgetId}" title="Add slider"><i class="fas fa-plus"></i></button>
                        <button class="btn-icon" id="btnRemove_${widgetId}" title="Remove slider"><i class="fas fa-minus"></i></button>
                        <button class="widget-close-btn" onclick="removeWidget('${widgetId}')"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <div class="widget-body">
                    <div class="slider-container" id="sliderBox_${widgetId}"></div>
                </div>
            </div>
        </div>`;

    createWidgetByHTML(widgetHTML);

    const bind = () => {
        const box = document.getElementById(`sliderBox_${widgetId}`);
        const btnAdd = document.getElementById(`btnAdd_${widgetId}`);
        const btnRemove = document.getElementById(`btnRemove_${widgetId}`);
        const title = document.getElementById(`title_${widgetId}`);

        if (!box) return;

        const buildRow = (index) => {
            const rowId = `${widgetId}_row_${index}`;
            const row = document.createElement('div');
            row.className = 'slider-row';
            row.id = rowId;
            row.innerHTML = `
                <div class="slider-top">
                    <div class="slider-row-header">${index} :</div>
                    <input class="slider-range" type="range" min="0" max="1" step="0.001" value="0" />
                </div>
                <div class="slider-bottom">
                    <div class="slider-bottom-inner">
                        <div class="slider-field slider-min-field">
                            <div class="slider-label">Min</div>
                            <input class="slider-input slider-min" type="number" step="0.1" value="0" />
                        </div>
                        <div class="slider-field slider-value-field">
                            <div class="slider-label">Value</div>
                            <input class="slider-input slider-value" type="number" step="0.1" value="0" />
                        </div>
                        <div class="slider-field slider-max-field">
                            <div class="slider-label">Max</div>
                            <input class="slider-input slider-max" type="number" step="0.1" value="1" />
                        </div>
                    </div>
                </div>
            `;

            const minEl = row.querySelector('.slider-min');
            const rangeEl = row.querySelector('.slider-range');
            const valEl = row.querySelector('.slider-value');
            const maxEl = row.querySelector('.slider-max');

            const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
            const emit = () => {
                const values = Array.from(box.querySelectorAll('.slider-row')).map(r => parseFloat(r.querySelector('.slider-value').value));
                if (window.socket && window.socket.connected) {
                    window.socket.emit('slider_update', { widget_id: widgetId, values });
                }
            };

            minEl.addEventListener('input', () => {
                const min = parseFloat(minEl.value || '0');
                const max = parseFloat(maxEl.value || '1');
                if (min > max) { maxEl.value = String(min); }
                rangeEl.min = String(min);
                valEl.value = String(clamp(parseFloat(valEl.value || '0'), min, parseFloat(maxEl.value || '1')));
                rangeEl.value = valEl.value;
                emit();
            });
            maxEl.addEventListener('input', () => {
                const min = parseFloat(minEl.value || '0');
                const max = parseFloat(maxEl.value || '1');
                if (max < min) { minEl.value = String(max); }
                rangeEl.max = String(max);
                valEl.value = String(clamp(parseFloat(valEl.value || '0'), parseFloat(minEl.value || '0'), max));
                rangeEl.value = valEl.value;
                emit();
            });
            rangeEl.addEventListener('input', () => {
                valEl.value = rangeEl.value;
                emit();
            });
            valEl.addEventListener('input', () => {
                const min = parseFloat(minEl.value || '0');
                const max = parseFloat(maxEl.value || '1');
                const v = clamp(parseFloat(valEl.value || '0'), min, max);
                valEl.value = String(v);
                rangeEl.value = String(v);
                emit();
            });

            return row;
        };

        const addRow = () => {
            const count = box.querySelectorAll('.slider-row').length;
            box.appendChild(buildRow(count));
            emitAll();
        };
        const removeRow = () => {
            const rows = box.querySelectorAll('.slider-row');
            if (rows.length <= 1) return;
            rows[rows.length - 1].remove();
            emitAll();
        };
        const emitAll = () => {
            const values = Array.from(box.querySelectorAll('.slider-row')).map(r => parseFloat(r.querySelector('.slider-value').value));
            if (window.socket && window.socket.connected) {
                window.socket.emit('slider_update', { widget_id: widgetId, values });
            }
        };

        // 초기 1개 생성
        addRow();

        // 버튼 이벤트
        if (btnAdd) btnAdd.addEventListener('click', addRow);
        if (btnRemove) btnRemove.addEventListener('click', removeRow);

        // 제목 클릭 복사
        if (title) title.addEventListener('click', () => copyWidgetId(widgetId));
    };

    setTimeout(bind, 0);

    return widgetId;
}
//#endregion

//#region ButtonWidget 관련함수
//#endregion

//#region WebcamDisplayWidget 관련 함수
function removeWidget_WebcamDisplay(widgetId){
    removeWidget(widgetId);
    webcamRunning = false;
    mediapipeRunning = false;
}

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
    webcamRunning = true;
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
    webcamRunning = false;
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

//#region PID Controller Widget 관련 함수
function createWidget_PIDController(){
    const widgetId = `PID_Controller_${numPidControllerWidget++}`;

    const widgetHTML = `
        <div class="grid-stack-item" id="${widgetId}" gs-w="8" gs-h="3" gs-min-w="8" gs-min-h="3" gs-locked="true">
            <div class="grid-stack-item-content widget-content">
                <div class="widget-header">
                    <h4>
                        <i class="fas fa-sliders-h"></i>
                        <span class="widget-title pid-widget-title" id="title_${widgetId}" draggable="false">${widgetId}</span>
                    </h4>
                    <div class="widget-controls">
                        <button class="widget-close-btn" onclick="removeWidget(this.closest('.grid-stack-item').id)">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="widget-body">
                    <div class="pid-controller" id="pidBox_${widgetId}">
                        <label class="pid-label">P</label>
                        <input class="pid-input" id="pidP_${widgetId}" type="number" step="0.001" value="1.0" />
                        <label class="pid-label">I</label>
                        <input class="pid-input" id="pidI_${widgetId}" type="number" step="0.001" value="0.0" />
                        <label class="pid-label">D</label>
                        <input class="pid-input" id="pidD_${widgetId}" type="number" step="0.001" value="0.0" />
                    </div>
                </div>
            </div>
        </div>
    `;

    createWidgetByHTML(widgetHTML);

    // 입력값 변경 시 서버로 전송 (프론트 기준 최신값 유지)
    const bind = () => {
        const p = document.getElementById(`pidP_${widgetId}`);
        const i = document.getElementById(`pidI_${widgetId}`);
        const d = document.getElementById(`pidD_${widgetId}`);
        const title = document.getElementById(`title_${widgetId}`);

        const handler = () => {
            const payload = {
                widget_id: widgetId,
                p: Number(p.value),
                i: Number(i.value),
                d: Number(d.value)
            };
            if (window.socket && window.socket.connected) {
                window.socket.emit('pid_update', payload);
            }
        };
        [p,i,d].forEach(el => {
            el.addEventListener('change', handler);
            el.addEventListener('input', handler);
        });
        // 최초 1회 송신으로 서버 상태 초기화
        handler();

        // 제목 클릭 시 ID 복사 (드래그는 허용)
        if (title) {
            title.addEventListener('click', () => copyWidgetId(widgetId));
        }
    };

    // GridStack 등록 후 DOM이 실체화되므로 다음 틱에 바인딩
    setTimeout(bind, 0);

    return widgetId;
}

// JS에서 현재 PID 값을 즉시 읽어올 수 있는 헬퍼(프론트에서 참조용)
function getPidValueFromUI(widgetId){
    const p = document.getElementById(`pidP_${widgetId}`);
    const i = document.getElementById(`pidI_${widgetId}`);
    const d = document.getElementById(`pidD_${widgetId}`);
    if (!p || !i || !d) return null;
    return { p: Number(p.value), i: Number(i.value), d: Number(d.value) };
}
//#endregion

//#region Code Editor & Output Panel Widget 추가
// Code Editor Widget 추가
(function(){
    const gridContainer = document.getElementById('mainGridStack');
    const parser = new DOMParser();
    // html 초기화
    const widgetHTML = `
    <!-- Code Editor Widget -->
    <div class="grid-stack-item" id="codeEditorWidget" gs-w="17" gs-h="17" gs-x="0" gs-y="0" gs-min-w="10" gs-min-h="5" gs-auto-position="false" gs-locked="true"> <!-- 위치 변경 금지 -->
        <div class="grid-stack-item-content widget-content">
            <div class="widget-header">
                <h4><i class="fas fa-code"></i> Code Editor</h4>
                <div class="widget-controls">
                    <span class="execution-status" id="executionStatus">대기 중</span>
                    <button class="btn btn-small btn-success" id="runBtn">
                        <i class="fas fa-play"></i> Run
                    </button>
                    <button class="btn btn-small btn-danger" id="stopBtn">
                        <i class="fas fa-stop"></i> Stop
                    </button>
                    <button class="btn btn-small btn-primary" id="codeFileBtn">
                        <i class="fas fa-file-code"></i> Code File
                    </button>
                    <button class="btn btn-small btn-settings" id="editorSettingsBtn">
                        <i class="fas fa-cog"></i>
                    </button>
                </div>
            </div>
            <div class="widget-body">
                <div id="monaco-editor" class="monaco-editor"></div>
            </div>
        </div>
    </div>`;
    const doc = parser.parseFromString(widgetHTML.trim(), 'text/html');
    const widgetElement = doc.body.firstElementChild;
    gridContainer.appendChild(widgetElement);
})();

// Output Panel Widget 추가
(function(){
    const gridContainer = document.getElementById('mainGridStack');
    const parser = new DOMParser();
    const widgetHTML = `
    <!-- Output Panel Widget -->
    <div class="grid-stack-item" id="outputPanelWidget" gs-w="17" gs-h="7" gs-x="0" gs-y="17" gs-min-w="10" gs-min-h="5" gs-locked="true"> <!-- 위치 변경 금지 -->
        <div class="grid-stack-item-content widget-content">
            <div class="widget-header">
                <h4><i class="fas fa-terminal"></i> Output</h4>
                <div class="widget-controls">
                    <button class="btn btn-small" id="clearOutputBtn">
                        <i class="fas fa-trash"></i> Clear
                    </button>
                </div>
            </div>
            <div class="widget-body">
                <div class="output-content" id="outputContent">
                    <div class="output-item system">Findee Python Web Editor!</div>
                </div>
            </div>
        </div>
    </div>`;

    const doc = parser.parseFromString(widgetHTML.trim(), 'text/html');
    const widgetElement = doc.body.firstElementChild;
    gridContainer.appendChild(widgetElement);
})();
//#endregion

//#region AI Assistant Widget 관련 함수 (LLM)
function removeAIAssistantWidget(widgetId){
    try {
        removeWidget(widgetId);
    } finally {
        if (typeof window !== 'undefined') {
            window.aiAssistantRunning = false;
        }
    }
}

function createWidget_AIAssistant(){
    if (typeof window !== 'undefined' && window.aiAssistantRunning) {
        showToast('이미 AI Assistant 위젯이 생성되어 있습니다.', 'warning');
        return null;
    }

    const widgetId = 'AI_Assistant';

    const widgetHTML = `
        <div class="grid-stack-item" id="${widgetId}" gs-w="16" gs-h="10" gs-min-w="12" gs-min-h="8" gs-locked="true">
            <div class="grid-stack-item-content widget-content">
                <div class="widget-header">
                    <h4>
                        <i class="fas fa-robot"></i>
                        <span class="widget-title" id="title_${widgetId}" draggable="false">${widgetId}</span>
                        <span class="execution-status" id="llmStatus_${widgetId}">Loading...</span>
                    </h4>
                    <div class="widget-controls">
                        <div class="toggle-controls" style="margin-right:8px;">
                            <label class="setting-label" style="margin-right:8px; color:#e2e8f0; font-size:12px;">Code Based</label>
                            <button class="toggle-btn" id="codeBasedToggle_${widgetId}">
                                <div class="toggle-slider">
                                    <div class="toggle-indicator"></div>
                                </div>
                                <span class="toggle-label" id="codeBasedLabel_${widgetId}">Off</span>
                            </button>
                        </div>
                        <button class="btn btn-small btn-success" id="btnAsk_${widgetId}" disabled><i class="fas fa-paper-plane"></i> Ask</button>
                        <button class="btn btn-small" id="btnClear_${widgetId}"><i class="fas fa-eraser"></i> Clear</button>
                        <button class="widget-close-btn" onclick="removeAIAssistantWidget('${widgetId}')"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <div class="widget-body">
                    <div class="ai-assistant-container">
                        <textarea id="ai_input_${widgetId}" class="form-input ai-input" placeholder="질문을 입력하세요..."></textarea>
                        <div id="ai_output_${widgetId}" class="output-content ai-output"></div>
                    </div>
                </div>
            </div>
        </div>`;

    createWidgetByHTML(widgetHTML);

    const bind = () => {
        const btnAsk = document.getElementById(`btnAsk_${widgetId}`);
        const btnClear = document.getElementById(`btnClear_${widgetId}`);
        const title = document.getElementById(`title_${widgetId}`);
        const inputEl = document.getElementById(`ai_input_${widgetId}`);
        const outputEl = document.getElementById(`ai_output_${widgetId}`);
        const statusEl = document.getElementById(`llmStatus_${widgetId}`);
        const codeBasedToggle = document.getElementById(`codeBasedToggle_${widgetId}`);
        const codeBasedLabel = document.getElementById(`codeBasedLabel_${widgetId}`);

        // Code Based 토글 이벤트
        if (codeBasedToggle && codeBasedLabel) {
            codeBasedToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isActive = codeBasedToggle.classList.toggle('active');
                codeBasedLabel.textContent = isActive ? 'On' : 'Off';
            });
        }

        const updateStatus = (loaded, loading, error) => {
            if (!statusEl || !btnAsk) return;
            if (loading) {
                statusEl.textContent = 'Loading...';
                btnAsk.disabled = true;
                return;
            }
            if (error) {
                statusEl.textContent = 'Load Failed';
                btnAsk.disabled = true;
                return;
            }
            if (loaded) {
                statusEl.textContent = 'Ready';
                btnAsk.disabled = false;
                return;
            }
            statusEl.textContent = 'Idle';
            btnAsk.disabled = true;
        };

        // Apply current global status immediately
        try {
            const s = typeof window.getLlmStatus === 'function' ? window.getLlmStatus() : {loaded:false,loading:true,error:null};
            updateStatus(!!s.loaded, !!s.loading, s.error || null);
        } catch(_) {}

        // Subscribe to global llm status events
        const listener = (e) => {
            const d = e && e.detail ? e.detail : {};
            updateStatus(!!d.loaded, !!d.loading, d.error || null);
        };
        window.addEventListener('llm_status_changed', listener);

        // Kick off loading if not yet (harmless if already done)
        try {
            if (typeof window.loadLLM === 'function') {
                window.loadLLM().catch(()=>{});
            }
        } catch(_) {}

        if (title) title.addEventListener('click', () => copyWidgetId(widgetId));

        if (btnAsk && inputEl && outputEl) {
            // 입력 필드 키 이벤트: Shift+Enter는 줄바꿈, Enter는 Ask
            inputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    btnAsk.click();
                }
            });

            btnAsk.addEventListener('click', async () => {
                const question = (inputEl.value || '').trim();
                if (!question) { showToast('질문을 입력하세요.', 'warning'); return; }

                // LLM 준비 상태 우선 검사 및 보정
                try {
                    const snap = (typeof window.getLlmStatus === 'function') ? window.getLlmStatus() : {loaded:false};
                    if (!snap.loaded && typeof window.loadLLM === 'function') {
                        await window.loadLLM();
                    }
                    const snap2 = (typeof window.getLlmStatus === 'function') ? window.getLlmStatus() : {loaded:false, error:'LLM not loaded'};
                    if (!snap2.loaded) {
                        showToast('LLM이 준비되지 않았습니다. API 키를 확인하세요.', 'error');
                        return;
                    }
                } catch (_) {
                    showToast('LLM 초기화에 실패했습니다.', 'error');
                    return;
                }
                
                try {
                    // 렌더 타깃을 마크다운 컨테이너로 사용
                    outputEl.innerHTML = '';
                    btnAsk.disabled = true;
                    
                    // Code Based가 활성화된 경우 현재 코드도 함께 전달
                    const useCode = !!(codeBasedToggle && codeBasedToggle.classList.contains('active'));
                    const code = useCode && monacoEditor ? monacoEditor.getValue().trim() : '';

                    // 사용자의 Findee 인스턴스 변수명 추출
                    let instanceName = 'robot'; // 기본값
                    if (useCode && code) {
                        const findeePattern = /(\w+)\s*=\s*Findee\(\)/;
                        const match = code.match(findeePattern);
                        if (match) {
                            instanceName = match[1];
                        }
                    }

                    // 간결 프롬프트 구성
                    const parts = [];
                    if (window.LLM_SYSTEM_PROMPT) parts.push(window.LLM_SYSTEM_PROMPT);
                    if (window.FINDEE_API_BRIEF) parts.push('Findee API 요약:\n' + window.FINDEE_API_BRIEF);
                    if (useCode && code) {
                        parts.push(`현재 코드:\n\`\`\`python\n${code}\n\`\`\``);
                        parts.push(`사용자의 Findee 인스턴스 변수명: ${instanceName}`);
                        parts.push(`답변 시 ${instanceName}.motor, ${instanceName}.camera, ${instanceName}.ultrasonic 형태로 사용하세요.`);
                        parts.push(`**코드 예시 생성 시 필수 요소**:`);
                        parts.push(`1. ${instanceName} = Findee()`);
                        parts.push(`2. try-except-finally 구조`);
                        parts.push(`3. ${instanceName}.cleanup()`);
                        parts.push(`**중요한 주의사항**:`);
                        parts.push(`- ${instanceName}.move_forward(speed=50, duration=1.0) 같은 코드는 이미 1초를 대기하고 자동으로 stop하므로 추가적인 time.sleep()을 사용하지 마세요.`);
                        parts.push(`- motor 관련 함수들은 duration 매개변수로 동작 시간을 지정할 수 있습니다.`);
                        parts.push(`- time.sleep()은 motor 함수의 duration 매개변수로 대체 가능한 경우 사용하지 마세요.`);
                    }
                    parts.push('질문:\n' + question);
                    const fullQuestion = parts.join('\n\n');
                    
                    await window.askLLM(fullQuestion, (partial, complete) => {
                        // Markdown 렌더링
                        try {
                            const html = (window.marked ? window.marked.parse(partial) : partial).toString();
                            outputEl.innerHTML = html;
                        } catch (_) {
                            outputEl.textContent = partial;
                        }
                        if (complete) {
                            btnAsk.disabled = false;
                            // 최종 텍스트는 plain 저장
                            const textOnly = outputEl.textContent || '';
                            window.llmLastAnswer = textOnly;
                            if (window.socket && window.socket.connected) {
                                window.socket.emit('llm_answer_update', { answer: window.llmLastAnswer });
                            }
                        }
                    });
                } catch (e) {
                    btnAsk.disabled = false;
                    showToast('LLM 요청 중 오류가 발생했습니다.', 'error');
                }
            });
        }

        if (btnClear && inputEl && outputEl) {
            btnClear.addEventListener('click', () => {
                inputEl.value = '';
                outputEl.textContent = '';
                window.llmLastAnswer = '';
                if (window.socket && window.socket.connected) {
                    window.socket.emit('llm_answer_update', { answer: '' });
                }
            });
        }

        if (typeof window !== 'undefined') window.aiAssistantRunning = true;

        // Cleanup on remove (best-effort)
        const cleanupObserver = new MutationObserver(() => {
            const el = document.getElementById(widgetId);
            if (!el) {
                try { window.removeEventListener('llm_status_changed', listener); } catch(_) {}
                cleanupObserver.disconnect();
            }
        });
        cleanupObserver.observe(document.body, { childList: true, subtree: true });
    };

    setTimeout(bind, 0);

    return widgetId;
}
//#endregion

//#region AI Controller Widget 관련 함수 (코드 생성 및 실행)
function removeAIControllerWidget(widgetId){
    try {
        removeWidget(widgetId);
    } finally {
        if (typeof window !== 'undefined') {
            window.aiControllerRunning = window.aiControllerRunning || false;
            window.aiControllerRunning = false;
        }
    }
}

function createWidget_AIController(){
    if (typeof window !== 'undefined' && window.aiControllerRunning) {
        showToast('이미 AI Controller 위젯이 생성되어 있습니다.', 'warning');
        return null;
    }

    const widgetId = 'AI_Controller';

    const widgetHTML = `
        <div class="grid-stack-item" id="${widgetId}" gs-w="16" gs-h="10" gs-min-w="12" gs-min-h="8" gs-locked="true">
            <div class="grid-stack-item-content widget-content">
                <div class="widget-header">
                    <h4>
                        <i class="fas fa-magic"></i>
                        <span class="widget-title" id="title_${widgetId}" draggable="false">${widgetId}</span>
                        <span class="execution-status" id="llmStatus_${widgetId}">Loading...</span>
                    </h4>
                    <div class="widget-controls">
                        <div class="toggle-controls" style="margin-right:8px;">
                            <label class="setting-label" style="margin-right:8px; color:#e2e8f0; font-size:12px;">Auto Run</label>
                            <button class="toggle-btn" id="autoRunToggle_${widgetId}">
                                <div class="toggle-slider">
                                    <div class="toggle-indicator"></div>
                                </div>
                                <span class="toggle-label" id="autoRunLabel_${widgetId}">Off</span>
                            </button>
                        </div>
                        <button class="btn btn-small btn-success" id="btnGenerate_${widgetId}" disabled><i class="fas fa-code"></i> Generate</button>
                        <button class="btn btn-small" id="btnClear_${widgetId}"><i class="fas fa-eraser"></i> Clear</button>
                        <button class="widget-close-btn" onclick="removeAIControllerWidget('${widgetId}')"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <div class="widget-body">
                    <div class="ai-controller-container">
                        <textarea id="ai_input_${widgetId}" class="form-input ai-input" placeholder="원하는 동작을 자연어로 설명하세요... (예: 'LED를 깜빡여라', '모터를 3초간 전진시켜라')"></textarea>
                        <div id="ai_output_${widgetId}" class="output-content ai-output"></div>
                    </div>
                </div>
            </div>
        </div>`;

    createWidgetByHTML(widgetHTML);

    const bind = () => {
        const btnGenerate = document.getElementById(`btnGenerate_${widgetId}`);
        const btnClear = document.getElementById(`btnClear_${widgetId}`);
        const title = document.getElementById(`title_${widgetId}`);
        const inputEl = document.getElementById(`ai_input_${widgetId}`);
        const outputEl = document.getElementById(`ai_output_${widgetId}`);
        const statusEl = document.getElementById(`llmStatus_${widgetId}`);
        const autoRunToggle = document.getElementById(`autoRunToggle_${widgetId}`);
        const autoRunLabel = document.getElementById(`autoRunLabel_${widgetId}`);

        let generatedCode = ''; // 생성된 코드 저장

        // Auto Run 토글 이벤트
        if (autoRunToggle && autoRunLabel) {
            autoRunToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isActive = autoRunToggle.classList.toggle('active');
                autoRunLabel.textContent = isActive ? 'On' : 'Off';
            });
        }

        const updateStatus = (loaded, loading, error) => {
            if (!statusEl || !btnGenerate) return;
            if (loading) {
                statusEl.textContent = 'Loading...';
                btnGenerate.disabled = true;
                return;
            }
            if (error) {
                statusEl.textContent = 'Load Failed';
                btnGenerate.disabled = true;
                return;
            }
            if (loaded) {
                statusEl.textContent = 'Ready';
                btnGenerate.disabled = false;
                return;
            }
            statusEl.textContent = 'Idle';
            btnGenerate.disabled = true;
        };

        // Apply current global status immediately
        try {
            const s = typeof window.getLlmStatus === 'function' ? window.getLlmStatus() : {loaded:false,loading:true,error:null};
            updateStatus(!!s.loaded, !!s.loading, s.error || null);
        } catch(_) {}

        // Subscribe to global llm status events
        const listener = (e) => {
            const d = e && e.detail ? e.detail : {};
            updateStatus(!!d.loaded, !!d.loading, d.error || null);
        };
        window.addEventListener('llm_status_changed', listener);

        // Kick off loading if not yet (harmless if already done)
        try {
            if (typeof window.loadLLM === 'function') {
                window.loadLLM().catch(()=>{});
            }
        } catch(_) {}

        if (title) title.addEventListener('click', () => copyWidgetId(widgetId));

        if (btnGenerate && inputEl && outputEl) {
            // 입력 필드 키 이벤트: Shift+Enter는 줄바꿈, Enter는 Generate
            inputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    btnGenerate.click();
                }
            });

            btnGenerate.addEventListener('click', async () => {
                const request = (inputEl.value || '').trim();
                if (!request) { showToast('동작을 설명해주세요.', 'warning'); return; }

                // LLM 준비 상태 우선 검사 및 보정
                try {
                    const snap = (typeof window.getLlmStatus === 'function') ? window.getLlmStatus() : {loaded:false};
                    if (!snap.loaded && typeof window.loadLLM === 'function') {
                        await window.loadLLM();
                    }
                    const snap2 = (typeof window.getLlmStatus === 'function') ? window.getLlmStatus() : {loaded:false, error:'LLM not loaded'};
                    if (!snap2.loaded) {
                        showToast('LLM이 준비되지 않았습니다. API 키를 확인하세요.', 'error');
                        return;
                    }
                } catch (_) {
                    showToast('LLM 초기화에 실패했습니다.', 'error');
                    return;
                }
                
                try {
                    // 렌더 타깃을 마크다운 컨테이너로 사용
                    outputEl.innerHTML = '';
                    btnGenerate.disabled = true;
                    
                    // 코드 생성 프롬프트 구성
                    const parts = [];
                    if (window.LLM_SYSTEM_PROMPT) parts.push(window.LLM_SYSTEM_PROMPT);
                    if (window.FINDEE_API_BRIEF) parts.push('Findee API 요약:\n' + window.FINDEE_API_BRIEF);
                    parts.push('**코드 생성 요청**:');
                    parts.push(`사용자가 원하는 동작: ${request}`);
                    parts.push('**생성할 코드의 필수 요구사항**:');
                    parts.push('1. robot = Findee()');
                    parts.push('2. try-except-finally 구조');
                    parts.push('3. robot.cleanup()');
                    parts.push('4. 사용자의 요청을 정확히 수행하는 코드');
                    parts.push('5. 코드는 실행 가능해야 함');
                    parts.push('**중요한 주의사항**:');
                    parts.push('- robot.move_forward(speed=50, duration=1.0) 같은 코드는 이미 1초를 대기하고 자동으로 stop하므로 추가적인 time.sleep()을 사용하지 마세요.');
                    parts.push('- motor 관련 함수들은 duration 매개변수로 동작 시간을 지정할 수 있습니다.');
                    parts.push('- time.sleep()은 motor 함수의 duration 매개변수로 대체 가능한 경우 사용하지 마세요.');
                    parts.push('**응답 형식**:');
                    parts.push('```python');
                    parts.push('# 여기에 Python 코드를 작성');
                    parts.push('```');
                    parts.push('코드만 생성하고 설명은 최소화하세요.');
                    
                    const fullPrompt = parts.join('\n\n');
                    
                    await window.askLLM(fullPrompt, (partial, complete) => {
                        // Markdown 렌더링
                        try {
                            const html = (window.marked ? window.marked.parse(partial) : partial).toString();
                            outputEl.innerHTML = html;
                        } catch (_) {
                            outputEl.textContent = partial;
                        }
                        if (complete) {
                            btnGenerate.disabled = false;
                            
                            // 생성된 코드 추출
                            const codeMatch = partial.match(/```python\n([\s\S]*?)\n```/);
                            if (codeMatch) {
                                generatedCode = codeMatch[1].trim();
                                
                                // Auto Run이 활성화된 경우 자동 실행
                                const isAutoRun = !!(autoRunToggle && autoRunToggle.classList.contains('active'));
                                if (isAutoRun) {
                                    executeGeneratedCode(generatedCode);
                                } else {
                                    showToast('코드가 생성되었습니다. Auto Run을 On으로 설정하면 자동으로 실행됩니다.', 'success');
                                }
                            } else {
                                generatedCode = '';
                                showToast('코드 생성에 실패했습니다. 다시 시도해주세요.', 'error');
                            }
                        }
                    });
                } catch (e) {
                    btnGenerate.disabled = false;
                    showToast('LLM 요청 중 오류가 발생했습니다.', 'error');
                }
            });
        }

        // 생성된 코드 실행 함수
        function executeGeneratedCode(code) {
            if (!code) {
                showToast('실행할 코드가 없습니다.', 'warning');
                return;
            }

            if (!monacoEditor) {
                showToast('Monaco Editor가 초기화되지 않았습니다.', 'error');
                return;
            }

            // 코드를 직접 실행 (에디터에 반영하지 않음)
            if (window.socket && window.socket.connected) {
                window.socket.emit('execute_code', {code: code});
                showToast('생성된 코드가 실행됩니다.', 'success');
            } else {
                showToast('Socket.IO가 연결되어 있지 않습니다. 코드를 에디터에 설정합니다.', 'warning');
                // 폴백: 에디터에 코드 설정
                monacoEditor.setValue(code);
            }
        }

        if (btnClear && inputEl && outputEl) {
            btnClear.addEventListener('click', () => {
                inputEl.value = '';
                outputEl.textContent = '';
                generatedCode = '';
            });
        }

        if (typeof window !== 'undefined') window.aiControllerRunning = true;

        // Cleanup on remove (best-effort)
        const cleanupObserver = new MutationObserver(() => {
            const el = document.getElementById(widgetId);
            if (!el) {
                try { window.removeEventListener('llm_status_changed', listener); } catch(_) {}
                cleanupObserver.disconnect();
            }
        });
        cleanupObserver.observe(document.body, { childList: true, subtree: true });
    };

    setTimeout(bind, 0);

    return widgetId;
}
//#endregion

