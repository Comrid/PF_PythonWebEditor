// First Screen Management
document.addEventListener('DOMContentLoaded', function() {
    // 시작 화면 버튼 이벤트 바인딩
    const startEditorBtn = document.getElementById('startEditorBtn');
    const tutorialBtn = document.getElementById('tutorialBtn');
    const firstScreenSettingsBtn = document.getElementById('firstScreenSettingsBtn');
    const trophyIcon = document.getElementById('trophyIcon');
    const settingsCloseBtn = document.getElementById('settingsCloseBtn');
    const resetDbBtn = document.getElementById('resetDbBtn');
    
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
        trophyIcon.addEventListener('click', showChallengeWindow);
    }
    if (settingsCloseBtn) {
        settingsCloseBtn.addEventListener('click', closeSettings);
    }
    if (resetDbBtn) {
        resetDbBtn.addEventListener('click', resetDatabase);
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
});

function startEditor() {
    // 에디터 페이지로 이동
    window.location.href = '/editor';
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
    // 설정 모달 표시
    const settingsOverlay = document.getElementById('settingsOverlay');
    if (settingsOverlay) {
        settingsOverlay.style.display = 'flex';
    }
}

function closeSettings() {
    const settingsOverlay = document.getElementById('settingsOverlay');
    if (settingsOverlay) {
        settingsOverlay.style.display = 'none';
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
    window.location.href = '/';
}
