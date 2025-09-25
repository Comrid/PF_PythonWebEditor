#!/usr/bin/env python3
"""
로봇 클라이언트 테스트 스크립트
중앙 서버와의 통신을 테스트합니다.
"""

import requests
import json
import time

# 테스트 설정
CENTRAL_SERVER_URL = "https://pathfinder-kit.duckdns.org"
ROBOT_ID = "robot_001"
ROBOT_NAME = "Test Robot"
ROBOT_URL = "http://localhost:5001"

def test_robot_registration():
    """로봇 등록 테스트"""
    print("=== 로봇 등록 테스트 ===")
    
    try:
        response = requests.post(
            f"{CENTRAL_SERVER_URL}/api/robots/register",
            json={
                "robot_id": ROBOT_ID,
                "robot_name": ROBOT_NAME,
                "robot_url": ROBOT_URL
            },
            timeout=10
        )
        
        if response.status_code == 200:
            print("✅ 로봇 등록 성공")
            return True
        else:
            print(f"❌ 로봇 등록 실패: {response.status_code} - {response.text}")
            return False
    
    except Exception as e:
        print(f"❌ 로봇 등록 오류: {e}")
        return False

def test_robot_list():
    """로봇 목록 조회 테스트"""
    print("\n=== 로봇 목록 조회 테스트 ===")
    
    try:
        response = requests.get(
            f"{CENTRAL_SERVER_URL}/api/robots",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ 로봇 목록 조회 성공")
            print(f"등록된 로봇 수: {len(data['robots'])}")
            for robot in data['robots']:
                print(f"  - {robot['robot_id']}: {robot['name']} ({robot['status']})")
            return True
        else:
            print(f"❌ 로봇 목록 조회 실패: {response.status_code} - {response.text}")
            return False
    
    except Exception as e:
        print(f"❌ 로봇 목록 조회 오류: {e}")
        return False

def test_robot_heartbeat():
    """로봇 하트비트 테스트"""
    print("\n=== 로봇 하트비트 테스트 ===")
    
    try:
        response = requests.post(
            f"{CENTRAL_SERVER_URL}/api/robots/{ROBOT_ID}/heartbeat",
            timeout=10
        )
        
        if response.status_code == 200:
            print("✅ 로봇 하트비트 성공")
            return True
        else:
            print(f"❌ 로봇 하트비트 실패: {response.status_code} - {response.text}")
            return False
    
    except Exception as e:
        print(f"❌ 로봇 하트비트 오류: {e}")
        return False

def test_robot_status():
    """로봇 상태 조회 테스트"""
    print("\n=== 로봇 상태 조회 테스트 ===")
    
    try:
        response = requests.get(
            f"{ROBOT_URL}/status",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ 로봇 상태 조회 성공")
            print(f"로봇 ID: {data['robot_id']}")
            print(f"로봇 이름: {data['robot_name']}")
            print(f"하드웨어 활성화: {data['hardware_enabled']}")
            print(f"중앙 서버 연결: {data['connected']}")
            return True
        else:
            print(f"❌ 로봇 상태 조회 실패: {response.status_code} - {response.text}")
            return False
    
    except Exception as e:
        print(f"❌ 로봇 상태 조회 오류: {e}")
        return False

def test_code_execution():
    """코드 실행 테스트"""
    print("\n=== 코드 실행 테스트 ===")
    
    test_code = """
print("Hello from robot!")
emit_text("테스트 메시지입니다", "Text_0")
"""
    
    try:
        response = requests.post(
            f"{ROBOT_URL}/execute",
            json={
                "code": test_code,
                "session_id": "test_session_123"
            },
            timeout=30
        )
        
        if response.status_code == 200:
            print("✅ 코드 실행 요청 성공")
            return True
        else:
            print(f"❌ 코드 실행 요청 실패: {response.status_code} - {response.text}")
            return False
    
    except Exception as e:
        print(f"❌ 코드 실행 요청 오류: {e}")
        return False

def main():
    """메인 테스트 함수"""
    print("PF Python Web Editor Robot Client 테스트 시작")
    print("=" * 50)
    
    tests = [
        test_robot_registration,
        test_robot_list,
        test_robot_heartbeat,
        test_robot_status,
        test_code_execution
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
        time.sleep(1)  # 테스트 간 간격
    
    print("\n" + "=" * 50)
    print(f"테스트 결과: {passed}/{total} 통과")
    
    if passed == total:
        print("🎉 모든 테스트 통과!")
    else:
        print("⚠️ 일부 테스트 실패")

if __name__ == "__main__":
    main()
