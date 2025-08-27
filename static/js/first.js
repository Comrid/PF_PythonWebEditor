// First Screen Management
const initRefresh = true; // false: 새로고침 시 첫 화면 안뜸, true: 새로고침 시마다 첫 화면 뜸

document.addEventListener('DOMContentLoaded', function() {
    // initRefresh가 true이거나 첫 화면이 아직 표시되지 않았으면 첫 화면 표시
    if (initRefresh || !localStorage.getItem('firstScreenShown')) {
        showFirstScreen();
    }
    
    // 헤더 로고 클릭 이벤트 추가
    const headerLogo = document.getElementById('headerLogo');
    if (headerLogo) {
        headerLogo.addEventListener('click', returnToFirstScreen);
    }
});

function showFirstScreen() {
    // 첫 화면 HTML 생성
    const firstScreenHTML = `
        <div class="first-screen" id="firstScreen">
            <div class="first-screen-settings">
                <button class="settings-btn" id="firstScreenSettingsBtn" title="설정">
                    <i class="fas fa-cog"></i>
                </button>
            </div>
            <img src="/static/img/app-logo.png" alt="App Logo" class="first-screen-logo">
            <h1 class="first-screen-title">Pathfinder Python Web Editor</h1>
            <p class="first-screen-subtitle">라즈베리파이 기반 AI 자율주행 자동차 개발 환경</p>
            <p class="first-screen-description">
                이 에디터는 Findee 모듈을 통해 모터, 초음파 센서, 카메라를 제어할 수 있는<br>
                웹 기반 Python 개발 환경입니다. 브라우저에서 코드를 작성하고 실행하여<br>
                실시간으로 하드웨어를 제어하고 결과를 확인할 수 있습니다.
            </p>
            <div class="first-screen-buttons">
                <button class="first-screen-btn primary" id="startEditorBtn">
                    <i class="fas fa-play"></i> 에디터 사용하기
                </button>
                <button class="first-screen-btn secondary" id="tutorialBtn">
                    <i class="fas fa-graduation-cap"></i> 튜토리얼
                </button>
            </div>
            
            <!-- Trophy Icon for Challenges -->
            <div class="first-screen-trophy" id="trophyIcon" title="도전과제 보기">
                <button class="trophy-btn">
                    <i class="fas fa-trophy"></i>
                </button>
            </div>
        </div>
    `;
    
    // body에 첫 화면 추가
    document.body.insertAdjacentHTML('afterbegin', firstScreenHTML);
    
    // 버튼 이벤트 바인딩
    document.getElementById('startEditorBtn').addEventListener('click', startEditor);
    document.getElementById('tutorialBtn').addEventListener('click', showTutorial);
    document.getElementById('firstScreenSettingsBtn').addEventListener('click', showSettings);
    document.getElementById('trophyIcon').addEventListener('click', showChallengeWindow);
}

function startEditor() {
    // 첫 화면 숨기기
    const firstScreen = document.getElementById('firstScreen');
    if (firstScreen) {
        firstScreen.classList.add('hidden');
        // 첫 화면을 표시했다고 기록
        localStorage.setItem('firstScreenShown', 'true');
    }
}

function showTutorial() {
    // 튜토리얼 내용을 토스트로 표시
    showToast('튜토리얼 기능은 준비 중입니다. 에디터 사용하기 버튼을 눌러 에디터를 시작하세요.', 'info');
    
    // 튜토리얼 버튼 비활성화
    const tutorialBtn = document.getElementById('tutorialBtn');
    if (tutorialBtn) {
        tutorialBtn.disabled = true;
        tutorialBtn.style.opacity = '0.5';
        tutorialBtn.style.cursor = 'not-allowed';
    }
}

function showSettings() {
    // 기존 설정 모달이 있으면 제거
    const existingSettings = document.getElementById('settingsOverlay');
    if (existingSettings) {
        existingSettings.remove();
    }
    
    // 설정 모달 HTML 생성
    const settingsHTML = `
        <div class="settings-overlay" id="settingsOverlay">
            <div class="settings-modal" id="settingsModal">
                <div class="settings-header">
                    <h2><i class="fas fa-cog"></i> 설정</h2>
                    <button class="settings-close" id="settingsCloseBtn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="settings-content">
                    <div class="settings-section">
                        <h3><i class="fas fa-database"></i> 데이터베이스 관리</h3>
                        <button class="reset-db-btn" id="resetDbBtn">
                            <i class="fas fa-trash"></i> 완전 초기화
                        </button>
                        <p style="color: rgba(255, 255, 255, 0.6); font-size: 0.9rem; margin-top: 10px; text-align: center;">
                            모든 튜토리얼 진행상황을 초기화합니다
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // body에 설정 모달 추가
    document.body.insertAdjacentHTML('beforeend', settingsHTML);
    
    // 이벤트 바인딩
    document.getElementById('settingsCloseBtn').addEventListener('click', closeSettings);
    document.getElementById('resetDbBtn').addEventListener('click', resetDatabase);
    
    // 배경 클릭으로 닫기
    document.getElementById('settingsOverlay').addEventListener('click', function(e) {
        if (e.target === this) {
            closeSettings();
        }
    });
    
    // ESC 키로 닫기
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeSettings();
        }
    });
}

function closeSettings() {
    const settingsOverlay = document.getElementById('settingsOverlay');
    if (settingsOverlay) {
        settingsOverlay.remove();
    }
}

async function resetDatabase() {
    if (!confirm('정말로 모든 튜토리얼 진행상황을 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
        return;
    }
    
    const resetBtn = document.getElementById('resetDbBtn');
    if (resetBtn) {
        resetBtn.disabled = true;
        resetBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 초기화 중...';
    }
    
    try {
        const response = await fetch('/api/tutorial/reset', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            showToast('데이터베이스가 성공적으로 초기화되었습니다.', 'success');
            closeSettings();
        } else {
            const error = await response.json();
            showToast(`초기화 실패: ${error.error}`, 'error');
        }
    } catch (error) {
        console.error('데이터베이스 초기화 실패:', error);
        showToast('데이터베이스 초기화 중 오류가 발생했습니다.', 'error');
    } finally {
        if (resetBtn) {
            resetBtn.disabled = false;
            resetBtn.innerHTML = '<i class="fas fa-trash"></i> 완전 초기화';
        }
    }
}

// 첫 화면으로 돌아가기
function returnToFirstScreen() {
    // 첫 화면이 숨겨져 있으면 다시 표시
    const firstScreen = document.getElementById('firstScreen');
    if (firstScreen && firstScreen.classList.contains('hidden')) {
        firstScreen.classList.remove('hidden');
    } else if (!firstScreen) {
        // 첫 화면이 없으면 새로 생성
        showFirstScreen();
    }
}
