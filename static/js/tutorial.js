// Tutorial Management (for tutorial.html only)
// main.html에서는 인라인 JavaScript를 사용합니다.

const tutorialList = {
    'editor': [
        {
            id: 'image-widget',
            title: '이미지 위젯',
            description: '이미지를 표시하는 위젯 사용법을 학습합니다',
            difficulty: '초급',
            estimated_time: '5분'
        },
        {
            id: 'text-widget',
            title: '텍스트 위젯',
            description: '텍스트를 표시하는 위젯 사용법을 학습합니다',
            difficulty: '초급',
            estimated_time: '5분'
        },
        {
            id: 'webcam-widget',
            title: '웹캠 위젯',
            description: '웹캠 영상을 표시하는 위젯 사용법을 학습합니다',
            difficulty: '중급',
            estimated_time: '10분'
        },
        {
            id: 'slider-widget',
            title: '슬라이더 위젯',
            description: '값을 조절할 수 있는 슬라이더 위젯 사용법을 학습합니다',
            difficulty: '중급',
            estimated_time: '8분'
        }
    ],
    'findee': [
        {
            id: 'motor-basic',
            title: '모터 기본 제어',
            description: 'Findee 모듈을 사용한 기본적인 모터 제어 방법을 학습합니다',
            difficulty: '초급',
            estimated_time: '15분'
        },
        {
            id: 'sensor-ultrasonic',
            title: '초음파 센서',
            description: '초음파 센서를 사용하여 거리를 측정하는 방법을 학습합니다',
            difficulty: '중급',
            estimated_time: '12분'
        },
        {
            id: 'camera-basic',
            title: '카메라 기본 사용',
            description: 'Findee 카메라로 이미지를 캡처하고 처리하는 방법을 학습합니다',
            difficulty: '중급',
            estimated_time: '15분'
        }
    ],
    'advanced': [
        {
            id: 'ai-assistant',
            title: 'AI 어시스턴트',
            description: 'Gemini API를 활용한 AI 어시스턴트 기능 사용법을 학습합니다',
            difficulty: '고급',
            estimated_time: '20분'
        },
        {
            id: 'gesture-control',
            title: '제스처 제어',
            description: '손 제스처를 인식하여 자동차를 제어하는 방법을 학습합니다',
            difficulty: '고급',
            estimated_time: '25분'
        },
        {
            id: 'autonomous-driving',
            title: '자율주행 알고리즘',
            description: '센서 데이터를 활용한 자율주행 알고리즘 구현 방법을 학습합니다',
            difficulty: '고급',
            estimated_time: '30분'
        }
    ]
};

const tabList = [
    { id: 'editor', title: '에디터 사용하기', icon: 'fas fa-edit' },
    { id: 'findee', title: 'Findee 사용하기', icon: 'fas fa-robot' },
    { id: 'advanced', title: '고급 기능', icon: 'fas fa-rocket' }
];

let currentTab = 'editor';
let tutorialProgress = {};

// 튜토리얼 진행상황 로드
async function loadTutorialProgress() {
    try {
        const response = await fetch('/api/tutorial/progress');
        if (response.ok) {
            tutorialProgress = await response.json();
        } else {
            tutorialProgress = {};
        }
    } catch (error) {
        console.error('튜토리얼 진행상황 로드 실패:', error);
        tutorialProgress = {};
    }
}

// 튜토리얼 진행상황 저장
async function saveTutorialProgress(tutorialId, completed) {
    try {
        const response = await fetch('/api/tutorial/progress', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tutorial_id: tutorialId,
                completed: completed,
                completed_at: new Date().toISOString()
            })
        });
        
        if (response.ok) {
            // 로컬 상태 업데이트
            if (completed) {
                tutorialProgress[tutorialId] = {
                    completed: true,
                    completed_at: new Date().toISOString()
                };
            } else {
                delete tutorialProgress[tutorialId];
            }
            
            // UI 업데이트
            updateTutorialItemUI(tutorialId, completed);
        } else {
            showToast('진행상황 저장에 실패했습니다.', 'error');
        }
    } catch (error) {
        console.error('진행상황 저장 실패:', error);
        showToast('진행상황 저장 중 오류가 발생했습니다.', 'error');
    }
}

// 튜토리얼 항목 UI 업데이트
function updateTutorialItemUI(tutorialId, completed) {
    const tutorialItem = document.querySelector(`[data-tutorial-id="${tutorialId}"]`);
    if (tutorialItem) {
        if (completed) {
            tutorialItem.classList.add('completed');
            const statusElement = tutorialItem.querySelector('.completion-status');
            if (statusElement) {
                statusElement.textContent = '완료';
                statusElement.className = 'completion-status completed';
            }
            const startBtn = tutorialItem.querySelector('.tutorial-start-btn');
            if (startBtn) {
                startBtn.innerHTML = '<i class="fas fa-check"></i> 완료';
                startBtn.disabled = true;
                startBtn.style.opacity = '0.6';
                startBtn.style.cursor = 'default';
            }
        } else {
            tutorialItem.classList.remove('completed');
            const statusElement = tutorialItem.querySelector('.completion-status');
            if (statusElement) {
                statusElement.textContent = '미완료';
                statusElement.className = 'completion-status incomplete';
            }
            const startBtn = tutorialItem.querySelector('.tutorial-start-btn');
            if (startBtn) {
                startBtn.innerHTML = '<i class="fas fa-play"></i> 시작';
                startBtn.disabled = false;
                startBtn.style.opacity = '1';
                startBtn.style.cursor = 'pointer';
            }
        }
    }
}

function showTutorial() {
    // 기존 튜토리얼 창이 있으면 제거
    const existingTutorial = document.getElementById('tutorialWindow');
    if (existingTutorial) {
        existingTutorial.remove();
    }
    
    // 튜토리얼 진행상황 로드
    loadTutorialProgress().then(() => {
        // 튜토리얼 창 HTML 생성
        const tutorialHTML = `
            <div class="tutorial-overlay" id="tutorialOverlay">
                <div class="tutorial-window" id="tutorialWindow">
                    <div class="tutorial-header">
                        <h2><i class="fas fa-graduation-cap"></i> Path Finder Python Web Editor Tutorial</h2>
                        <button class="tutorial-close" id="tutorialCloseBtn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="tutorial-body">
                        <div class="tutorial-left">
                            <div class="tutorial-tabs">
                                ${tabList.map(tab => `
                                    <button class="tutorial-tab ${tab.id === currentTab ? 'active' : ''}" data-tab="${tab.id}">
                                        <i class="${tab.icon}"></i>
                                        <span>${tab.title}</span>
                                    </button>
                                `).join('')}
                            </div>
                            <div class="tutorial-content">
                                <div class="tutorial-list" id="tutorialList">
                                    ${generateTutorialItems(currentTab)}
                                </div>
                            </div>
                        </div>
                        <div class="tutorial-right">
                            <div class="tutorial-placeholder">
                                <i class="fas fa-arrow-left"></i>
                                <p>왼쪽에서 튜토리얼을 선택하세요</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // body에 튜토리얼 창 추가
        document.body.insertAdjacentHTML('beforeend', tutorialHTML);
        
        // 이벤트 바인딩
        document.getElementById('tutorialCloseBtn').addEventListener('click', closeTutorial);
        document.getElementById('tutorialOverlay').addEventListener('click', function(e) {
            if (e.target === this) {
                closeTutorial();
            }
        });
        
        // 탭 클릭 이벤트
        const tabButtons = document.querySelectorAll('.tutorial-tab');
        tabButtons.forEach(tab => {
            tab.addEventListener('click', function() {
                const tabId = this.getAttribute('data-tab');
                switchTab(tabId);
            });
        });
        
        // 튜토리얼 항목 클릭 이벤트
        bindTutorialItemEvents();
    });
}

function generateTutorialItems(tabId) {
    const items = tutorialList[tabId] || [];
    return items.map(item => {
        const isCompleted = tutorialProgress[item.id] && tutorialProgress[item.id].completed;
        return `
            <div class="tutorial-item ${isCompleted ? 'completed' : ''}" data-tutorial-id="${item.id}">
                <div class="tutorial-item-header">
                    <div class="tutorial-item-title">
                        <h3>${item.title}</h3>
                        <div class="tutorial-item-meta">
                            <span class="difficulty ${item.difficulty.toLowerCase()}">${item.difficulty}</span>
                            <span class="estimated-time">${item.estimated_time}</span>
                            <span class="completion-status ${isCompleted ? 'completed' : 'incomplete'}">
                                ${isCompleted ? '완료' : '미완료'}
                            </span>
                        </div>
                    </div>
                    <button class="tutorial-start-btn" data-tutorial-id="${item.id}" ${isCompleted ? 'disabled' : ''}>
                        <i class="fas fa-${isCompleted ? 'check' : 'play'}"></i> ${isCompleted ? '완료' : '시작'}
                    </button>
                </div>
                <p class="tutorial-item-description">${item.description}</p>
            </div>
        `;
    }).join('');
}

function switchTab(tabId) {
    currentTab = tabId;
    
    // 탭 활성화 상태 변경
    const tabButtons = document.querySelectorAll('.tutorial-tab');
    tabButtons.forEach(tab => {
        tab.classList.toggle('active', tab.getAttribute('data-tab') === tabId);
    });
    
    // 튜토리얼 목록 업데이트
    const tutorialListElement = document.getElementById('tutorialList');
    if (tutorialListElement) {
        tutorialListElement.innerHTML = generateTutorialItems(tabId);
        bindTutorialItemEvents();
    }
}

function bindTutorialItemEvents() {
    // 시작 버튼 클릭 이벤트
    const startButtons = document.querySelectorAll('.tutorial-start-btn');
    startButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const tutorialId = this.getAttribute('data-tutorial-id');
            startTutorial(tutorialId);
        });
    });
}

function startTutorial(tutorialId) {
    // 현재는 토스트로 알림만 표시하고 완료 상태로 변경
    const allTutorials = [...tutorialList.editor, ...tutorialList.findee, ...tutorialList.advanced];
    const tutorial = allTutorials.find(t => t.id === tutorialId);
    if (tutorial) {
        showToast(`"${tutorial.title}" 튜토리얼을 완료했습니다!`, 'success');
        
        // 완료 상태로 저장
        saveTutorialProgress(tutorialId, true);
    }
}

function closeTutorial() {
    const tutorialOverlay = document.getElementById('tutorialOverlay');
    if (tutorialOverlay) {
        tutorialOverlay.remove();
    }
}
