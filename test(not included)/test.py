#!/usr/bin/env python3
"""
Jedi 라이브러리 테스트 스크립트
Jedi의 자동완성, 정의 찾기, 참조 찾기 등의 기능을 테스트합니다.
"""

import jedi
import sys
import os
from typing import List, Dict, Any


def test_jedi_basic_completion():
    """기본 자동완성 테스트"""
    print("=== 기본 자동완성 테스트 ===")
    
    # 테스트 코드
    code = """import math
import os
import sys

def test_function():
    pass

class TestClass:
    def __init__(self):
        pass

# 자동완성 테스트
math."""
    
    # Jedi Script 생성 (최신 API 사용)
    script = jedi.Script(code, path='test.py')
    
    # 자동완성 가져오기 (마지막 줄, math. 다음 위치)
    completions = script.complete(10, 5)
    
    print(f"math. 에 대한 자동완성 결과 ({len(completions)}개):")
    for i, completion in enumerate(completions[:10]):  # 처음 10개만 출력
        print(f"  {i+1}. {completion.name} ({completion.type})")
        if completion.docstring():
            print(f"      설명: {completion.docstring()[:50]}...")
    print()


def test_jedi_function_completion():
    """함수 자동완성 테스트"""
    print("=== 함수 자동완성 테스트 ===")
    
    code = """def calculate_area(radius):
    return 3.14 * radius ** 2

def calculate_perimeter(radius):
    return 2 * 3.14 * radius

# 함수 자동완성 테스트
calc"""
    
    script = jedi.Script(code, path='test.py')
    completions = script.complete(7, 4)
    
    print(f"calc 에 대한 자동완성 결과 ({len(completions)}개):")
    for completion in completions:
        print(f"  - {completion.name} ({completion.type})")
    print()


def test_jedi_import_completion():
    """import 자동완성 테스트"""
    print("=== import 자동완성 테스트 ===")
    
    code = """# import 자동완성 테스트
import zu"""
    
    script = jedi.Script(code, path='test.py')
    completions = script.complete(2, 8)
    
    print(f"import ma 에 대한 자동완성 결과 ({len(completions)}개):")
    for completion in completions:
        print(f"  - {completion.name} ({completion.type})")
    print()


def test_jedi_from_import_completion():
    """from import 자동완성 테스트"""
    print("=== from import 자동완성 테스트 ===")
    
    code = """# from import 자동완성 테스트
from math import sq"""
    
    script = jedi.Script(code, path='test.py')
    completions = script.complete(2, 15)
    
    print(f"from math import sq 에 대한 자동완성 결과 ({len(completions)}개):")
    for completion in completions:
        print(f"  - {completion.name} ({completion.type})")
        if completion.docstring():
            print(f"      설명: {completion.docstring()[:60]}...")
    print()


def test_jedi_definition():
    """정의 찾기 테스트"""
    print("=== 정의 찾기 테스트 ===")
    
    code = """def my_function():
    return "Hello"

# 정의 찾기 테스트
my_function()"""
    
    script = jedi.Script(code, path='test.py')
    definitions = script.goto_definitions(5, 1)
    
    print(f"my_function의 정의 찾기 결과 ({len(definitions)}개):")
    for definition in definitions:
        print(f"  - {definition.name} at {definition.module_path}:{definition.line}")
    print()


def test_jedi_references():
    """참조 찾기 테스트"""
    print("=== 참조 찾기 테스트 ===")
    
    code = """def my_function():
    return "Hello"

# 참조 찾기 테스트
my_function()
my_function()"""
    
    script = jedi.Script(code, path='test.py')
    references = script.get_references(5, 1)
    
    print(f"my_function의 참조 찾기 결과 ({len(references)}개):")
    for reference in references:
        print(f"  - {reference.name} at {reference.module_path}:{reference.line}")
    print()


def test_jedi_signatures():
    """함수 시그니처 테스트"""
    print("=== 함수 시그니처 테스트 ===")
    
    code = """def complex_function(param1, param2="default", *args, **kwargs):
    return param1 + param2

# 시그니처 테스트
complex_function("""
    
    script = jedi.Script(code, path='test.py')
    signatures = script.get_signatures(5, 15)
    
    print(f"complex_function의 시그니처 결과 ({len(signatures)}개):")
    for signature in signatures:
        print(f"  - {signature.name}{signature.to_string()}")
        print(f"    설명: {signature.docstring()}")
    print()


def test_jedi_environment():
    """Jedi 환경 테스트"""
    print("=== Jedi 환경 테스트 ===")
    
    # 현재 Python 환경 정보
    print(f"Python 버전: {sys.version}")
    print(f"Jedi 버전: {jedi.__version__}")
    print(f"현재 작업 디렉토리: {os.getcwd()}")
    
    # Jedi 환경 생성
    environment = jedi.get_default_environment()
    print(f"Jedi 환경: {environment}")
    print()


def test_jedi_error_handling():
    """Jedi 오류 처리 테스트"""
    print("=== Jedi 오류 처리 테스트 ===")
    
    # 잘못된 코드로 테스트
    invalid_code = """def incomplete_function(
    # 함수가 완성되지 않음"""
    
    try:
        script = jedi.Script(invalid_code, path='test.py')
        completions = script.complete(2, 20)
        print(f"오류가 있는 코드에서도 자동완성 가능: {len(completions)}개")
    except Exception as e:
        print(f"Jedi 오류 처리: {e}")
    print()


def test_jedi_performance():
    """Jedi 성능 테스트"""
    print("=== Jedi 성능 테스트 ===")
    
    import time
    
    # 큰 코드로 성능 테스트
    large_code = """import math
import os
import sys
import json
import datetime
import collections

def test_function():
    return math.sqrt(16)

class TestClass:
    def __init__(self):
        self.value = 42
    
    def get_value(self):
        return self.value

# 성능 테스트
test_"""
    
    start_time = time.time()
    script = jedi.Script(large_code, path='test.py')
    completions = script.complete(19, 5)
    end_time = time.time()
    
    print(f"자동완성 응답 시간: {(end_time - start_time)*1000:.2f}ms")
    print(f"자동완성 결과 수: {len(completions)}개")
    print()


def main():
    """메인 테스트 함수"""
    print("🚀 Jedi 라이브러리 테스트 시작")
    print("=" * 50)
    
    try:
        # 각 테스트 실행
        test_jedi_environment()
        test_jedi_basic_completion()
        test_jedi_function_completion()
        test_jedi_import_completion()
        test_jedi_from_import_completion()
        test_jedi_definition()
        test_jedi_references()
        test_jedi_signatures()
        test_jedi_error_handling()
        test_jedi_performance()
        
        print("✅ 모든 테스트 완료!")
        
    except ImportError:
        print("❌ Jedi가 설치되지 않았습니다. 다음 명령어로 설치하세요:")
        print("   pip install jedi")
    except Exception as e:
        print(f"❌ 테스트 중 오류 발생: {e}")


if __name__ == "__main__":
    main()
