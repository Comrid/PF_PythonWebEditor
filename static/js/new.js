// AI Chat Button and Popover Management
document.addEventListener('DOMContentLoaded', function() {
    initializeAiChat();
});

function initializeAiChat() {
    const aiChatButton = document.getElementById('aiChatButton');
    const aiChatPopover = document.getElementById('aiChatPopover');
    const aiChatClose = document.getElementById('aiChatClose');
    const closeAiChatPopover = document.getElementById('closeAiChatPopover');
    
    if (!aiChatButton || !aiChatPopover) return;
    
    let isPopoverOpen = false;
    
    // AI Chat 버튼 클릭 이벤트
    aiChatButton.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        if (isPopoverOpen) {
            // Popover가 열려있으면 닫기
            hideAiChatPopover();
        } else {
            // Popover가 닫혀있으면 열기
            showAiChatPopover();
        }
    });
    
    // X 표시 클릭 이벤트 (popover 닫기)
    if (aiChatClose) {
        aiChatClose.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            hideAiChatPopover();
        });
    }
    
    // Popover 닫기 버튼 클릭 이벤트
    if (closeAiChatPopover) {
        closeAiChatPopover.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            hideAiChatPopover();
        });
    }
    
    // Popover 표시 함수
    function showAiChatPopover() {
        aiChatPopover.classList.add('show');
        aiChatButton.classList.add('active');
        isPopoverOpen = true;
        
        // 애니메이션 효과
        aiChatPopover.style.opacity = '0';
        aiChatPopover.style.transform = 'translateY(20px) scale(0.95)';
        
        setTimeout(() => {
            aiChatPopover.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            aiChatPopover.style.opacity = '1';
            aiChatPopover.style.transform = 'translateY(0) scale(1)';
        }, 10);
    }
    
    // Popover 숨기기 함수
    function hideAiChatPopover() {
        aiChatPopover.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
        aiChatPopover.style.opacity = '0';
        aiChatPopover.style.transform = 'translateY(20px) scale(0.95)';
        
        setTimeout(() => {
            aiChatPopover.classList.remove('show');
            aiChatButton.classList.remove('active');
            isPopoverOpen = false;
            
            // 트랜지션 초기화
            aiChatPopover.style.transition = '';
            aiChatPopover.style.opacity = '';
            aiChatPopover.style.transform = '';
        }, 200);
    }
    
    // ESC 키로 popover 닫기
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && isPopoverOpen) {
            hideAiChatPopover();
        }
    });
    
    // 윈도우 리사이즈 시 popover 위치 조정
    window.addEventListener('resize', function() {
        if (isPopoverOpen) {
            // popover가 열려있을 때만 위치 조정
            // 현재는 CSS로 처리되므로 추가 로직 불필요
        }
    });
}
