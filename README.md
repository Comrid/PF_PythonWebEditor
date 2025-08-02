# Findee Python Web Editor

Monaco Editor를 기반으로 한 Python 웹 에디터입니다. IntelliSense 기능을 통해 Python 코드 작성 시 자동완성을 지원합니다.

## 🚀 주요 기능

- **Monaco Editor**: VS Code와 동일한 에디터 엔진
- **Python IntelliSense**: 자동완성, 문법 하이라이팅, 스니펫 지원
- **실시간 편집**: 브라우저에서 직접 Python 코드 작성
- **크로스 플랫폼**: Windows/Linux 지원

## 📋 IntelliSense 기능

### 자동완성 지원 항목
- **Python 키워드**: `def`, `class`, `if`, `for`, `while`, `try`, `import`, `from`, `return` 등
- **내장 함수**: `print`, `len`, `range`, `list`, `dict`, `str`, `int`, `float`, `bool` 등
- **스니펫**: 함수 정의, 클래스 정의, 반복문, 조건문 등의 템플릿

### 사용 방법
1. 에디터에서 코드를 작성하세요
2. `Ctrl + Space`를 눌러 자동완성을 활성화하세요
3. 타이핑 중 자동으로 제안이 나타납니다
4. `Tab` 키로 선택한 제안을 삽입하세요

## 🛠️ 설치 및 실행

### 1. 의존성 설치
```bash
pip install -r requirements.txt
```

### 2. 애플리케이션 실행
```bash
python app.py
```

### 3. 브라우저에서 접속
```
http://localhost:5000
```

## 📁 프로젝트 구조

```
8.flask_jedi_monaco_editor/
├── app.py                 # Flask 메인 애플리케이션
├── requirements.txt       # Python 의존성
├── README.md             # 프로젝트 설명
├── templates/
│   └── index.html        # 메인 HTML 템플릿
└── static/
    ├── js/
    │   └── editor.js     # Monaco Editor 설정 및 IntelliSense
    └── css/
        └── *.css         # 스타일시트 파일들
```

## 🎯 IntelliSense 테스트

에디터에서 다음을 시도해보세요:

1. **키워드 자동완성**:
   ```python
   def  # 함수 정의 스니펫
   class  # 클래스 정의 스니펫
   if  # 조건문 스니펫
   for  # 반복문 스니펫
   ```

2. **내장 함수 자동완성**:
   ```python
   print(  # print 함수 자동완성
   len(   # len 함수 자동완성
   range( # range 함수 자동완성
   ```

3. **스니펫 사용**:
   - `def` 입력 후 `Tab` → 함수 정의 템플릿
   - `class` 입력 후 `Tab` → 클래스 정의 템플릿
   - `if` 입력 후 `Tab` → 조건문 템플릿

## 🔧 기술 스택

- **Backend**: Flask (Python)
- **Frontend**: HTML5, CSS3, JavaScript
- **Editor**: Monaco Editor
- **IntelliSense**: Monaco Editor 기본 기능
- **Styling**: Custom CSS

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 