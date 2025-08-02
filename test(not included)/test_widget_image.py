import numpy as np
import cv2

# 테스트 이미지 생성
def create_test_image():
    # 640x480 크기의 테스트 이미지 생성
    image = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # 배경을 회색으로 설정
    image[:] = (128, 128, 128)
    
    # 빨간색 원 그리기
    cv2.circle(image, (320, 240), 100, (0, 0, 255), -1)
    
    # 파란색 사각형 그리기
    cv2.rectangle(image, (100, 100), (200, 200), (255, 0, 0), -1)
    
    # 녹색 선 그리기
    cv2.line(image, (50, 50), (590, 430), (0, 255, 0), 5)
    
    # 텍스트 추가
    cv2.putText(image, 'Widget Test', (200, 400), 
                cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    
    return image

# 메인 실행 코드
print("Image_Display_1 위젯 테스트를 시작합니다...")

# 테스트 이미지 생성
test_image = create_test_image()
print(f"이미지 생성 완료: {test_image.shape}")

# Image_Display_1 위젯으로 이미지 전송
emit_image(test_image, 'image_data')
print("이미지가 Image_Display_1 위젯으로 전송되었습니다!")

# 추가 테스트: 다른 이미지도 전송
print("2초 후 다른 이미지를 전송합니다...")
import time
time.sleep(2)

# 다른 이미지 생성 (그라데이션)
gradient_image = np.zeros((480, 640, 3), dtype=np.uint8)
for i in range(480):
    for j in range(640):
        gradient_image[i, j] = (i//2, j//2, 128)

cv2.putText(gradient_image, 'Gradient Test', (200, 240), 
            cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)

emit_image(gradient_image, 'image_data')
print("그라데이션 이미지도 전송되었습니다!")

print("모든 테스트가 완료되었습니다!") 