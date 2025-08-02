import numpy as np
import time

while True:
    # 640x480 랜덤 이미지 생성 및 전송
    emit_image(np.random.randint(0, 256, (480, 640)), 'image_data')
    time.sleep(1/30)  # 30fps 