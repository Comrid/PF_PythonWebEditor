import time
import numpy as np
import statistics

def performance_test():
    """함수 호출 오버헤드 성능 비교 테스트"""
    
    print("=== 함수 호출 오버헤드 성능 비교 ===")
    print()
    
    # 테스트 설정
    iterations = 1000000
    test_values = [(i, i+1, i+2) for i in range(1000)]
    
    # 1. 직접 계산 (가장 빠름)
    print("1. 직접 계산 테스트...")
    direct_times = []
    for _ in range(10):  # 10번 반복하여 평균 계산
        start = time.time()
        for x, y, z in test_values:
            result = x * 2 + y * 3 + z * 4
        direct_times.append(time.time() - start)
    
    direct_avg = statistics.mean(direct_times)
    direct_std = statistics.stdev(direct_times)
    
    # 2. Lambda 함수
    print("2. Lambda 함수 테스트...")
    lambda_times = []
    calc_lambda = lambda x, y, z: x * 2 + y * 3 + z * 4
    for _ in range(10):
        start = time.time()
        for x, y, z in test_values:
            result = calc_lambda(x, y, z)
        lambda_times.append(time.time() - start)
    
    lambda_avg = statistics.mean(lambda_times)
    lambda_std = statistics.stdev(lambda_times)
    
    # 3. 일반 함수
    print("3. 일반 함수 테스트...")
    def calc_func(x, y, z):
        return x * 2 + y * 3 + z * 4
    
    func_times = []
    for _ in range(10):
        start = time.time()
        for x, y, z in test_values:
            result = calc_func(x, y, z)
        func_times.append(time.time() - start)
    
    func_avg = statistics.mean(func_times)
    func_std = statistics.stdev(func_times)
    
    # 4. 인라인 Lambda (즉시 실행)
    print("4. 인라인 Lambda 테스트...")
    inline_times = []
    for _ in range(10):
        start = time.time()
        for x, y, z in test_values:
            result = (lambda x, y, z: x * 2 + y * 3 + z * 4)(x, y, z)
        inline_times.append(time.time() - start)
    
    inline_avg = statistics.mean(inline_times)
    inline_std = statistics.stdev(inline_times)
    
    # 결과 출력
    print("\n=== 결과 ===")
    print(f"{'방법':<15} {'평균(초)':<12} {'표준편차':<12} {'상대성능':<10}")
    print("-" * 55)
    
    # 직접 계산을 기준으로 상대 성능 계산
    base_time = direct_avg
    
    print(f"{'직접 계산':<15} {direct_avg:<12.6f} {direct_std:<12.6f} {'1.00x':<10}")
    print(f"{'Lambda 함수':<15} {lambda_avg:<12.6f} {lambda_std:<12.6f} {lambda_avg/base_time:<10.2f}x")
    print(f"{'일반 함수':<15} {func_avg:<12.6f} {func_std:<12.6f} {func_avg/base_time:<10.2f}x")
    print(f"{'인라인 Lambda':<15} {inline_avg:<12.6f} {inline_std:<12.6f} {inline_avg/base_time:<10.2f}x")
    
    print("\n=== 분석 ===")
    print(f"• 직접 계산이 가장 빠름: {direct_avg:.6f}초")
    print(f"• Lambda 함수 오버헤드: {lambda_avg/direct_avg:.2f}배 느림")
    print(f"• 일반 함수 오버헤드: {func_avg/direct_avg:.2f}배 느림")
    print(f"• 인라인 Lambda 오버헤드: {inline_avg/direct_avg:.2f}배 느림")
    
    # NumPy 연산 비교
    print("\n=== NumPy 연산 비교 ===")
    numpy_times = []
    test_array = np.array(test_values)
    for _ in range(10):
        start = time.time()
        result = test_array[:, 0] * 2 + test_array[:, 1] * 3 + test_array[:, 2] * 4
        numpy_times.append(time.time() - start)
    
    numpy_avg = statistics.mean(numpy_times)
    numpy_std = statistics.stdev(numpy_times)
    
    print(f"{'NumPy 연산':<15} {numpy_avg:<12.6f} {numpy_std:<12.6f} {numpy_avg/base_time:<10.2f}x")
    
    print("\n=== 결론 ===")
    print("• Python에서 함수 호출 오버헤드는 상당함")
    print("• Lambda도 여전히 함수 호출 오버헤드가 있음")
    print("• 성능이 중요한 경우 직접 계산 사용 권장")
    print("• NumPy는 벡터화된 연산으로 매우 빠름")

if __name__ == "__main__":
    performance_test() 