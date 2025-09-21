// First Screen Management
let selectedRobot = null;
let robotList = [];

document.addEventListener('DOMContentLoaded', function() {
    // 시작 화면 버튼 이벤트 바인딩
    const startEditorBtn = document.getElementById('startEditorBtn');
    const tutorialBtn = document.getElementById('tutorialBtn');
    const firstScreenSettingsBtn = document.getElementById('firstScreenSettingsBtn');
    const trophyIcon = document.getElementById('trophyIcon');
    const settingsCloseBtn = document.getElementById('settingsCloseBtn');
    const resetDbBtn = document.getElementById('resetDbBtn');
    const robotSelect = document.getElementById('robotSelect');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (startEditorBtn) {
        startEditorBtn.addEventListener('click', startEditor);
    }
    if (tutorialBtn) {
        tutorialBtn.addEventListener('click', showTutorial);
    }
    if (firstScreenSettingsBtn) {
        firstScreenSettingsBtn.addEventListener('click', showSettings);
    }
    if (trophyIcon) {
        trophyIcon.addEventListener('click', function() {
            if (typeof showChallengeWindow === 'function') {
                showChallengeWindow();
            } else {
                console.error('showChallengeWindow function not found');
            }
        });
    }
    if (settingsCloseBtn) {
        settingsCloseBtn.addEventListener('click', closeSettings);
    }
    if (resetDbBtn) {
        resetDbBtn.addEventListener('click', resetDatabase);
    }
    if (robotSelect) {
        robotSelect.addEventListener('change', handleRobotSelection);
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // 배경 클릭으로 설정 모달 닫기
    const settingsOverlay = document.getElementById('settingsOverlay');
    if (settingsOverlay) {
        settingsOverlay.addEventListener('click', function(e) {
            if (e.target === this) {
                closeSettings();
            }
        });
    }
    
    // ESC 키로 설정 모달 닫기
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeSettings();
        }
    });
    
    // 로봇 목록 로드
    loadRobotList();
    
    // 주기적으로 로봇 상태 업데이트
    setInterval(refreshRobotStatus, 5000);
});

function startEditor() {
    // 에디터 페이지로 이동
    window.location.href = '/editor';
}

function showTutorial() {
    // 튜토리얼 페이지로 이동
    window.location.href = '/tutorial';
}

function showSettings() {
    // 설정 모달 표시
    const settingsOverlay = document.getElementById('settingsOverlay');
    if (settingsOverlay) {
        settingsOverlay.classList.add('show');
    }
}

function closeSettings() {
    const settingsOverlay = document.getElementById('settingsOverlay');
    if (settingsOverlay) {
        settingsOverlay.classList.remove('show');
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
            if (typeof showToast === 'function') {
                showToast('데이터베이스가 성공적으로 초기화되었습니다.', 'success');
            } else {
                alert('데이터베이스가 성공적으로 초기화되었습니다.');
            }
            closeSettings();
        } else {
            const error = await response.json();
            if (typeof showToast === 'function') {
                showToast(`초기화 실패: ${error.error}`, 'error');
            } else {
                alert(`초기화 실패: ${error.error}`);
            }
        }
    } catch (error) {
        console.error('데이터베이스 초기화 실패:', error);
        if (typeof showToast === 'function') {
            showToast('데이터베이스 초기화 중 오류가 발생했습니다.', 'error');
        } else {
            alert('데이터베이스 초기화 중 오류가 발생했습니다.');
        }
    } finally {
        if (resetBtn) {
            resetBtn.disabled = false;
            resetBtn.innerHTML = '<i class="fas fa-trash"></i> 완전 초기화';
        }
    }
}

// 첫 화면으로 돌아가기
function returnToFirstScreen() {
    window.location.href = '/';
}

// 로그아웃
async function logout() {
    if (!confirm('로그아웃하시겠습니까?')) {
        return;
    }
    
    try {
        const response = await fetch('/logout', {
            method: 'GET'
        });
        
        if (response.ok) {
            showToast('로그아웃되었습니다.', 'success');
            setTimeout(() => {
                window.location.href = '/login';
            }, 1000);
        } else {
            showToast('로그아웃에 실패했습니다.', 'error');
        }
    } catch (error) {
        console.error('로그아웃 오류:', error);
        showToast('로그아웃 중 오류가 발생했습니다.', 'error');
    }
}

// 로봇 목록 로드
async function loadRobotList() {
    try {
        const response = await fetch('/api/robots');
        if (response.ok) {
            robotList = await response.json();
            updateRobotDropdown();
        } else {
            console.error('로봇 목록 로드 실패:', response.status);
            showToast('로봇 목록을 불러올 수 없습니다.', 'error');
        }
    } catch (error) {
        console.error('로봇 목록 로드 오류:', error);
        showToast('로봇 목록을 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

// 로봇 드롭다운 업데이트
function updateRobotDropdown() {
    const robotSelect = document.getElementById('robotSelect');
    if (!robotSelect) return;
    
    // 기존 옵션 제거 (첫 번째 옵션 제외)
    while (robotSelect.children.length > 1) {
        robotSelect.removeChild(robotSelect.lastChild);
    }
    
    // 로봇 목록 추가
    robotList.forEach(robot => {
        const option = document.createElement('option');
        option.value = robot.robot_id;
        option.textContent = `${robot.name} (${robot.online ? '온라인' : '오프라인'})`;
        robotSelect.appendChild(option);
    });
    
    // 선택된 로봇이 있으면 상태 업데이트
    if (selectedRobot) {
        updateRobotStatus();
    }
}

// 로봇 선택 처리
function handleRobotSelection(event) {
    const robotId = event.target.value;
    
    if (!robotId) {
        selectedRobot = null;
        updateRobotStatus();
        updateStartButton();
        return;
    }
    
    // 선택된 로봇 정보 찾기
    selectedRobot = robotList.find(robot => robot.robot_id === robotId);
    
    if (selectedRobot) {
        // 로봇 할당 요청
        assignRobot(robotId);
        updateRobotStatus();
        updateStartButton();
    }
}

// 로봇 할당
async function assignRobot(robotId) {
    try {
        const response = await fetch(`/api/robots/${robotId}/assign`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            showToast('로봇이 성공적으로 할당되었습니다.', 'success');
        } else {
            console.error('로봇 할당 실패:', response.status);
            showToast('로봇 할당에 실패했습니다.', 'error');
        }
    } catch (error) {
        console.error('로봇 할당 오류:', error);
        showToast('로봇 할당 중 오류가 발생했습니다.', 'error');
    }
}

// 로봇 상태 업데이트
function updateRobotStatus() {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const robotInfo = document.getElementById('robotInfo');
    const selectedRobotName = document.getElementById('selectedRobotName');
    const selectedRobotDetails = document.getElementById('selectedRobotDetails');
    
    if (!selectedRobot) {
        if (statusIndicator) {
            statusIndicator.className = 'status-indicator offline';
        }
        if (statusText) {
            statusText.textContent = '로봇을 선택하세요';
        }
        if (robotInfo) {
            robotInfo.style.display = 'none';
        }
        return;
    }
    
    // 상태 표시기 업데이트
    if (statusIndicator) {
        if (selectedRobot.online) {
            statusIndicator.className = 'status-indicator online';
        } else {
            statusIndicator.className = 'status-indicator offline';
        }
    }
    
    // 상태 텍스트 업데이트
    if (statusText) {
        if (selectedRobot.online) {
            statusText.textContent = `${selectedRobot.name} - 온라인`;
        } else {
            statusText.textContent = `${selectedRobot.name} - 오프라인`;
        }
    }
    
    // 로봇 정보 표시
    if (robotInfo && selectedRobotName && selectedRobotDetails) {
        robotInfo.style.display = 'block';
        selectedRobotName.textContent = selectedRobot.name;
        selectedRobotDetails.innerHTML = `
            <div><strong>로봇 ID:</strong> ${selectedRobot.robot_id}</div>
            <div><strong>상태:</strong> ${selectedRobot.online ? '온라인' : '오프라인'}</div>
            <div><strong>마지막 연결:</strong> ${selectedRobot.last_seen ? new Date(selectedRobot.last_seen).toLocaleString() : '알 수 없음'}</div>
        `;
    }
}

// 시작 버튼 상태 업데이트
function updateStartButton() {
    const startEditorBtn = document.getElementById('startEditorBtn');
    if (!startEditorBtn) return;
    
    if (selectedRobot && selectedRobot.online) {
        startEditorBtn.disabled = false;
        startEditorBtn.style.opacity = '1';
        startEditorBtn.style.cursor = 'pointer';
    } else {
        startEditorBtn.disabled = true;
        startEditorBtn.style.opacity = '0.5';
        startEditorBtn.style.cursor = 'not-allowed';
    }
}

// 주기적 로봇 상태 업데이트
async function refreshRobotStatus() {
    if (!selectedRobot) return;
    
    try {
        const response = await fetch('/api/robots');
        if (response.ok) {
            const updatedRobotList = await response.json();
            const updatedRobot = updatedRobotList.find(robot => robot.robot_id === selectedRobot.robot_id);
            
            if (updatedRobot) {
                selectedRobot = updatedRobot;
                updateRobotStatus();
                updateStartButton();
            }
        }
    } catch (error) {
        console.error('로봇 상태 업데이트 오류:', error);
    }
}
