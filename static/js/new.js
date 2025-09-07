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
    let chatHistory = [];
    let aiChatConversationHistory = []; // AI-Chat 전용 대화 히스토리
    
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
        
        // 채팅 UI 초기화
        initializeChatUI();
        
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
    
    // 채팅 UI 초기화
    function initializeChatUI() {
        const popoverBody = aiChatPopover.querySelector('.popover-body');
        if (!popoverBody) return;
        
        // 기존 내용 제거
        popoverBody.innerHTML = '';
        
        // 채팅 메시지 컨테이너
        const messagesContainer = document.createElement('div');
        messagesContainer.className = 'ai-chat-messages';
        messagesContainer.id = 'aiChatMessages';
        
        // 입력 컨테이너
        const inputContainer = document.createElement('div');
        inputContainer.className = 'ai-chat-input-container';
        
        const input = document.createElement('textarea');
        input.className = 'ai-chat-input';
        input.placeholder = 'AI에게 질문하세요...';
        input.id = 'aiChatInput';
        
        const sendBtn = document.createElement('button');
        sendBtn.className = 'ai-chat-send-btn';
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
        sendBtn.id = 'aiChatSendBtn';
        
        const newChatBtn = document.createElement('button');
        newChatBtn.className = 'ai-chat-new-btn';
        newChatBtn.innerHTML = '<i class="fas fa-plus"></i>';
        newChatBtn.id = 'aiChatNewBtn';
        newChatBtn.title = '새 채팅';
        
        inputContainer.appendChild(input);
        inputContainer.appendChild(newChatBtn);
        inputContainer.appendChild(sendBtn);
        
        popoverBody.appendChild(messagesContainer);
        popoverBody.appendChild(inputContainer);
        
        // 이벤트 바인딩
        bindChatEvents();
        
        // 채팅 히스토리 표시
        displayChatHistory();
    }
    
    // 채팅 이벤트 바인딩
    function bindChatEvents() {
        const input = document.getElementById('aiChatInput');
        const sendBtn = document.getElementById('aiChatSendBtn');
        const newChatBtn = document.getElementById('aiChatNewBtn');
        
        if (!input || !sendBtn) return;
        
        // 전송 버튼 클릭
        sendBtn.addEventListener('click', sendMessage);
        
        // 새 채팅 버튼 클릭
        if (newChatBtn) {
            newChatBtn.addEventListener('click', startNewChat);
        }
        
        // Enter 키로 전송 (Shift+Enter는 줄바꿈)
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // 입력창 자동 높이 조정
        input.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
    }
    
    // 메시지 전송
    function sendMessage() {
        const input = document.getElementById('aiChatInput');
        const sendBtn = document.getElementById('aiChatSendBtn');
        const messagesContainer = document.getElementById('aiChatMessages');
        
        if (!input || !sendBtn || !messagesContainer) return;
        
        const message = input.value.trim();
        if (!message) return;
        
        // 사용자 메시지 추가
        addMessage('user', message);
        
        // 입력창 초기화
        input.value = '';
        input.style.height = 'auto';
        
        // 전송 버튼 비활성화
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        // AI 응답 요청
        requestAiResponse(message);
    }
    
    // 메시지 추가
    function addMessage(type, content, isLoading = false) {
        const messagesContainer = document.getElementById('aiChatMessages');
        if (!messagesContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ${type}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'ai-message-content';
        
        if (isLoading) {
            contentDiv.innerHTML = `
                <div class="ai-chat-loading">
                    <span>AI가 답변을 생성하고 있습니다</span>
                    <div class="ai-chat-loading-dots">
                        <div class="ai-chat-loading-dot"></div>
                        <div class="ai-chat-loading-dot"></div>
                        <div class="ai-chat-loading-dot"></div>
                    </div>
                </div>
            `;
        } else {
            contentDiv.textContent = content;
        }
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'ai-message-time';
        timeDiv.textContent = new Date().toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(timeDiv);
        messagesContainer.appendChild(messageDiv);
        
        // 스크롤을 맨 아래로
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // 채팅 히스토리에 저장
        if (!isLoading) {
            chatHistory.push({ type, content, timestamp: new Date() });
        }
    }
    
    // AI-Chat 전용 히스토리 관리 함수들
    function addToAiChatHistory(role, content) {
        aiChatConversationHistory.push({ role, content });
        
        // 히스토리 길이 제한 (최근 20개 대화만 유지)
        if (aiChatConversationHistory.length > 20) {
            aiChatConversationHistory = aiChatConversationHistory.slice(-20);
        }
    }
    
    function clearAiChatHistory() {
        aiChatConversationHistory = [];
    }
    
    function buildAiChatPrompt(question) {
        let prompt = '당신은 Path Finder Python Web Editor의 AI Assistant입니다.\n라즈베리파이 제로 2 W + Findee 모듈로 자율주행 자동차 개발을 도와드립니다.\n\n답변 규칙:\n- 한국어로 간결하게 답변 (3-5줄 이내)\n- 코드 예시는 핵심 부분만 포함\n- try-except-finally 구조 사용\n- 불필요한 설명 생략';
        
        if (aiChatConversationHistory.length > 0) {
            prompt += '\n\n이전 대화:\n';
            aiChatConversationHistory.forEach(msg => {
                prompt += `${msg.role}: ${msg.content}\n`;
            });
        }
        
        prompt += `\n\n사용자 질문: ${question}`;
        return prompt;
    }
    
    // AI-Chat 전용 API 호출 함수
    async function callAiChatAPI(question, callback) {
        const currentApiKey = window.GEMINI_API_KEY;
        if (!currentApiKey) {
            throw new Error('Gemini API 키가 설정되지 않았습니다.');
        }
        
        const fullPrompt = buildAiChatPrompt(question);
        
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': currentApiKey
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: fullPrompt }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 20,
                    topP: 0.9,
                    maxOutputTokens: 1000,
                    thinkingConfig: {
                        thinkingBudget: 0
                    }
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const answer = data.candidates[0].content.parts?.[0]?.text || '';
            
            // AI-Chat 히스토리에 추가
            addToAiChatHistory('user', question);
            addToAiChatHistory('assistant', answer);
            
            // 스트리밍 흉내: 단어 단위로 갱신
            let currentText = '';
            const words = answer.split(' ');
            
            for (let i = 0; i < words.length; i++) {
                currentText += words[i] + ' ';
                callback(currentText.trim(), false);
                await new Promise(resolve => setTimeout(resolve, 20));
            }
            
            callback(answer, true);
        } else {
            throw new Error('API 응답 형식이 올바르지 않습니다.');
        }
    }

    // AI 응답 요청
    async function requestAiResponse(message) {
        try {
            // 로딩 메시지 추가
            addMessage('assistant', '', true);
            
            // AI-Chat 전용 API 호출
            if (window.getLlmStatus && window.getLlmStatus().loaded) {
                await callAiChatAPI(message, (response, isComplete) => {
                    // 로딩 메시지 제거 (첫 번째 응답 시)
                    if (isComplete) {
                        const messagesContainer = document.getElementById('aiChatMessages');
                        const loadingMessage = messagesContainer.querySelector('.ai-message.assistant:last-child');
                        if (loadingMessage) {
                            loadingMessage.remove();
                        }
                        // 최종 응답 추가
                        addMessage('assistant', response);
                    } else {
                        // 스트리밍 응답 업데이트
                        updateStreamingMessage(response);
                    }
                });
            } else {
                // LLM이 로드되지 않은 경우 시뮬레이션 응답
                const messagesContainer = document.getElementById('aiChatMessages');
                const loadingMessage = messagesContainer.querySelector('.ai-message.assistant:last-child');
                if (loadingMessage) {
                    loadingMessage.remove();
                }
                
                const fallbackResponse = await simulateAiResponse(message);
                addMessage('assistant', fallbackResponse);
            }
            
        } catch (error) {
            console.error('AI 응답 오류:', error);
            
            // 로딩 메시지 제거
            const messagesContainer = document.getElementById('aiChatMessages');
            const loadingMessage = messagesContainer.querySelector('.ai-message.assistant:last-child');
            if (loadingMessage) {
                loadingMessage.remove();
            }
            
            // 오류 시 시뮬레이션 응답
            try {
                const fallbackResponse = await simulateAiResponse(message);
                addMessage('assistant', fallbackResponse);
            } catch (fallbackError) {
                addMessage('assistant', '죄송합니다. AI 응답을 생성하는 중 오류가 발생했습니다. 다시 시도해주세요.');
            }
        } finally {
            // 전송 버튼 활성화
            const sendBtn = document.getElementById('aiChatSendBtn');
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            }
        }
    }
    
    // 스트리밍 메시지 업데이트
    function updateStreamingMessage(text) {
        const messagesContainer = document.getElementById('aiChatMessages');
        const lastMessage = messagesContainer.querySelector('.ai-message.assistant:last-child');
        
        if (lastMessage) {
            const contentDiv = lastMessage.querySelector('.ai-message-content');
            if (contentDiv) {
                contentDiv.textContent = text;
            }
    } else {
            // 첫 번째 스트리밍 응답인 경우 새 메시지 생성
            addMessage('assistant', text);
        }
    }
    
    // AI 응답 시뮬레이션 (API 사용 불가능한 경우)
    async function simulateAiResponse(message) {
        const responses = [
            `안녕하세요! "${message}"에 대한 질문을 받았습니다. Path Finder Python Web Editor와 관련된 도움이 필요하시면 언제든 말씀해주세요!`,
            `좋은 질문이네요! "${message}"에 대해 설명드리겠습니다. Findee 모듈을 사용한 자율주행 자동차 개발에 도움이 되도록 최선을 다하겠습니다.`,
            `"${message}"에 대한 답변을 준비했습니다. 라즈베리파이 제로 2 W와 Findee 모듈을 활용한 프로젝트에 대해 더 자세히 알고 싶으시면 언제든 물어보세요!`,
            `흥미로운 질문입니다! "${message}"에 대해 Path Finder Python Web Editor의 기능을 활용하여 해결할 수 있는 방법을 제안드리겠습니다.`,
            `"${message}"에 대한 답변을 드리겠습니다. AI Assistant로서 여러분의 프로젝트 성공을 위해 최선을 다하겠습니다!`
        ];
        
        // 랜덤한 응답 선택
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        
        // 응답 지연 시뮬레이션
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        
        return randomResponse;
    }
    
    // 새 채팅 시작
    function startNewChat() {
        // 로컬 채팅 히스토리 초기화
        chatHistory = [];
        
        // AI-Chat 전용 히스토리 초기화
        clearAiChatHistory();
        
        // 메시지 컨테이너 초기화
        const messagesContainer = document.getElementById('aiChatMessages');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
            
            // 환영 메시지 표시
            const welcomeDiv = document.createElement('div');
            welcomeDiv.className = 'ai-chat-placeholder';
            welcomeDiv.innerHTML = `
                <i class="fas fa-robot"></i>
                <p>새로운 대화를 시작합니다!</p>
            `;
            messagesContainer.appendChild(welcomeDiv);
        }
        
        // 입력창 초기화
        const input = document.getElementById('aiChatInput');
        if (input) {
            input.value = '';
            input.style.height = 'auto';
            input.focus();
        }
        
        showToast('새 채팅을 시작했습니다!', 'success');
    }
    
    // 채팅 히스토리 표시
    function displayChatHistory() {
        const messagesContainer = document.getElementById('aiChatMessages');
        if (!messagesContainer || chatHistory.length === 0) {
            // 히스토리가 없으면 환영 메시지 표시
            const welcomeDiv = document.createElement('div');
            welcomeDiv.className = 'ai-chat-placeholder';
            welcomeDiv.innerHTML = `
                <i class="fas fa-robot"></i>
                <p>AI Assistant와 대화를 시작하세요!</p>
            `;
            messagesContainer.appendChild(welcomeDiv);
            return;
        }
        
        // 히스토리 메시지들 표시
        chatHistory.forEach(msg => {
            addMessage(msg.type, msg.content);
        });
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
