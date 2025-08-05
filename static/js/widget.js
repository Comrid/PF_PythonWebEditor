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


// 우선 위젯 종류: 이미지 디스플레이 위젯, 텍스트 디스플레이 위젯, 버튼 위젯
// 후순위 위젯 종류: 텍스트 입력 위젯, 그래프? 위젯

let numImageDisplayWidget = 0;

function createImageDisplayWidget(){
    const widgetId = `imageDisplayWidget_${numImageDisplayWidget++}`;

    // 위젯 HTML 구조 생성
    const widgetHTML = `
        <div class="grid-stack-item" id="${widgetId}" gs-w="8" gs-h="10" gs-min-w="4" gs-min-h="6" gs-locked="false">
            <div class="grid-stack-item-content widget-content">
                <div class="widget-header">
                    <h4>
                        <i class="fas fa-image"></i>
                        <input type="text" class="widget-id-editor" value="${widgetId}"
                               onblur="updateWidgetId(this)"
                               onkeypress="handleWidgetIdKeyPress(event, this, '${widgetId}')"
                               onfocus="handleWidgetIdFocus(this)">
                    </h4>
                    <button class="widget-close-btn" onclick="removeWidget('${widgetId}')">
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

    // GridStack에 위젯 추가
    if (window.mainGridStack) {
        // // HTML을 DOM 요소로 변환
        // const tempDiv = document.createElement('div');
        // tempDiv.innerHTML = widgetHTML.trim();
        // const widgetElement = tempDiv.firstChild;

        // // GridStack에 위젯 추가
        // window.mainGridStack.addWidget(widgetElement);

        // console.log(`Image display widget created with ID: ${widgetId}`);
        // return widgetId;
        // GridStack 컨테이너 요소 가져오기
        const gridContainer = document.getElementById('mainGridStack');

        if (gridContainer) {
            // HTML을 DOM 요소로 변환
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = widgetHTML.trim();
            const widgetElement = tempDiv.firstChild;

            // 디버깅: 위젯 요소 확인
            console.log('Widget element created:', widgetElement);
            console.log('Widget HTML:', widgetHTML);

            // 직접 DOM에 추가
            gridContainer.appendChild(widgetElement);

            // GridStack 버전 확인 및 위젯 등록
            console.log('GridStack version:', GridStack.version);

            try {
                if (GridStack.version && GridStack.version.startsWith('11')) {
                    // GridStack v11: makeWidget() 사용
                    const addedWidget = window.mainGridStack.makeWidget(widgetElement);
                    console.log('Widget added using makeWidget (v11):', addedWidget);
                } else {
                    // GridStack v10 이하: addWidget() 사용
                    window.mainGridStack.makeWidget(widgetElement);
                    console.log('Widget added using makeWidget (v10 or below)');
                }
    } catch (error) {
                console.error('GridStack widget registration error:', error);
                console.log('Widget added to DOM only');
            }

            // 디버깅: 추가된 위젯 확인
            console.log('Widget added to DOM and grid');
            console.log('Current grid items:', window.mainGridStack.getGridItems());
            console.log('Grid container children:', gridContainer.children);

            console.log(`Image display widget created with ID: ${widgetId}`);
            return widgetId;
        } else {
            console.error('Grid container not found');
            return null;
        }
    } else {
        console.error('GridStack is not initialized');
        return null;
    }
}

// 특정 위젯에 이미지 업데이트하는 함수
function handleImageUpdate(imageData, widgetId) {
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


// 공용용

// 위젯 삭제 함수
function removeWidget(widgetId) {
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




// ID 편집 관련
// 위젯 ID 업데이트 함수
function updateWidgetId(inputElement) {
    const newWidgetId = inputElement.value.trim();

    if (!newWidgetId) {
        // 빈 값이면 원래 ID로 복원
        inputElement.value = inputElement.closest('.grid-stack-item').id;
        return;
    }

    if (newWidgetId === inputElement.closest('.grid-stack-item').id) {
        return; // 변경사항이 없음
    }

    //console.log(`Updating widget ID from ${inputElement.closest('.grid-stack-item').id} to ${newWidgetId}`);

    try {
        // 위젯 요소를 현재 DOM에서 찾기 (부모 요소를 통해)
        const widgetElement = inputElement.closest('.grid-stack-item');
        if (!widgetElement) {
            console.error(`Widget element not found for input:`, inputElement);
            inputElement.value = inputElement.closest('.grid-stack-item').id;
            return;
        }

        const currentWidgetId = widgetElement.id;
        //console.log(`Found widget with current ID: ${currentWidgetId}`);

        // 위젯 요소의 ID 업데이트
        widgetElement.id = newWidgetId;

        // 내부 요소들의 ID도 업데이트
        const imageDisplay = widgetElement.querySelector(`#imageDisplay_${currentWidgetId}`);
        const displayImage = widgetElement.querySelector(`#displayImage_${currentWidgetId}`);

        if (imageDisplay) {
            imageDisplay.id = `imageDisplay_${newWidgetId}`;
            //console.log(`Updated imageDisplay ID: imageDisplay_${currentWidgetId} -> imageDisplay_${newWidgetId}`);
        }

        if (displayImage) {
            displayImage.id = `displayImage_${newWidgetId}`;
            //console.log(`Updated displayImage ID: displayImage_${currentWidgetId} -> displayImage_${newWidgetId}`);
        }

        console.log(`Widget ID updated successfully: ${currentWidgetId} -> ${newWidgetId}`);

    } catch (error) {
        console.error(`Error updating widget ID:`, error);
        inputElement.value = inputElement.closest('.grid-stack-item').id;
    }
}

// 위젯 ID 편집 시 키보드 이벤트 처리
function handleWidgetIdKeyPress(event, inputElement, oldWidgetId) {
    if (event.key === 'Enter') {
        // Enter 키를 누르면 포커스 해제하여 업데이트 함수 호출
        inputElement.blur();
    } else if (event.key === 'Escape') {
        // Escape 키를 누르면 원래 값으로 복원
        // 현재 위젯의 실제 ID를 가져와서 복원
        const widgetElement = inputElement.closest('.grid-stack-item');
        if (widgetElement) {
            inputElement.value = widgetElement.id;
        } else {
            inputElement.value = oldWidgetId;
        }
        inputElement.blur();
    }
}

function handleWidgetIdFocus(inputElement) {
    inputElement.select();
}