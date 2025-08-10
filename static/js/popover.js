function positionPopover(anchorEl, popoverEl){
    const rect = anchorEl.getBoundingClientRect();
    popoverEl.style.top = `${rect.bottom + window.scrollY + 2}px`;
    popoverEl.style.right = `${window.scrollX + window.innerWidth - rect.right}px`;
}

function initializePopover(){
    initializeEditorSettingsPopover();
    initializeAddWidgetPopover();
    initializeWebcamSettingsPopover();
}

//#region Editor Settings Popover
function initializeEditorSettingsPopover() {
    const settingsBtn = document.getElementById('editorSettingsBtn');
    const popover = document.getElementById('editorSettingsPopover');
    const closeBtn = document.getElementById('closeEditorSettings');

    const fontSizeIncBtn = document.getElementById('increaseFontSize');
    const fontSizeDecBtn = document.getElementById('decreaseFontSize');
    const wordWrapToggle = document.getElementById('wordWrapToggle');
    const minimapToggle = document.getElementById('minimapToggle');

    if (!settingsBtn || !popover) return;

    let outsideClickHandler = null;
    let keydownHandler = null;

    const show = () => {
        popover.classList.add('show');
        positionPopover(settingsBtn, popover);

        // 외부 클릭으로 닫기
        outsideClickHandler = (e) => {
            const isInside = popover.contains(e.target) || settingsBtn.contains(e.target);
            if (!isInside) hide();
        };
        setTimeout(() => document.addEventListener('click', outsideClickHandler), 0);

        // ESC로 닫기
        keydownHandler = (e) => { if (e.key === 'Escape') hide(); };
        document.addEventListener('keydown', keydownHandler);
    };

    const hide = () => {
        popover.classList.remove('show');
        if (outsideClickHandler) {
            document.removeEventListener('click', outsideClickHandler);
            outsideClickHandler = null;
        }
        if (keydownHandler) {
            document.removeEventListener('keydown', keydownHandler);
            keydownHandler = null;
        }
        dropdownDefault()
    };

    // 트리거 토글
    settingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (popover.classList.contains('show')) hide(); else show();
    });

    // 닫기 버튼
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            hide();
        });
    }

    // 내부 컨트롤 이벤트 바인딩
    if (fontSizeIncBtn) fontSizeIncBtn.addEventListener('click', increaseFontSize);
    if (fontSizeDecBtn) fontSizeDecBtn.addEventListener('click', decreaseFontSize);
    if (wordWrapToggle) wordWrapToggle.addEventListener('click', toggleWordWrap);
    if (minimapToggle) minimapToggle.addEventListener('click', toggleMinimap);

    // 예제 드롭다운 초기화
    dropdownExample();
}

// 폰트 크기 조절, wordWrap, minimap 토글 이벤트
function increaseFontSize() {
    // 폰트 크기 증가 이벤트
    if (fontSize >= 40) return;
    monacoEditor.updateOptions({fontSize:++fontSize});
    updateFontSizeText(fontSize);
}

function decreaseFontSize() {
    // 폰트 크기 감소 이벤트
    if (fontSize <= 10) return;
    monacoEditor.updateOptions({fontSize:--fontSize});
    updateFontSizeText(fontSize);
}

function updateFontSizeText(newFontSize){
    // 폰트 크기 텍스트 업데이트
    document.getElementById('currentFontSize').innerText = newFontSize;
}

function toggleWordWrap(){
    // 워드 랩 토글 이벤트
    const toggle = document.getElementById('wordWrapToggle');
    const label = document.getElementById('wordWrapLabel');

    if (toggle.classList.contains('active')) {
        toggle.classList.remove('active');
        label.textContent = 'Off';
    } else {
        toggle.classList.add('active');
        label.textContent = 'On';
    }

    monacoEditor.updateOptions({wordWrap: label.textContent.toLowerCase()});
}

function toggleMinimap(){
    // 미니맵 토글 이벤트
    const toggle = document.getElementById('minimapToggle');
    const label = document.getElementById('minimapLabel');

    if (toggle.classList.contains('active')) {
        toggle.classList.remove('active');
        label.textContent = 'Off';
    } else {
        toggle.classList.add('active');
        label.textContent = 'On';
    }

    state = label.textContent === 'On' ? true : false;
    monacoEditor.updateOptions({minimap: { enabled: state}});
}

function dropdownDefault(){
    const dropdownText = document.getElementById('loadExamText');
    dropdownText.textContent = 'Select Exam';
}

function dropdownExample(){
    const dropdown = document.getElementById('loadExamDropdown');
    const menu = document.getElementById('loadExamMenu');
    const dropdownText = document.getElementById('loadExamText');
    const dropdownItems = menu.querySelectorAll('.dropdown-item');

    // 드롭다운 버튼 클릭 이벤트
    dropdown.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        menu.classList.toggle('show');
        dropdown.classList.toggle('active');
    });

    // 드롭다운 아이템 클릭 이벤트
    dropdownItems.forEach(item => {
        item.addEventListener('click', function(e){
            e.preventDefault();
            e.stopPropagation();

            // 기존 선택 해제
            dropdownItems.forEach(i => i.classList.remove('selected'));

            // 현재 아이템 선택
            this.classList.add('selected');

            // 텍스트 업데이트
            const selectedText = this.textContent;
            const selectedValue = this.getAttribute('data-value');
            dropdownText.textContent = selectedText;

            // 드롭다운 닫기
            menu.classList.remove('show');
            dropdown.classList.remove('active');

            const codes = {
                Empty: "",
                Default: getEditorDefaultCode(),
                EditorExam: getEditorExampleCode(),
                CameraExam: getCameraExampleCode(),
                MotorExam: getMotorExampleCode(),
                UltrasonicExam: getUltrasonicExampleCode(),

                exam1: getCode1(),
                exam2: getCode2(),
                exam3: getCode3(),
                exam4: getCode4(),
                exam5: getCode5(),
                exam6: getCode6(),
            }
            monacoEditor.setValue(codes[selectedValue]);
        });
    });

    // 외부 클릭 시 드롭다운 닫기
    document.addEventListener('click', function(e){
        if (!dropdown.contains(e.target) && !menu.contains(e.target)) {
            menu.classList.remove('show');
            dropdown.classList.remove('active');
        }
    });

    // 드롭다운 메뉴 내부 스크롤 방지 (팝오버가 열려있을 때)
    menu.addEventListener('scroll', function(e){
        e.stopPropagation();
    });
}
//#endregion

//#region Add Widget Popover
function initializeAddWidgetPopover(){
    const addBtn = document.getElementById('addWidgetBtn');
    const popover = document.getElementById('addWidgetPopover');
    const closeBtn = document.getElementById('closeAddWidgetPopover');
    const grid = document.getElementById('addWidgetGrid');

    if (!addBtn || !popover || !grid) return;

    // 항목 렌더링 (아이콘 + 라벨)
    const items = [
        { key: 'image', icon: 'fa-image', label: 'Image Display', handler: createWidget_ImageDisplay },
        { key: 'text', icon: 'fa-font', label: 'Text Display', handler: createWidget_TextDisplay },
        { key: 'webcam', icon: 'fa-camera', label: 'Webcam', handler: createWidget_WebcamDisplay },
    ];
    grid.innerHTML = items.map(item => `
        <div class="widget-picker-item" data-key="${item.key}">
            <i class="fas ${item.icon}"></i>
            <span>${item.label}</span>
        </div>
    `).join('');

    // hover로 열기/닫기
    let hoverTimer = null;
    const show = () => { popover.classList.add('show'); positionPopover(addBtn, popover); };
    const hide = () => { popover.classList.remove('show'); };

    addBtn.addEventListener('mouseenter', () => {
        clearTimeout(hoverTimer);
        show();
    });
    addBtn.addEventListener('mouseleave', () => {
        hoverTimer = setTimeout(() => {
            // 버튼에서 빠졌지만 팝오버에 들어갔다면 닫지 않음
            if (!popover.matches(':hover')) hide();
        }, 150);
    });

    popover.addEventListener('mouseenter', () => {
        clearTimeout(hoverTimer);
    });
    popover.addEventListener('mouseleave', () => {
        hoverTimer = setTimeout(hide, 150);
    });

    // 닫기 버튼
    if (closeBtn) closeBtn.addEventListener('click', hide);

    // 항목 클릭 → 위젯 생성 (이벤트 위임)
    grid.addEventListener('click', (e) => {
        const el = e.target.closest('.widget-picker-item');
        if (!el || !grid.contains(el)) return;
        const key = el.getAttribute('data-key');
        const item = items.find(i => i.key === key);
        if (item && typeof item.handler === 'function') {
            const widgetId = item.handler();
            if (widgetId) showToast(`${item.label} 위젯이 생성되었습니다: ${widgetId}`, 'success');
        }
    });

    // 윈도우 리사이즈 시 재배치
    window.addEventListener('resize', () => {
        if (popover.classList.contains('show')) {
            positionPopover(addBtn, popover);
        }
    });
}
//#endregion

//#region Webcam Settings Popover
function initializeWebcamSettingsPopover(){
    const popover = document.getElementById('webcamSettingsPopover');
    const closeBtn = document.getElementById('closeWebcamSettingsPopover');
    if (!popover) return;

    let outsideClickHandler = null;
    let keydownHandler = null;

    const hide = () => {
        popover.classList.remove('show');
        if (outsideClickHandler) {
            document.removeEventListener('click', outsideClickHandler);
            outsideClickHandler = null;
        }
        if (keydownHandler) {
            document.removeEventListener('keydown', keydownHandler);
            keydownHandler = null;
        }
    };

    // 외부 참조를 위해 저장
    window.__hideWebcamSettingsPopover = hide;

    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            hide();
        });
    }

    // 리사이즈 시 재배치 (열려있는 경우)
    window.addEventListener('resize', () => {
        if (popover.classList.contains('show') && initializeWebcamSettingsPopover.__anchor) {
            positionPopover(initializeWebcamSettingsPopover.__anchor, popover);
        }
    });
}

function toggleWebcamSettingsPopover(anchorBtn, widgetId){
    const popover = document.getElementById('webcamSettingsPopover');
    if (!popover || !anchorBtn) return;

    // 이미 열려있고 같은 버튼이면 닫기
    if (popover.classList.contains('show') && initializeWebcamSettingsPopover.__anchor === anchorBtn) {
        window.__hideWebcamSettingsPopover && window.__hideWebcamSettingsPopover();
        return;
    }

    // 내용 초기화/주입
    const body = document.getElementById('webcamSettingsBody');
    if (body) {
        body.innerHTML = `
            <div class="setting-item">
                <label class="setting-label">Hand Gesture</label>
                <div class="toggle-controls">
                    <button class="toggle-btn" id="handGestureToggle_${widgetId}">
                        <div class="toggle-slider">
                            <div class="toggle-indicator"></div>
                        </div>
                        <span class="toggle-label" id="handGestureLabel_${widgetId}">Off</span>
                    </button>
                </div>
            </div>
        `;

        // 바인딩
        const toggle = document.getElementById(`handGestureToggle_${widgetId}`);
        const label = document.getElementById(`handGestureLabel_${widgetId}`);
        if (toggle && label) {
            // 초기 상태 동기화
            const enabled = !!(window.handGestureEnabledByWidget && window.handGestureEnabledByWidget.get && window.handGestureEnabledByWidget.get(widgetId));
            if (enabled) {
                toggle.classList.add('active');
                label.textContent = 'On';
            }

            toggle.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isActive = toggle.classList.toggle('active');
                label.textContent = isActive ? 'On' : 'Off';
                try {
                    if (isActive) {
                        if (typeof window.enableHandGesture !== 'function') {
                            // 지연 로드 hand_gesture.js
                            const s = document.createElement('script');
                            s.src = `${window.STATIC_BASE || ''}/static/js/hand_gesture.js`;
                            s.async = true;
                            await new Promise((res, rej) => { s.onload = res; s.onerror = rej; document.head.appendChild(s); });
                        }
                        window.enableHandGesture && window.enableHandGesture(widgetId);
                    } else {
                        window.disableHandGesture && window.disableHandGesture(widgetId);
                    }
                } catch (err) {
                    console.error('Hand gesture script load/enable failed:', err);
                    toggle.classList.remove('active');
                    label.textContent = 'Off';
                }
            });
        }
    }

    // 위치 및 표시
    positionPopover(anchorBtn, popover);
    popover.classList.add('show');

    // 현재 앵커 저장
    initializeWebcamSettingsPopover.__anchor = anchorBtn;

    // 외부 클릭/ESC로 닫기
    const outsideClickHandler = (e) => {
        const isInside = popover.contains(e.target) || anchorBtn.contains(e.target);
        if (!isInside) {
            window.__hideWebcamSettingsPopover && window.__hideWebcamSettingsPopover();
        }
    };
    setTimeout(() => document.addEventListener('click', outsideClickHandler), 0);

    const keydownHandler = (e) => { if (e.key === 'Escape') { window.__hideWebcamSettingsPopover && window.__hideWebcamSettingsPopover(); }};
    document.addEventListener('keydown', keydownHandler);

    // 현재 핸들러를 교체 저장하여 initialize에서 해제 가능하도록
    window.__hideWebcamSettingsPopover = () => {
        popover.classList.remove('show');
        document.removeEventListener('click', outsideClickHandler);
        document.removeEventListener('keydown', keydownHandler);
    };
}
//#endregion
