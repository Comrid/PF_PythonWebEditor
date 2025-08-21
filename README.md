# Pathfinder Python Web Editor

파이썬 AI 자율주행 자동차 키트를 위한 웹 기반 코드 에디터입니다.

## 주요 기능

### 🚗 자율주행 전용 위젯
- **웹캠 영상 처리**: 실시간 카메라 스트림 및 핸드 제스처 인식
- **이미지 표시**: OpenCV 처리 결과 시각화
- **PID 제어기**: 자동차 속도/방향 제어를 위한 실시간 파라미터 조정
- **슬라이더**: 다중 값 실시간 조정
- **AI 어시스턴트**: Gemini API 연동으로 코드 도움말 제공

### 💻 개발 환경
- **Monaco Editor**: Python 코드 편집 및 자동완성
- **실시간 실행**: WebSocket을 통한 즉시 코드 실행
- **실시간 출력**: stdout/stderr 스트리밍
- **반응형 레이아웃**: GridStack 기반 위젯 배치

### 🤖 AI 기능
- **Gemini API**: Google AI Studio 연동
- **코드 기반 질문**: 현재 편집 중인 코드를 컨텍스트로 활용
- **핸드 제스처**: MediaPipe 기반 제스처 인식

## 설치 및 설정

### 1. Google AI Studio API 키 발급
1. [Google AI Studio](https://aistudio.google.com/)에 접속
2. 로그인 후 "Get API key" 클릭
3. 새 API 키 생성

### 2. API 키 설정
#### 방법 1: 웹 인터페이스 (권장)
1. 에디터에서 설정 버튼(⚙️) 클릭
2. "Gemini API Key" 입력란에 API 키 입력
3. "저장" 버튼 클릭

#### 방법 2: 브라우저 개발자 도구
```javascript
// 브라우저 콘솔에서 실행
setGeminiAPIKey('your_actual_api_key_here');
```

### 3. 서버 실행
```bash
# Python 3.9+ 필요
pip install flask flask-socketio

# 서버 실행
python app.py
```

### 4. 브라우저 접속
```
http://localhost:5000
```

## 사용법

### 기본 사용
1. **코드 작성**: Monaco Editor에서 Python 코드 작성
2. **실행**: Run 버튼으로 코드 실행
3. **중지**: Stop 버튼으로 실행 중단
4. **출력 확인**: Output 패널에서 실시간 결과 확인

### 위젯 활용
1. **Add Widget**: 헤더의 "Add Widget" 버튼으로 위젯 추가
2. **위젯 배치**: 드래그 앤 드롭으로 원하는 위치에 배치
3. **크기 조정**: 우하단 모서리를 드래그하여 크기 조정

### AI 어시스턴트 사용
1. **AI Assistant 위젯 생성**: Add Widget에서 "AI Assistant" 선택
2. **Code Based 토글**: 현재 코드를 컨텍스트로 활용하려면 On으로 설정
3. **질문 입력**: 텍스트 영역에 질문 입력 후 Ask 버튼 클릭

## 예제 코드

### 기본 예제
- **Default**: 기본 템플릿
- **Editor Exam**: 에디터 사용법 예제
- **Camera Exam**: 웹캠 활용 예제

### 자율주행 예제
- **Motor Exam**: 모터 제어 기본
- **Ultrasonic Exam**: 거리 센서 활용
- **Lane Detection**: OpenCV 기반 차선 인식
- **Obstacle Avoidance**: 장애물 회피 알고리즘
- **PID Control**: PID 제어를 통한 정밀 주행

## 위젯 ID 시스템

### 이미지 위젯
- 기본 ID: `Image_0`, `Image_1`, ...
- 사용법: `emit_image(image_data, "Image_0")`

### 텍스트 위젯
- 기본 ID: `Text_0`, `Text_1`, ...
- 사용법: `emit_text("메시지", "Text_0")`

### PID 제어기
- 기본 ID: `PID_Controller_0`, `PID_Controller_1`, ...
- Python에서 읽기: `get_pid_value("PID_Controller_0")`

### 슬라이더
- 기본 ID: `Slider_0`, `Slider_1`, ...
- Python에서 읽기: `get_slider_value("Slider_0")`

## API 함수

### 이미지/텍스트 출력
```python
emit_image(image_data, widget_id)  # numpy 배열 또는 이미지 데이터
emit_text(text_data, widget_id)    # 문자열 또는 데이터
```

### 센서 데이터 읽기
```python
get_gesture()           # 핸드 제스처 상태
get_pid_value(widget_id) # PID 위젯 값 (p, i, d)
get_slider_value(widget_id) # 슬라이더 값
get_llm_answer()        # AI 어시스턴트 최신 답변
```

## 문제 해결

### API 키 오류
- "Gemini API 키가 설정되지 않았습니다" 메시지가 나타나는 경우
- 설정에서 API 키를 올바르게 입력했는지 확인
- API 키가 유효한지 Google AI Studio에서 확인

### 웹캠 접근 오류
- HTTPS 환경에서만 카메라 접근 가능
- localhost:5000으로 접속하여 테스트
- 브라우저 권한 설정 확인

### 연결 오류
- 서버가 실행 중인지 확인
- 포트 5000이 사용 가능한지 확인
- 방화벽 설정 확인

## 개발자 정보

### 기술 스택
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Python, Flask, Flask-SocketIO
- **AI**: Google Gemini API, MediaPipe
- **Editor**: Monaco Editor
- **Layout**: GridStack.js

### 파일 구조
```
├── app.py                 # Flask 서버 및 SocketIO
├── static/
│   ├── css/              # 스타일시트
│   ├── js/               # JavaScript 모듈
│   └── img/              # 이미지 리소스
├── templates/
│   └── index.html        # 메인 HTML
└── util.py               # 플랫폼별 Findee 모듈
```

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 문의

프로젝트에 대한 질문이나 제안사항이 있으시면 이슈를 생성해 주세요. 