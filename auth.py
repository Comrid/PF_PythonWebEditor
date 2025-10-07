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
    """게스트 사용자 모델"""
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

def hash_password(password):
    """비밀번호 해시화"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password, password_hash):
    """비밀번호 검증"""
    return hash_password(password) == password_hash

def get_user_by_id(user_id):
    """ID로 사용자 조회"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT id, username, email, role FROM users WHERE id = ?
        ''', (user_id,))

        row = cursor.fetchone()
        conn.close()

        if row:
            return User(row[0], row[1], row[2], row[3])
        return None
    except Exception as e:
        print(f"사용자 조회 오류: {e}")
        return None

def get_user_by_username(username):
    """사용자명으로 사용자 조회"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT id, username, email, role FROM users WHERE username = ?
        ''', (username,))

        row = cursor.fetchone()
        conn.close()

        if row:
            return User(row[0], row[1], row[2], row[3])
        return None
    except Exception as e:
        print(f"사용자 조회 오류: {e}")
        return None

def authenticate_user(username, password):
    """사용자 인증"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT id, username, email, role, password_hash FROM users WHERE username = ?
        ''', (username,))

        row = cursor.fetchone()
        conn.close()

        if row and verify_password(password, row[4]):
            # 마지막 로그인 시간 업데이트
            update_last_login(row[0])
            return User(row[0], row[1], row[2], row[3])
        return None
    except Exception as e:
        print(f"사용자 인증 오류: {e}")
        return None

def update_last_login(user_id):
    """마지막 로그인 시간 업데이트"""
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

def create_user(username, password, email=None, role='user'):
    """새 사용자 생성"""
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

def get_user_robots(user_id):
    """사용자에게 할당된 로봇 목록 조회"""
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

def assign_robot_to_user(user_id, robot_id):
    """사용자에게 로봇 할당"""
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

def get_robot_name_from_db(robot_id):
    """데이터베이스에서 로봇 이름 조회"""
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
