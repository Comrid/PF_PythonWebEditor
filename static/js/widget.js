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
            removable: true
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

// Initialize GridStack (Legacy function for backward compatibility)
function initializeGridStack() {
    return initializeMainGridStack();
}

function isCollidingWithOthers(grid, node) {
    const items = grid.engine.nodes;

    return items.some(other => {
        if (other === node) return false;

        return (
            node.x < other.x + other.w &&
            node.x + node.w > other.x &&
            node.y < other.y + other.h &&
            node.y + node.h > other.y
        );
    });
}

// Image Widget Functions
function refreshImageWidget() {
    console.log('Refreshing image widget...');
    // 이미지 위젯 새로고침 로직
    const placeholder = document.querySelector('#imageDisplay .placeholder-text');
    const image = document.getElementById('displayImage');
    
    if (placeholder && image) {
        image.style.display = 'none';
        placeholder.style.display = 'block';
        placeholder.textContent = '이미지를 새로고침했습니다';
    }
}

function clearImageWidget() {
    console.log('Clearing image widget...');
    const placeholder = document.querySelector('#imageDisplay .placeholder-text');
    const image = document.getElementById('displayImage');
    
    if (placeholder && image) {
        image.style.display = 'none';
        image.src = '';
        placeholder.style.display = 'block';
        placeholder.textContent = '이미지가 여기에 표시됩니다';
    }
}

// Socket.IO 이미지 수신 함수
function handleImageUpdate(imageData) {
    console.log('Received image update');
    
    const placeholder = document.querySelector('#imageDisplay .placeholder-text');
    const image = document.getElementById('displayImage');
    
    if (!placeholder || !image) {
        console.error('Image widget elements not found');
        return;
    }

    try {
        // base64 이미지 데이터를 직접 설정
        image.onload = function() {
            image.style.display = 'block';
            placeholder.style.display = 'none';
            console.log('Image loaded successfully');
        };

        image.onerror = function() {
            console.error('Failed to load image');
            image.style.display = 'none';
            placeholder.style.display = 'block';
            placeholder.textContent = '이미지 로드 실패';
        };

        // base64 데이터를 직접 src에 설정
        image.src = `data:image/jpeg;base64,${imageData}`;

    } catch (error) {
        console.error('Error processing image:', error);
        image.style.display = 'none';
        placeholder.style.display = 'block';
        placeholder.textContent = '이미지 처리 오류';
    }
}

// 카메라 피드 업데이트 함수
function handleCameraFeedUpdate(widgetName, imageData) {
    console.log(`Received camera feed update for widget: ${widgetName}`);

    const imageElement = document.getElementById(`display-image-${widgetName.toLowerCase()}`);
    const placeholder = document.getElementById(`image-placeholder-${widgetName.toLowerCase()}`);

    if (!imageElement || !placeholder) {
        console.error(`Camera widget elements not found for: ${widgetName}`);
        return;
    }

    try {
        // base64 이미지 데이터를 직접 설정
        imageElement.onload = function() {
            imageElement.style.display = 'block';
            placeholder.style.display = 'none';
        };

        imageElement.onerror = function() {
            console.error(`Failed to load camera feed for widget: ${widgetName}`);
            imageElement.style.display = 'none';
            placeholder.style.display = 'block';
        };

        // base64 데이터를 직접 src에 설정
        imageElement.src = imageData;

    } catch (error) {
        console.error(`Error processing camera feed for widget ${widgetName}:`, error);
        imageElement.style.display = 'none';
        placeholder.style.display = 'block';
    }
}

function createImageWidget() {
    const widgetName = `Image_Display_${imageWidgetCounter}`;
    imageWidgetCounter++;

    const imageWidget = document.createElement('div');
    imageWidget.className = 'grid-stack-item';
    imageWidget.setAttribute('gs-x', '0');
    imageWidget.setAttribute('gs-y', '0');
    imageWidget.setAttribute('gs-w', '6');
    imageWidget.setAttribute('gs-h', '4');
    imageWidget.innerHTML = `
        <div class="widget-content">
            <div class="widget-header">
                <h4>
                    <i class="fas fa-image"></i>
                    <span class="widget-title" contenteditable="true" data-widget-name="${widgetName}">${widgetName}</span>
                </h4>
                <div class="widget-controls">
                    <button class="btn-icon" onclick="refreshImage(this)"><i class="fas fa-sync"></i></button>
                    <button class="btn-icon" onclick="removeWidget(this)"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div class="widget-body">
                <div class="image-widget">
                    <div class="image-container" id="image-container-${widgetName.toLowerCase()}">
                        <img id="display-image-${widgetName.toLowerCase()}" src="" alt="No image loaded" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px;">
                        <div class="image-placeholder" id="image-placeholder-${widgetName.toLowerCase()}">
                            <i class="fas fa-image" style="font-size: 48px; color: rgba(255, 255, 255, 0.3);"></i>
                            <p style="color: rgba(255, 255, 255, 0.5); margin-top: 8px;">No image loaded</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 제목 편집 이벤트 리스너 추가
    setTimeout(() => {
        const titleElement = imageWidget.querySelector('.widget-title');
        if (titleElement) {
            titleElement.addEventListener('blur', function() {
                const newName = this.textContent.trim();
                console.log(`Widget name changed to: ${newName}`);
            });

            titleElement.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.blur();
                }
            });
        }
    }, 100);

    return imageWidget;
}

function refreshImage(button) {
    const widgetContent = button.closest('.widget-content');
    const titleElement = widgetContent.querySelector('.widget-title');
    const widgetName = titleElement ? titleElement.textContent.trim() : 'Image_Display_1';

    const imageContainer = document.getElementById(`image-container-${widgetName.toLowerCase()}`);
    const imageElement = document.getElementById(`display-image-${widgetName.toLowerCase()}`);
    const placeholder = document.getElementById(`image-placeholder-${widgetName.toLowerCase()}`);

    if (!imageElement || !placeholder) {
        console.error('Image widget elements not found');
        return;
    }

    // 위젯 이름을 URL 파라미터로 전달
    const apiUrl = `/api/get-image?widget=${encodeURIComponent(widgetName)}`;

    // Flask에서 이미지를 가져오는 API 호출
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch image');
            }
            return response.blob();
        })
        .then(blob => {
            const imageUrl = URL.createObjectURL(blob);

            // 이미지 로드 완료 후 처리
            imageElement.onload = function() {
                imageElement.style.display = 'block';
                placeholder.style.display = 'none';

                // 메모리 정리
                setTimeout(() => {
                    URL.revokeObjectURL(imageUrl);
                }, 1000);
            };

            imageElement.onerror = function() {
                imageElement.style.display = 'none';
                placeholder.style.display = 'block';
            };

            imageElement.src = imageUrl;
        })
        .catch(error => {
            console.error('Error fetching image:', error);
            imageElement.style.display = 'none';
            placeholder.style.display = 'block';
        });
}

// Widget Utility Functions for Individual Addition

/*
 * 사용 예시:
 *
 * // 개별 위젯 추가
 * addWidgetByName('cpu');           // CPU 위젯 추가
 * addWidgetByName('memory');        // 메모리 위젯 추가
 * addWidgetByName('weather');       // 날씨 위젯 추가
 *
 * // 여러 위젯 한번에 추가
 * addMultipleWidgets(['cpu', 'memory', 'clock']);
 *
 * // 위젯 제거
 * removeWidgetByName('cpu');        // CPU 위젯 제거
 *
 * // 현재 위젯 목록 확인
 * listCurrentWidgets();
 *
 * // 사용 가능한 위젯 목록 확인
 * getAvailableWidgets();
 *
 * // 모든 위젯 제거
 * clearAllWidgets();
 *
 * // 위젯 개수 확인
 * getWidgetCount();
 */

function addWidgetByName(widgetName, grid = null) {
    const targetGrid = grid || window.gridStack;
    if (!targetGrid) {
        console.error('Grid instance is null');
        return false;
    }

    const widgetMap = {
        'cpu': createCPUWidget,
        'memory': createMemoryWidget,
        'network': createNetworkWidget,
        'system': createSystemInfoWidget,
        'actions': createQuickActionsWidget,
        'code-stats': createCodeStatsWidget,
        'weather': createWeatherWidget,
        'clock': createClockWidget,
        'progress': createProgressWidget,
        'image': createImageWidget
    };

    const createFunction = widgetMap[widgetName.toLowerCase()];
    if (!createFunction) {
        console.error(`Unknown widget type: ${widgetName}`);
        return false;
    }

    try {
        const widget = createFunction();
        targetGrid.addWidget(widget);
        console.log(`${widgetName} widget added successfully`);
        return true;
    } catch (error) {
        console.error(`Error adding ${widgetName} widget:`, error);
        return false;
    }
}

function addMultipleWidgets(widgetNames, grid = null) {
    const targetGrid = grid || window.gridStack;
    if (!targetGrid) {
        console.error('Grid instance is null');
        return false;
    }

    const results = [];
    widgetNames.forEach(name => {
        const success = addWidgetByName(name, targetGrid);
        results.push({ name, success });
    });

    console.log('Widget addition results:', results);
    return results;
}

function removeWidgetByName(widgetName) {
    const grid = window.gridStack;
    if (!grid) {
        console.error('Grid instance is null');
        return false;
    }

    const widgets = grid.getGridItems();
    for (let widget of widgets) {
        const header = widget.querySelector('.widget-header h4');
        if (header && header.textContent.toLowerCase().includes(widgetName.toLowerCase())) {
            grid.removeWidget(widget);
            console.log(`${widgetName} widget removed successfully`);
            return true;
        }
    }

    console.log(`Widget ${widgetName} not found`);
    return false;
}

function getAvailableWidgets() {
    return [
        { name: 'CPU', key: 'cpu', description: 'CPU 사용률 게이지' },
        { name: 'Memory', key: 'memory', description: '메모리 사용률 바' },
        { name: 'Network', key: 'network', description: '네트워크 활동 모니터링' },
        { name: 'System Info', key: 'system', description: '시스템 정보 표시' },
        { name: 'Quick Actions', key: 'actions', description: '빠른 실행 버튼들' },
        { name: 'Code Statistics', key: 'code-stats', description: '코드 통계 정보' },
        { name: 'Weather', key: 'weather', description: '날씨 정보 표시' },
        { name: 'Clock', key: 'clock', description: '실시간 시계' },
        { name: 'Progress', key: 'progress', description: '프로젝트 진행률' },
        { name: 'Image Display', key: 'image', description: '이미지 표시' }
    ];
}

function clearAllWidgets() {
    const grid = window.gridStack;
    if (!grid) {
        console.error('Grid instance is null');
        return false;
    }

    const widgets = grid.getGridItems();
    widgets.forEach(widget => {
        grid.removeWidget(widget);
    });

    console.log('All widgets cleared');
    return true;
}

function getWidgetCount() {
    const grid = window.gridStack;
    if (!grid) {
        return 0;
    }

    return grid.getGridItems().length;
}

function listCurrentWidgets() {
    const grid = window.gridStack;
    if (!grid) {
        console.error('Grid instance is null');
        return [];
    }

    const widgets = grid.getGridItems();
    const widgetList = widgets.map(widget => {
        const header = widget.querySelector('.widget-header h4');
        return header ? header.textContent.trim() : 'Unknown Widget';
    });

    console.log('Current widgets:', widgetList);
    return widgetList;
}

// Widget Name Utility Functions

function getWidgetName(widgetElement) {
    const titleElement = widgetElement.querySelector('.widget-title');
    return titleElement ? titleElement.textContent.trim() : 'Unknown Widget';
}

function getAllImageWidgetNames() {
    const grid = window.gridStack;
    if (!grid) {
        return [];
    }

    const widgets = grid.getGridItems();
    const imageWidgetNames = [];

    widgets.forEach(widget => {
        const header = widget.querySelector('.widget-header h4');
        if (header && header.textContent.includes('Image_Display')) {
            const titleElement = widget.querySelector('.widget-title');
            if (titleElement) {
                imageWidgetNames.push(titleElement.textContent.trim());
            }
        }
    });

    return imageWidgetNames;
}

function refreshAllImageWidgets() {
    const imageWidgetNames = getAllImageWidgetNames();
    console.log('Refreshing all image widgets:', imageWidgetNames);

    imageWidgetNames.forEach(widgetName => {
        // 각 위젯의 새로고침 버튼을 찾아서 클릭
        const grid = window.gridStack;
        if (grid) {
            const widgets = grid.getGridItems();
            widgets.forEach(widget => {
                const titleElement = widget.querySelector('.widget-title');
                if (titleElement && titleElement.textContent.trim() === widgetName) {
                    const refreshButton = widget.querySelector('.btn-icon[onclick*="refreshImage"]');
                    if (refreshButton) {
                        refreshButton.click();
                    }
                }
            });
        }
    });
}