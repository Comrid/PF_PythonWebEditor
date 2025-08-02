import numpy as np
import cv2
import time

# 30fps = 1/30초 간격
fps = 30
interval = 1.0 / fps

print(f"30fps 랜덤 이미지 전송 시작 (간격: {interval:.3f}초)")

try:
    while True:
        # 640x480 1채널 랜덤 이미지 생성
        random_image = np.random.randint(0, 256, (480, 640), dtype=np.uint8)
        
        # 이미지 전송
        emit_image(random_image, 'image_data')
        
        # 30fps 간격으로 대기
        time.sleep(interval)
        
except KeyboardInterrupt:
    print("전송 중지됨") 