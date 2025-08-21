// LLM.js - Gemini API 연동
// Google AI Studio에서 API 키를 받아서 환경변수 GEMINI_API_KEY에 설정하거나
// 아래 API_KEY 변수에 직접 입력하세요

// API 키 설정 (보안을 위해 환경변수 사용 권장)
const API_KEY = window.GEMINI_API_KEY || 'AIzaSyDenJAeFEIlMfujPj7FdF1Xl2q4BZOyCRo';

// Gemini API 엔드포인트
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// 간결 응답용 시스템 프롬프트
const LLM_SYSTEM_PROMPT = [
  '규칙:',
  '- 한국어로 간결히 답변(중복 금지, 과한 장황함 금지).',
  '- 가능하면 3~5개의 불릿 또는 1개의 짧은 코드 블록만 사용.',
  '- 필요 시 Python 예시는 최소화하고 실행에 필요한 부분만 포함.',
  '- 질문 맥락(코드/Findee API)만 근거로 답변.',
  '- 코드 예시에서 Findee 인스턴스 변수명은 사용자가 정의한 이름을 사용.',
  '- 코드 예시 생성 시 항상 try-except-finally 구조 사용.',
].join('\n');

// Findee API 요약 (findee2.py 기준, 안전 모드/환경 차이는 생략)
const FINDEE_API_BRIEF = [
  '**사용법**: Findee 클래스는 이미 전역으로 제공됨',
  '',
  '**기본 사용법**:',
  'robot = Findee()  # 또는 원하는 변수명',
  'try:',
  '    # 코드 작성',
  '    pass',
  'except Exception as e:',
  '    print(e)',
  'finally:',
  '    robot.cleanup()',
  '',
  '**주요 메서드**:',
  '',
  '**모터 제어**:',
  '- robot.move_forward(speed, duration=0.0)  # 20~100 권장',
  '- robot.move_backward(speed, duration=0.0)',
  '- robot.turn_left(speed, duration=0.0) / robot.turn_right(speed, duration=0.0)',
  '- robot.curve_left(speed, angle, duration=0.0)  # angle 0~60',
  '- robot.curve_right(speed, angle, duration=0.0)',
  '- robot.stop()',
  '',
  '**카메라**:',
  '- robot.get_frame() -> np.ndarray',
  '',
  '**초음파 센서**:',
  '- robot.get_distance() -> float | -1(Trig Timeout) | -2(Echo Timeout)',
  '',
  '**기타**:',
  '- robot.changePin(IN1, IN2, IN3, IN4, ENA, ENB)  # GPIO 핀 변경',
  '- robot.constrain(value, min_value, max_value)  # 값 범위 제한',
  '',
  '**참고사항**:',
  '- speed: 20~100 범위 권장 (20 이하일 때 모터가 동작하지 않을 수 있음)',
  '- duration: 0.0이면 계속 동작, 양수면 지정 시간 후 자동 정지',
  '- angle: 0~60도 범위 (0도는 직진, 60도는 최대 커브)',
  '- get_distance(): 1.0~400.0cm 범위, -1/-2는 에러 코드'
].join('\n');

// 전역 노출
window.LLM_SYSTEM_PROMPT = LLM_SYSTEM_PROMPT;
window.FINDEE_API_BRIEF = FINDEE_API_BRIEF;

// LLM 상태 관리
let llmLoaded = false;
let llmLoading = false;
let llmError = null;

// LLM 초기화
async function loadLLM() {
    if (llmLoaded || llmLoading) return;
    
    llmLoading = true;
    updateLLMStatus();
    
    try {
        // API 키 검증 (환경변수 또는 로컬 스토리지에서)
        const currentApiKey = window.GEMINI_API_KEY || API_KEY;
        if (!currentApiKey || currentApiKey === 'YOUR_GEMINI_API_KEY_HERE') {
            throw new Error('Gemini API 키가 설정되지 않았습니다. 설정에서 API 키를 입력하세요.');
        }
        
        // 간단한 테스트 요청으로 API 연결 확인
        const testResponse = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': currentApiKey
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: 'ping' }]
                }]
            })
        });
        
        if (!testResponse.ok) {
            throw new Error(`API 연결 실패: ${testResponse.status} ${testResponse.statusText}`);
        }
        
        llmLoaded = true;
        llmError = null;
        showToast('Gemini API 연결 성공!', 'success');
        
    } catch (error) {
        console.error('LLM 초기화 실패:', error);
        llmError = error.message;
        showToast(`LLM 초기화 실패: ${error.message}`, 'error');
    } finally {
        llmLoading = false;
        updateLLMStatus();
    }
}

// LLM 상태 업데이트
function updateLLMStatus() {
    const event = new CustomEvent('llm_status_changed', {
        detail: {
            loaded: llmLoaded,
            loading: llmLoading,
            error: llmError
        }
    });
    window.dispatchEvent(event);
}

// LLM 상태 조회
function getLlmStatus() {
    return {
        loaded: llmLoaded,
        loading: llmLoading,
        error: llmError
    };
}

// Gemini API로 질문하기
async function askLLM(question, callback) {
    if (!llmLoaded) {
        throw new Error('LLM이 아직 로드되지 않았습니다.');
    }
    
    try {
        const currentApiKey = window.GEMINI_API_KEY || API_KEY;
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': currentApiKey
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: question }]
                }],
                generationConfig: {
                    temperature: 0.3,
                    topK: 20,
                    topP: 0.9,
                    maxOutputTokens: 800,
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
        
    } catch (error) {
        console.error('LLM 질문 실패:', error);
        throw error;
    }
}

// 전역 함수로 노출
window.loadLLM = loadLLM;
    window.askLLM = askLLM;
    window.getLlmStatus = getLlmStatus;

// 페이지 로드 시 자동 초기화
document.addEventListener('DOMContentLoaded', () => {
    // API 키가 설정된 경우 자동 로드
    const currentApiKey = window.GEMINI_API_KEY || API_KEY;
    if (currentApiKey && currentApiKey !== 'YOUR_GEMINI_API_KEY_HERE') {
        loadLLM();
    }
});
  