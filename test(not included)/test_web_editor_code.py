import numpy as np
import cv2

# 테스트 이미지 생성
def create_test_image():
    # 640x480 크기의 테스트 이미지 생성
    image = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # 빨간색 원 그리기
    cv2.circle(image, (320, 240), 100, (0, 0, 255), -1)
    
    # 파란색 사각형 그리기
    cv2.rectangle(image, (100, 100), (200, 200), (255, 0, 0), -1)
    
    # 녹색 선 그리기
    cv2.line(image, (50, 50), (590, 430), (0, 255, 0), 5)
    
    # 텍스트 추가
    cv2.putText(image, 'Test Image', (200, 400), 
                cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    
    return image

# 메인 실행 코드
print("이미지 생성 및 전송 테스트를 시작합니다...")

# 테스트 이미지 생성
test_image = create_test_image()
print(f"이미지 생성 완료: {test_image.shape}")

# 이미지 전송
emit_image(test_image, 'image_data')
print("이미지 전송 완료!")

# 커스텀 데이터 전송
test_data = {
    'message': 'Hello from web editor!',
    'timestamp': '2024-01-01 12:00:00',
    'values': [1, 2, 3, 4, 5],
    'image_shape': test_image.shape
}

emit_data(test_data, 'custom_data')
print("데이터 전송 완료!")

print("모든 테스트가 완료되었습니다!") 