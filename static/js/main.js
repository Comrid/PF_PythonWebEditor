// Main Screen Management
let selectedRobot = null;
let robotList = [];

document.addEventListener('DOMContentLoaded', function() {
    // 사용자 정보 확인
    if (window.currentUser) {
        console.log('현재 로그인한 사용자:', window.currentUser);
    } else {
        console.warn('사용자 정보를 찾을 수 없습니다.');
    }

    // 페이지 이동 버튼
    const editorBtn = document.getElementById('editorBtn');
    if (editorBtn) {editorBtn.addEventListener('click', redirectEditor);}
    const tutorialBtn = document.getElementById('tutorialBtn');
    if (tutorialBtn) {tutorialBtn.addEventListener('click', redirectTutorial);}

    // 설정 버튼
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {settingsBtn.addEventListener('click', () => handleSettings('show'));}
    const settingsCloseBtn = document.getElementById('settingsCloseBtn');
    if (settingsCloseBtn) {settingsCloseBtn.addEventListener('click', () => handleSettings('close'));}
    const settingsOverlay = document.getElementById('settingsOverlay');
    if (settingsOverlay) {
        settingsOverlay.addEventListener('click', function(e) {
            if (e.target === this){
                handleSettings('close');
            }
        });
    }
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape'){
            handleSettings('close');
        }
    });
    const resetDbBtn = document.getElementById('resetDbBtn');
    if (resetDbBtn) {resetDbBtn.addEventListener('click', resetDatabase);}

    // 도전과제 버튼
    const challengeBtn = document.getElementById('challengeBtn');
    if(challengeBtn) {challengeBtn.addEventListener('click', showChallenge);}

    // 로그아웃 버튼
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {logoutBtn.addEventListener('click', logout);}



    

    const robotSelect = document.getElementById('robotSelect');
    
    const assignRobotBtn = document.getElementById('assignRobotBtn');



    const connectRobotBtn = document.getElementById('connectRobotBtn');
    if (connectRobotBtn) {connectRobotBtn.addEventListener('click', connectRobot);}



    const robotNameInput = document.getElementById('robotNameInput');






    
    if (robotSelect) {
        robotSelect.addEventListener('change', handleRobotSelection);
    }
    
    if (assignRobotBtn) {
        assignRobotBtn.addEventListener('click', assignRobot);
    }
    
    if (robotNameInput) {
        robotNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {connectRobot();}
        });
    }




    // 로봇 목록 로드
    loadRobotList();

    // 주기적으로 로봇 상태 업데이트
    setInterval(refreshRobotStatus, 5000);

    // 페이지 로드 시 에디터 버튼 비활성화
    updateStartButton();
});

function redirectEditor() {window.location.href = '/editor';}
function redirectTutorial() {window.location.href = '/tutorial';}
function handleSettings(action) {
    const settingsOverlay = document.getElementById('settingsOverlay');
    if (action === 'show')
        settingsOverlay.classList.add('show');
    else if (action === 'close')
        settingsOverlay.classList.remove('show');
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
            handleSettings('close');
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


// 로봇 목록 로드
async function loadRobotList() {
    try {
        const response = await fetch('/api/robots');
        if (response.ok) {
            robotList = await response.json();
            updateRobotDropdown();

            // 할당되지 않은 로봇이 있는지 확인
            await checkUnassignedRobots();
        } else {
            console.error('로봇 목록 로드 실패:', response.status);
            showToast('로봇 목록을 불러올 수 없습니다.', 'error');
        }
    } catch (error) {
        console.error('로봇 목록 로드 오류:', error);
        showToast('로봇 목록을 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

// 할당되지 않은 로봇 확인
async function checkUnassignedRobots() {
    try {
        // 등록된 모든 로봇 목록 조회 (할당 여부 무관)
        const response = await fetch('/api/robots');
        if (response.ok) {
            const allRobots = await response.json();
            const assignedRobotIds = robotList.map(robot => robot.robot_id);
            const unassignedRobots = allRobots.filter(robot => !assignedRobotIds.includes(robot.robot_id));

            if (unassignedRobots.length > 0) {
                showUnassignedRobotPrompt(unassignedRobots[0]); // 첫 번째 할당되지 않은 로봇 표시
            }
        }
    } catch (error) {
        console.error('할당되지 않은 로봇 확인 오류:', error);
    }
}

// 할당되지 않은 로봇 프롬프트 표시
function showUnassignedRobotPrompt(robot) {
    const robotAssign = document.getElementById('robotAssign');
    const selectedRobotName = document.getElementById('selectedRobotName');

    if (robotAssign && selectedRobotName) {
        selectedRobotName.textContent = robot.name;
        robotAssign.style.display = 'block';

        // 로봇 정보 업데이트
        const robotInfo = document.getElementById('robotInfo');
        if (robotInfo) {
            robotInfo.style.display = 'block';
        }

        showToast(`새로운 로봇 '${robot.name}'이 발견되었습니다. 할당하시겠습니까?`, 'info');
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

    // 로봇 목록 추가 (할당 여부와 관계없이 모든 로봇 표시)
    robotList.forEach(robot => {
        const option = document.createElement('option');
        option.value = robot.robot_id;
        const status = robot.online ? '온라인' : '오프라인';
        const assigned = robot.assigned ? ' (할당됨)' : ' (미할당)';
        option.textContent = `${robot.name} (${status})${assigned}`;
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
            const result = await response.json();
            showToast(result.message || '로봇이 성공적으로 할당되었습니다.', 'success');

            // 할당 완료 후 로봇 목록 새로고침
            await loadRobotList();

            // 할당된 로봇을 자동으로 선택
            const assignedRobot = robotList.find(robot => robot.robot_id === robotId);
            if (assignedRobot) {
                selectedRobot = assignedRobot;
                updateRobotStatus();
                updateStartButton();
            }

            // 할당 UI 숨기기 (존재하는 경우)
            const robotAssignEl = document.getElementById('robotAssign');
            if (robotAssignEl) {
                robotAssignEl.style.display = 'none';
            }
        } else {
            const error = await response.json();
            console.error('로봇 할당 실패:', response.status, error);
            showToast(error.error || '로봇 할당에 실패했습니다.', 'error');
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
        const status = selectedRobot.online ? '온라인' : '오프라인';
        const assigned = selectedRobot.assigned ? ' (할당됨)' : ' (미할당)';
        statusText.textContent = `${selectedRobot.name} - ${status}${assigned}`;
    }

    // 로봇 정보 표시
    if (robotInfo && selectedRobotName && selectedRobotDetails) {
        robotInfo.style.display = 'block';
        selectedRobotName.textContent = selectedRobot.name;
        selectedRobotDetails.innerHTML = `
            <div><strong>로봇 ID:</strong> ${selectedRobot.robot_id}</div>
            <div><strong>상태:</strong> ${selectedRobot.online ? '온라인' : '오프라인'}</div>
            <div><strong>할당 상태:</strong> ${selectedRobot.assigned ? '할당됨' : '미할당'}</div>
            <div><strong>하드웨어:</strong> ${selectedRobot.hardware_enabled ? '활성화' : '비활성화'}</div>
            <div><strong>마지막 연결:</strong> ${selectedRobot.last_seen ? new Date(selectedRobot.last_seen).toLocaleString() : '알 수 없음'}</div>
        `;
    }
}

// 시작 버튼 상태 업데이트
function updateStartButton() {
    const editorBtn = document.getElementById('editorBtn');
    if (!editorBtn) return;

    if (selectedRobot && selectedRobot.online && selectedRobot.assigned) {
        editorBtn.disabled = false;
        editorBtn.style.opacity = '1';
        editorBtn.style.cursor = 'pointer';
    } else {
        editorBtn.disabled = true;
        editorBtn.style.opacity = '0.5';
        editorBtn.style.cursor = 'not-allowed';
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

// 로봇 연동
async function connectRobot() {
    const robotName = robotNameInput.value.trim();
    if (!robotName) {
        //showConnectStatus('로봇 이름을 입력해주세요.', 'error');
        showToast('로봇 이름을 입력해주세요.', 'error');
        return;
    }

    // 버튼 비활성화
    const connectRobotBtn = document.getElementById('connectRobotBtn');
    connectRobotBtn.disabled = true;
    connectRobotBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 연동 중...';

    try {
        const response = await fetch('/api/robot/assign', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ robot_name: robotName })
        });

        const result = await response.json();

        if (response.ok) {
            //showConnectStatus(result.message, 'success');
            showToast(result.message, 'success');
            // 연동 완료 후 로봇 목록 새로고침
            setTimeout(() => {
                loadRobotList();
                // 입력 필드 초기화
                robotNameInput.value = '';
                // 연동된 로봇을 자동으로 선택
                const connectedRobot = robotList.find(robot => robot.name === robotName);
                if (connectedRobot) {
                    selectedRobot = connectedRobot;
                    updateRobotStatus();
                    updateStartButton();
                }
            }, 1000);
        } else {
            //showConnectStatus(result.error, 'error');
            showToast(result.error, 'error');
        }
    } catch (error) {
        console.error('로봇 연동 오류:', error);
        //showConnectStatus('로봇 연동 중 오류가 발생했습니다.', 'error');
        showToast('로봇 연동 중 오류가 발생했습니다.', 'error');
    } finally {
        // 버튼 활성화
        connectRobotBtn.disabled = false;
        connectRobotBtn.innerHTML = '<i class="fas fa-link"></i> 로봇 연동하기';
    }
}

// 연결 상태 표시
function showConnectStatus(message, type) {
    const statusEl = document.getElementById('connectStatus');
    statusEl.textContent = message;
    statusEl.className = `connect-status ${type}`;
    statusEl.style.display = 'block';

    // 3초 후 상태 메시지 숨기기
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 3000);
}

// showConnectStatus : message를 표시하고 3초 뒤에 숨김.