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

# 이미지 전송 테스트
def test_image_emit():
    # 테스트 이미지 생성
    test_image = create_test_image()
    
    # emit_image 함수 호출 (서브 프로세스에서 실행됨)
    emit_image(test_image, 'image_data')
    
    print("이미지 전송 완료!")

# 데이터 전송 테스트
def test_data_emit():
    test_data = {
        'message': 'Hello from subprocess!',
        'timestamp': '2024-01-01 12:00:00',
        'values': [1, 2, 3, 4, 5]
    }
    
    emit_data(test_data, 'custom_data')
    
    print("데이터 전송 완료!")

if __name__ == "__main__":
    # 테스트 실행
    test_image_emit()
    test_data_emit() 