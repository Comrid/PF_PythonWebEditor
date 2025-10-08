import sqlite3
from pathlib import Path

Parent = Path(__file__).parent
DB_PATH = Parent / "static" / "db" / "auth.db"

def view_database():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        print("=" * 60)
        print("AUTH.DB 데이터베이스 내용")
        print("=" * 60)

        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print(f"\n테이블 목록: {[table[0] for table in tables]}")

        # 모든 테이블의 스키마 출력
        for table_name in [table[0] for table in tables]:
            if table_name == 'sqlite_sequence':
                continue  # sqlite_sequence는 시스템 테이블이므로 스키마 출력 생략

            print(f"\n{table_name} 테이블 스키마:")
            cursor.execute(f"PRAGMA table_info({table_name});")
            columns = cursor.fetchall()
            for col in columns:
                pk_text = "PRIMARY KEY" if col[5] else ""
                not_null_text = "NOT NULL" if col[3] else "NULL"
                print(f"  - {col[1]} ({col[2]}) {not_null_text} {pk_text}")

        # users 테이블 데이터
        print("\nusers 테이블 데이터:")
        cursor.execute("SELECT id, username, email, role, created_at, last_login FROM users;")
        users = cursor.fetchall()

        if users:
            print(f"{'ID':<5} {'Username':<15} {'Email':<25} {'Role':<10} {'Created':<20} {'Last Login':<20}")
            print("-" * 100)
            for user in users:
                print(f"{user[0]:<5} {user[1]:<15} {user[2] or 'N/A':<25} {user[3]:<10} {user[4] or 'N/A':<20} {user[5] or 'N/A':<20}")
        else:
            print("  (데이터 없음)")

        # user_robot_assignments 테이블 데이터
        print("\nuser_robot_assignments 테이블 데이터:")
        cursor.execute("SELECT id, user_id, robot_name, robot_id, assigned_at, is_active FROM user_robot_assignments;")
        assignments = cursor.fetchall()

        if assignments:
            print(f"{'ID':<5} {'User ID':<10} {'Robot Name':<15} {'Robot ID':<15} {'Assigned At':<20} {'Active':<10}")
            print("-" * 85)
            for assignment in assignments:
                print(f"{assignment[0]:<5} {assignment[1]:<10} {assignment[2]:<15} {assignment[3]:<15} {assignment[4] or 'N/A':<20} {assignment[5]:<10}")
        else:
            print("  (데이터 없음)")

        # sqlite_sequence 테이블 데이터 (시스템 테이블)
        print("\nsqlite_sequence 테이블 데이터:")
        cursor.execute("SELECT * FROM sqlite_sequence;")
        sequences = cursor.fetchall()

        if sequences:
            print(f"{'name':<20} {'seq':<10}")
            print("-" * 30)
            for seq in sequences:
                print(f"{seq[0]:<20} {seq[1]:<10}")
        else:
            print("  (데이터 없음)")

        conn.close()
        print("\n데이터베이스 조회 완료!")

    except FileNotFoundError:
        print(f"데이터베이스 파일을 찾을 수 없습니다: {DB_PATH}")
        print("create_auth_db.py를 먼저 실행해보세요.")
    except Exception as e:
        print(f"오류 발생: {e}")

if __name__ == "__main__":
    view_database()
