// Socket.IO 이벤트 핸들러 및 통신

// Socket.IO 초기화
function initializeSocket() {
    try {
        if (typeof window.io === 'undefined') {
            console.error('Socket.IO 라이브러리가 로드되지 않았습니다.');
            return;
        }

        socket = window.io();
        

        // 연결시
        socket.on('connect', function() {
            console.log('Connected to server');
            isConnected = true;
            updateExecutionButtons(false);
            updateConnectionStatus(true);
            showToast('서버에 연결되었습니다.', 'success');
        });

        // 연결 해제시
        socket.on('disconnect', function() {
            console.log('Disconnected from server');
            isConnected = false;
            updateConnectionStatus(false);
            showToast('서버와의 연결이 끊어졌습니다.', 'error');
        });

        // 실행 시작 이벤트
        socket.on('execution_started', function(data) {
            codeRunning = true;
            updateExecutionButtons(true);
            updateExecutionStatus('실행 중');
            //addOutput('▶️ 코드 실행을 시작합니다...', 'system');
            showToast('코드 실행을 시작합니다.', 'info');
        });

        // 코드 실행 중지 이벤트 핸들러
        socket.on('execution_stopped', function(data) {
            codeRunning = false;
            updateExecutionButtons(false);
            updateExecutionStatus('중지됨');
            //addOutput('⏹️ 코드 실행이 중지되었습니다.', 'warning');
            showToast('코드 실행이 중지되었습니다.', 'warning');
        });

        // 실행 완료 이벤트
        socket.on('finished', function(data) {
            codeRunning = false;
            updateExecutionButtons(false);
            updateExecutionStatus('완료');
            showToast('코드 실행이 완료되었습니다.', 'success');
            addOutput('execution ended', 'success');
        });

        // 실행 에러 이벤트
        socket.on('execution_error', function(data) {
            codeRunning = false;
            updateExecutionButtons(false);
            updateExecutionStatus('오류');
            addOutput('❌ 실행 오류: ' + data.error, 'error');
            showToast('실행 오류: ' + data.error, 'error');
        });

        // 이미지 업데이트 이벤트
        socket.on('image_update', function(data) {
            const { widget_name, image_data } = data;
            handleImageUpdate(widget_name, image_data);
        });

        // 카메라 피드 업데이트 이벤트
        socket.on('camera_feed_update', function(data) {
            const { widget_name, image_data } = data;
            handleCameraFeedUpdate(widget_name, image_data);
        });

        // 이미지 데이터 이벤트 (서브 프로세스에서 전송)
        socket.on('image_data', function(data) {
            handleImageData(data);
        });

        // 커스텀 데이터 이벤트 (서브 프로세스에서 전송)
        socket.on('custom_data', function(data) {
            handleCustomData(data);
        });

    } catch (error) {
        console.error('Socket.IO 초기화 중 오류:', error);
        showToast('연결 초기화 중 오류가 발생했습니다.', 'error');
    }
}

// 코드 실행 중지 함수
function stopCodeExecution() {
    if (!socket || !isConnected) {
        showToast('서버에 연결되지 않았습니다.', 'error');
        return;
    }

    if (!codeRunning) {
        showToast('실행 중인 코드가 없습니다.', 'warning');
        return;
    }

    socket.emit('stop_execution');
    showToast('코드 실행 중지 요청을 보냈습니다...', 'info');
}

// 연결 상태 업데이트
function updateConnectionStatus(connected) {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-item span');

    if (statusDot && statusText) {
        statusDot.className = 'status-dot';
        if (connected) {
            statusText.textContent = 'Connected';
        } else {
            statusDot.classList.add('error');
            statusText.textContent = 'Disconnected';
        }
    }
}

// 이미지 데이터 처리 함수
function handleImageData(data) {
    try {
        console.log('이미지 데이터 수신:', data);
        
        if (data.image) {
            // Image_Display_1 위젯으로 이미지 전달
            displayImageToWidget('Image_Display_1', data.image, data.shape);
            
            // 출력 패널에 로그 추가
            addOutput('📷 이미지가 Image_Display_1 위젯으로 전송되었습니다.', 'success');
        }
    } catch (error) {
        console.error('이미지 데이터 처리 오류:', error);
        addOutput('❌ 이미지 처리 오류: ' + error.message, 'error');
    }
}

// 커스텀 데이터 처리 함수
function handleCustomData(data) {
    try {
        console.log('커스텀 데이터 수신:', data);
        
        // 출력 패널에 데이터 표시
        addOutput('📊 커스텀 데이터: ' + JSON.stringify(data), 'info');
    } catch (error) {
        console.error('커스텀 데이터 처리 오류:', error);
        addOutput('❌ 데이터 처리 오류: ' + error.message, 'error');
    }
}

// 위젯에 이미지를 표시하는 함수
function displayImageToWidget(widgetName, base64Data, shape) {
    try {
        console.log(`이미지를 위젯 ${widgetName}에 표시합니다.`);
        
        // 위젯 요소 찾기
        let imageElement = document.getElementById(`display-image-${widgetName.toLowerCase()}`);
        let placeholder = document.getElementById(`image-placeholder-${widgetName.toLowerCase()}`);
        
        // 위젯이 없으면 자동으로 생성
        if (!imageElement || !placeholder) {
            console.log(`위젯 ${widgetName}이 없어서 자동으로 생성합니다.`);
            createImageWidgetIfNotExists(widgetName);
            
            // 생성 후 다시 요소 찾기
            setTimeout(() => {
                imageElement = document.getElementById(`display-image-${widgetName.toLowerCase()}`);
                placeholder = document.getElementById(`image-placeholder-${widgetName.toLowerCase()}`);
                
                if (imageElement && placeholder) {
                    displayImageToElement(imageElement, placeholder, base64Data);
                }
            }, 100);
            return;
        }
        
        // 기존 위젯에 이미지 표시
        displayImageToElement(imageElement, placeholder, base64Data);
        
    } catch (error) {
        console.error(`위젯 ${widgetName}에 이미지 표시 중 오류:`, error);
        addOutput(`❌ 위젯 ${widgetName}에 이미지 표시 오류: ${error.message}`, 'error');
    }
}

// 위젯이 없을 때 자동으로 생성하는 함수
function createImageWidgetIfNotExists(widgetName) {
    try {
        // GridStack 인스턴스 가져오기
        const grid = GridStack.getGridStack();
        if (!grid) {
            console.error('GridStack을 찾을 수 없습니다.');
            return;
        }
        
        // 위젯 생성 (widget.js의 createImageWidget 함수 사용)
        if (typeof createImageWidget === 'function') {
            const imageWidget = createImageWidget();
            
            // 위젯 제목을 원하는 이름으로 설정
            const titleElement = imageWidget.querySelector('.widget-title');
            if (titleElement) {
                titleElement.textContent = widgetName;
            }
            
            // GridStack에 추가
            grid.addWidget(imageWidget);
            
            console.log(`위젯 ${widgetName}이 성공적으로 생성되었습니다.`);
            addOutput(`✅ 위젯 ${widgetName}이 자동으로 생성되었습니다.`, 'success');
        } else {
            console.error('createImageWidget 함수를 찾을 수 없습니다.');
        }
        
    } catch (error) {
        console.error(`위젯 ${widgetName} 생성 중 오류:`, error);
        addOutput(`❌ 위젯 ${widgetName} 생성 오류: ${error.message}`, 'error');
    }
}

// 이미지 요소에 이미지를 표시하는 함수 (Pixelated 스타일)
function displayImageToElement(imageElement, placeholder, base64Data) {
    // pixelated 스타일 적용
    imageElement.style.imageRendering = 'pixelated';
    
    // base64 이미지 데이터를 직접 설정
    imageElement.onload = function() {
        imageElement.style.display = 'block';
        placeholder.style.display = 'none';
        console.log('Pixelated 이미지가 성공적으로 로드되었습니다.');
    };
    
    imageElement.onerror = function() {
        console.error('이미지 로드 실패');
        imageElement.style.display = 'none';
        placeholder.style.display = 'block';
        addOutput('❌ 이미지 로드 실패', 'error');
    };
    
    // base64 데이터를 직접 src에 설정
    imageElement.src = 'data:image/jpeg;base64,' + base64Data;
}

// base64 이미지를 Canvas에 표시하는 함수 (기존 함수 유지)
function displayImageFromBase64(base64Data, shape) {
    // 이미지 표시용 Canvas 생성 또는 기존 Canvas 사용
    let canvas = document.getElementById('image-display-canvas');
    
    if (!canvas) {
        // Canvas가 없으면 생성
        canvas = document.createElement('canvas');
        canvas.id = 'image-display-canvas';
        canvas.width = shape ? shape[1] : 640;  // width
        canvas.height = shape ? shape[0] : 480;  // height
        canvas.style.border = '1px solid #ccc';
        canvas.style.margin = '10px';
        
        // 출력 패널에 Canvas 추가
        const outputContent = document.querySelector('.output-content');
        if (outputContent) {
            outputContent.appendChild(canvas);
        }
    }
    
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = function() {
        // Canvas 크기 조정
        canvas.width = img.width;
        canvas.height = img.height;
        
        // 이미지 그리기
        ctx.drawImage(img, 0, 0);
    };
    
    img.src = 'data:image/jpeg;base64,' + base64Data;
}