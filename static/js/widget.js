// Initialize Main GridStack
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

function removeWidget(widgetId) {
    // 위젯 삭제 함수
    try {
        if (window.mainGridStack) {
            const widgetElement = document.getElementById(widgetId);
            if (widgetElement) {
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
    const widgetId = `imageDisplayWidget_${numImageDisplayWidget++}`;

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
        // base64 이미지 데이터를 직접 설정
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

        // base64 데이터를 직접 src에 설정
        image.src = `data:image/jpeg;base64,${imageData}`;

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
    const widgetId = `textDisplayWidget_${numTextDisplayWidget++}`;

    const widgetHTML = `
        <div class="grid-stack-item" id="${widgetId}" gs-w="8" gs-h="2" gs-min-w="4" gs-min-h="2" gs-locked="true">
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





