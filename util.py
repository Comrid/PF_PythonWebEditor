import subprocess
import platform

def get_flask_url(port: str = '5000') -> str:
    if platform.system() == 'Windows':
        ip = '127.0.0.1'
    else:
        ip = subprocess.run(['hostname', '-I'], capture_output=True, text=True).stdout.strip()

    return f'http://{ip}:{port}'

event_name_and_messages = {
}

def get_wrapper_code(code: str):
    return f"""
import base64
import numpy as np
import cv2
import json
import sys

# emit 함수 정의
def emit_image(image, event='image_data'):
    print(f"DEBUG: emit_image 호출됨 - event: {{event}}")
    if isinstance(image, np.ndarray):
        import time
        start_time = time.time()

        # 이미지를 base64로 인코딩
        _, buffer = cv2.imencode('.jpg', image)
        encode_time = time.time() - start_time
        print(f"DEBUG: JPEG 인코딩 완료 - 시간: {{encode_time*1000:.2f}}ms")

        image_base64 = base64.b64encode(buffer).decode()
        base64_time = time.time() - start_time - encode_time
        print(f"DEBUG: Base64 인코딩 완료 - 시간: {{base64_time*1000:.2f}}ms, 크기: {{len(image_base64)}}")

        # 메인 프로세스로 전송
        message = {{
            'type': 'emit_image',
            'event': event,
            'image': image_base64,
            'shape': image.shape
        }}
        sys.stdout.write(f"EMIT_MESSAGE:{{json.dumps(message)}}\\n")
        sys.stdout.flush()

        total_time = time.time() - start_time
        print(f"DEBUG: 이미지 메시지 전송 완료 - 총 시간: {{total_time*1000:.2f}}ms")
    else:
        print(f"DEBUG: 이미지가 numpy 배열이 아님 - 타입: {{type(image)}}")

def emit_data(data, event='custom_data'):
    print(f"DEBUG: emit_data 호출됨 - event: {{event}}")
    message = {{
        'type': 'emit_data',
        'event': event,
        'data': data
    }}
    sys.stdout.write(f"EMIT_MESSAGE:{{json.dumps(message)}}\\n")
    sys.stdout.flush()
    print(f"DEBUG: 데이터 메시지 전송 완료")

print("DEBUG: 서브 프로세스 시작")
print("DEBUG: 사용자 코드 실행 시작")

# 사용자 코드
{code}

print("DEBUG: 사용자 코드 실행 완료")
"""
