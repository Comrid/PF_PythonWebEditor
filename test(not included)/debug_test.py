print("=== 디버깅 테스트 시작 ===")

# 기본 모듈 확인
import sys
print("Python 경로:", sys.executable)
print("Python 버전:", sys.version)

# 현재 디렉토리 확인
import os
print("현재 작업 디렉토리:", os.getcwd())

# 기본 모듈 import 테스트
try:
    import json
    print("JSON 모듈 OK")
except Exception as e:
    print("JSON 모듈 오류:", e)

try:
    import base64
    print("Base64 모듈 OK")
except Exception as e:
    print("Base64 모듈 오류:", e)

# numpy 테스트
try:
    import numpy as np
    print("NumPy 모듈 OK - 버전:", np.__version__)
except Exception as e:
    print("NumPy 모듈 오류:", e)

# cv2 테스트
try:
    import cv2
    print("OpenCV 모듈 OK - 버전:", cv2.__version__)
except Exception as e:
    print("OpenCV 모듈 오류:", e)

print("=== 디버깅 테스트 완료 ===") 