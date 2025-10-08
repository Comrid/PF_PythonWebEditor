import sqlite3
import hashlib
from datetime import datetime
from flask_login import UserMixin
from pathlib import Path

# 데이터베이스 경로
DB_PATH = Path(__file__).parent / "static" / "db" / "auth.db"

class User(UserMixin):
    def __init__(self, user_id, username, email, role='user'):
        self.id = user_id
        self.username = username
        self.email = email
        self.role = role

class GuestUser(UserMixin):
    def __init__(self):
        self.id = 'guest'
        self.username = 'Guest'
        self.email = None
        self.role = 'guest'
        self._is_authenticated = False  # Guest는 로그인하지 않은 사용자
        self._is_active = True
        self._is_anonymous = True       # Guest는 익명 사용자

    @property
    def is_authenticated(self):
        return self._is_authenticated

    @property
    def is_active(self):
        return self._is_active

    @property
    def is_anonymous(self):
        return self._is_anonymous

##############################################################################

# 사용자 인증
def authenticate_user(username, password):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT id, username, email, role, password_hash FROM users WHERE username = ?
        ''', (username,))

        row = cursor.fetchone()
        conn.close()

        if row and verify_password(password, row[4]):
            update_last_login(row[0])
            return User(row[0], row[1], row[2], row[3])
        return None
    except Exception as e:
        print(f"사용자 인증 오류: {e}")
        return None

# 사용자 생성
def create_user(username, password, email, role='user'):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        password_hash = hash_password(password)

        cursor.execute('''
            INSERT INTO users (username, password_hash, email, role)
            VALUES (?, ?, ?, ?)
        ''', (username, password_hash, email, role))

        user_id = cursor.lastrowid
        conn.commit()
        conn.close()

        return User(user_id, username, email, role)
    except sqlite3.IntegrityError:
        return None  # 사용자명 중복
    except Exception as e:
        print(f"사용자 생성 오류: {e}")
        return None

##############################################################################

# 비밀번호 해시화 및 검증
def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password, password_hash):
    return hash_password(password) == password_hash

##############################################################################

# 사용자 조회(ID 또는 사용자명)
def get_user(identifier, by='id'):
    """
    Args:
        identifier: 사용자 ID 또는 사용자명
        by: 'id' 또는 'username'
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        if by == 'id':
            cursor.execute('''
                SELECT id, username, email, role FROM users WHERE id = ?
            ''', (identifier,))
        elif by == 'username':
            cursor.execute('''
                SELECT id, username, email, role FROM users WHERE username = ?
            ''', (identifier,))
        else:
            raise ValueError("by 파라미터는 'id' 또는 'username'이어야 합니다.")

        row = cursor.fetchone()
        conn.close()

        if row:
            return User(row[0], row[1], row[2], row[3])
        return None
    except Exception as e:
        print(f"사용자 조회 오류: {e}")
        return None

##############################################################################

# users 테이블 관련 함수수















# 마지막 로그인 시간 업데이트
def update_last_login(user_id):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute('''
            UPDATE users SET last_login = ? WHERE id = ?
        ''', (datetime.now().isoformat(), user_id))

        conn.commit()
        conn.close()
    except Exception as e:
        print(f"로그인 시간 업데이트 오류: {e}")





# 사용자에게 할당된 로봇 목록 조회
def get_user_robots(user_id):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT robot_id FROM user_robot_assignments
            WHERE user_id = ? AND is_active = TRUE
        ''', (user_id,))

        rows = cursor.fetchall()
        conn.close()

        return [row[0] for row in rows]
    except Exception as e:
        print(f"사용자 로봇 조회 오류: {e}")
        return []

# 사용자에게 로봇 할당
def assign_robot_to_user(user_id, robot_id):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # 기존 할당 비활성화
        cursor.execute('''
            UPDATE user_robot_assignments
            SET is_active = FALSE
            WHERE user_id = ? AND robot_id = ?
        ''', (user_id, robot_id))

        # 새 할당 생성
        cursor.execute('''
            INSERT INTO user_robot_assignments (user_id, robot_id)
            VALUES (?, ?)
        ''', (user_id, robot_id))

        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"로봇 할당 오류: {e}")
        return False

# 데이터베이스에서 로봇 이름 조회
def get_robot_name_from_db(robot_id):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # user_robot_assignments 테이블에서 로봇 ID로 할당된 사용자 찾기
        cursor.execute('''
            SELECT ura.robot_id, ura.assigned_at
            FROM user_robot_assignments ura
            WHERE ura.robot_id = ? AND ura.is_active = TRUE
            ORDER BY ura.assigned_at DESC
            LIMIT 1
        ''', (robot_id,))

        row = cursor.fetchone()
        conn.close()

        if row:
            # 로봇 ID를 기반으로 기본 이름 생성
            return f"Robot {robot_id[:8]}"
        return f"Robot {robot_id[:8]}"
    except Exception as e:
        print(f"로봇 이름 조회 오류: {e}")
        return f"Robot {robot_id[:8]}"


















# 로봇을 데이터베이스에 등록 (사용자 할당 없이)
def append_robot_to_db(robot_id, robot_name):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT id FROM user_robot_assignments
            WHERE robot_id = ? AND user_id = 0
        ''', (robot_id,))

        existing_robot = cursor.fetchone()

        if existing_robot:
            cursor.execute('''
                UPDATE user_robot_assignments
                SET robot_name = ?, assigned_at = CURRENT_TIMESTAMP
                WHERE robot_id = ? AND user_id = 0
            ''', (robot_name, robot_id))
            print(f"로봇 정보 업데이트: {robot_name} (ID: {robot_id})")
        else:
            cursor.execute('''
                INSERT INTO user_robot_assignments (robot_name, robot_id, is_active)
                VALUES (?, ?, FALSE)
            ''', (robot_name, robot_id))
            print(f"새 로봇 등록: {robot_name} (ID: {robot_id})")

        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"로봇 등록 오류: {e}")
        return False

# 사용자에게 로봇 할당 (로봇 이름으로 찾아서 할당)
def assign_robot_to_user(user_id, robot_name):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # 해당 로봇 이름으로 등록된 로봇 찾기 (사용자에게 할당되지 않은 것)
        cursor.execute('''
            SELECT robot_id FROM user_robot_assignments
            WHERE robot_name = ? AND (user_id IS NULL OR user_id = 0) AND is_active = FALSE
            ORDER BY assigned_at DESC
            LIMIT 1
        ''', (robot_name,))

        robot_record = cursor.fetchone()

        if not robot_record:
            conn.close()
            return False, f"사용 가능한 로봇을 찾을 수 없습니다: {robot_name}"

        robot_id = robot_record[0]

        # 기존 사용자의 다른 로봇 할당 비활성화
        cursor.execute('''
            UPDATE user_robot_assignments
            SET is_active = FALSE
            WHERE user_id = ? AND is_active = TRUE
        ''', (user_id,))

        # 해당 로봇을 사용자에게 할당
        cursor.execute('''
            UPDATE user_robot_assignments
            SET user_id = ?, is_active = TRUE, assigned_at = CURRENT_TIMESTAMP
            WHERE robot_id = ? AND robot_name = ?
        ''', (user_id, robot_id, robot_name))

        conn.commit()
        conn.close()
        return True, f"로봇 {robot_name}이 사용자 {user_id}에게 할당되었습니다"

    except Exception as e:
        return False, f"로봇 할당 오류: {e}"

def is_robot_exist(robot_id):
    """로봇이 데이터베이스에 존재하는지 확인"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT id FROM user_robot_assignments
            WHERE robot_id = ?
        ''', (robot_id,))

        existing_robot = cursor.fetchone()
        conn.close()

        return existing_robot is not None

    except Exception as e:
        print(f"로봇 존재 확인 오류: {e}")
        return False