function positionPopover(anchorEl, popoverEl){
    const rect = anchorEl.getBoundingClientRect();
    popoverEl.style.top = `${rect.bottom + window.scrollY + 2}px`;
    popoverEl.style.right = `${window.scrollX + window.innerWidth - rect.right}px`;
}

function initializePopover(){
    initializeEditorSettingsPopover();
    initializeAddWidgetPopover();
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
                exam1: `#Welcome to the Pathfinder Editor!`,
                exam2: getCode1(),
                exam3: getCode2(),
                exam4: getCode3(),
                exam5: getCode4(),
                exam6: getCode5(),
                exam7: getCode6()
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

    // 항목 클릭 → 위젯 생성
    grid.querySelectorAll('.widget-picker-item').forEach((el, idx) => {
        el.addEventListener('click', () => {
            const key = el.getAttribute('data-key');
            const item = items.find(i => i.key === key);
            if (item && typeof item.handler === 'function') {
                const widgetId = item.handler();
                if (widgetId) {
                    showToast(`${item.label} 위젯이 생성되었습니다: ${widgetId}`, 'success');
                }
            }
        });
    });

    // 윈도우 리사이즈 시 재배치
    window.addEventListener('resize', () => {
        if (popover.classList.contains('show')) {
            positionPopover(addBtn, popover);
        }
    });
}
//#endregion
