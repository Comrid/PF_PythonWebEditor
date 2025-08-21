// LLM.js - Gemini API 연동
// Google AI Studio에서 API 키를 받아서 환경변수 GEMINI_API_KEY에 설정하거나
// 아래 API_KEY 변수에 직접 입력하세요

// API 키 설정 (보안을 위해 환경변수 사용 권장)
const API_KEY = window.GEMINI_API_KEY || 'KEY';

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
  '- **중요**: 모든 Findee 관련 코드는 반드시 "from findee import Findee"로 시작해야 함.',
  '- 코드 예시 생성 시 항상 import 문을 포함하고, try-except-finally 구조 사용.',
].join('\n');

// Findee API 요약 (test/findee.py 기준, 안전 모드/환경 차이는 생략)
const FINDEE_API_BRIEF = [
  '**필수 import**: from findee import Findee',
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
  '**주요 속성**:',
  '- robot.motor: 모터 제어',
  '- robot.camera: 카메라 제어', 
  '- robot.ultrasonic: 초음파 센서 제어',
  '',
  '**Motor (robot.motor)**:',
  '- move_forward(speed, time_sec=None)  # 20~100 권장',
  '- move_backward(speed, time_sec=None)',
  '- turn_left(speed, time_sec=None) / turn_right(speed, time_sec=None)',
  '- curve_left(speed, angle, time_sec=None)  # angle 0~60',
  '- curve_right(speed, angle, time_sec=None)',
  '- stop()',
  '',
  '**Camera (robot.camera)**:',
  '- get_frame() -> np.ndarray | None',
  '- start_frame_capture(frame_rate=30) / stop_frame_capture()',
  '- generate_frames(quality=95)  # MJPEG generator',
  '- configure_resolution((w, h))',
  '- get_available_resolutions() / get_current_resolution()',
  '',
  '**Ultrasonic (robot.ultrasonic)**:',
  '- get_distance() -> float | None',
  '- get_last_distance() -> float | None',
  '- start_distance_measurement(interval=0.1) / stop_distance_measurement()',
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
  