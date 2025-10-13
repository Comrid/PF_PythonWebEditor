"""
관리자 페이지 관련 블루프린트
"""

from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
import sqlite3
import time
from datetime import datetime
from pathlib import Path

# 데이터베이스 경로
DB_PATH = Path(__file__).parent.parent / "static" / "db" / "auth.db"

admin_bp = Blueprint('admin_bp', __name__)

# 전역 변수들을 import하기 위한 함수들
def get_global_variables():
    """전역 변수들을 가져오는 함수"""
    from app import session_user_mapping, user_robot_mapping, registered_robots
    from auth import get_robot_name_from_db
    
    return {
        'session_user_mapping': session_user_mapping,
        'user_robot_mapping': user_robot_mapping,
        'registered_robots': registered_robots,
        'get_robot_name_from_db': get_robot_name_from_db
    }

@admin_bp.route('/api/admin/status', methods=['GET'])
@login_required
def get_admin_status():
    """관리자 페이지용 전체 상태 정보 조회"""
    try:
        # 전역 변수들 가져오기
        globals_dict = get_global_variables()
        session_user_mapping = globals_dict['session_user_mapping']
        user_robot_mapping = globals_dict['user_robot_mapping']
        registered_robots = globals_dict['registered_robots']
        get_robot_name_from_db = globals_dict['get_robot_name_from_db']
        
        # 현재 시간
        current_time = time.time()

        # 활성 세션 정보
        active_sessions = []
        for sid, user_info in session_user_mapping.items():
            robot_id = user_robot_mapping.get(sid)

            # SocketIO 세션에 할당된 로봇이 없으면 데이터베이스에서 확인
            if not robot_id:
                try:
                    conn = sqlite3.connect(DB_PATH)
                    cursor = conn.cursor()
                    cursor.execute('''
                        SELECT robot_id FROM user_robot_assignments
                        WHERE user_id = ? AND is_active = TRUE
                        ORDER BY assigned_at DESC
                        LIMIT 1
                    ''', (user_info.get('user_id'),))
                    result = cursor.fetchone()
                    if result:
                        robot_id = result[0]
                    conn.close()
                except Exception as e:
                    print(f"사용자 {user_info.get('username')}의 할당된 로봇 조회 오류: {e}")

            robot_info = registered_robots.get(robot_id, {}) if robot_id else {}

            # 로봇 온라인 상태 확인
            is_robot_online = False
            robot_last_seen = None
            if robot_id in registered_robots:
                last_seen = registered_robots[robot_id].get('last_heartbeat', 0)
                is_robot_online = (current_time - last_seen) < 30
                robot_last_seen = datetime.fromtimestamp(last_seen).isoformat() if last_seen else None

            # 로봇 이름 가져오기
            robot_name = "Unknown"
            if robot_id:
                if robot_id in registered_robots:
                    robot_name = registered_robots[robot_id].get('name', f"Robot {robot_id}")
                else:
                    robot_name = get_robot_name_from_db(robot_id)

            active_sessions.append({
                "session_id": sid,
                "user": user_info,
                "assigned_robot": robot_id,
                "robot_name": robot_name,
                "robot_online": is_robot_online,
                "robot_last_seen": robot_last_seen
            })

        # 모든 로봇 정보 수집 (SocketIO 연결된 로봇 + 데이터베이스에만 있는 로봇)
        registered_robots_info = []
        all_robot_ids = set(registered_robots.keys())

        # 데이터베이스에서 모든 로봇 ID 가져오기
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute('''
                SELECT DISTINCT robot_id FROM user_robot_assignments
                WHERE is_active = TRUE
            ''')
            db_robot_ids = [row[0] for row in cursor.fetchall()]
            all_robot_ids.update(db_robot_ids)
            conn.close()
        except Exception as e:
            print(f"데이터베이스 로봇 조회 오류: {e}")

        # 모든 로봇 정보 처리
        for robot_id in all_robot_ids:
            # SocketIO 연결된 로봇인지 확인
            if robot_id in registered_robots:
                robot_info = registered_robots[robot_id]
                last_seen = robot_info.get('last_heartbeat', 0)
                is_online = (current_time - last_seen) < 30
                hardware_enabled = robot_info.get('hardware_enabled', False)
                last_seen_str = datetime.fromtimestamp(last_seen).isoformat() if last_seen else None
                robot_name = robot_info.get('name', 'Unknown')
            else:
                # 데이터베이스에만 있는 로봇
                robot_name = get_robot_name_from_db(robot_id)
                is_online = False
                hardware_enabled = False
                last_seen_str = None

            # 이 로봇을 사용하는 사용자 찾기
            assigned_users = []

            # 1. SocketIO 연결된 세션에서 할당된 사용자 찾기
            for sid, user_info in session_user_mapping.items():
                if user_robot_mapping.get(sid) == robot_id:
                    assigned_users.append(user_info)

            # 2. 데이터베이스에서 할당된 사용자 찾기 (SocketIO 연결되지 않은 사용자 포함)
            try:
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT u.id, u.username, u.email, u.role
                    FROM users u
                    JOIN user_robot_assignments ura ON u.id = ura.user_id
                    WHERE ura.robot_id = ? AND ura.is_active = TRUE
                ''', (robot_id,))

                db_assigned_users = cursor.fetchall()
                conn.close()

                # 데이터베이스에서 찾은 사용자들을 추가 (중복 제거)
                for user_row in db_assigned_users:
                    user_id, username, email, role = user_row
                    # 이미 SocketIO 세션에서 추가된 사용자가 아닌 경우만 추가
                    if not any(user.get('user_id') == user_id for user in assigned_users):
                        assigned_users.append({
                            'user_id': user_id,
                            'username': username,
                            'email': email,
                            'role': role
                        })
            except Exception as e:
                print(f"데이터베이스에서 할당된 사용자 조회 오류: {e}")

            registered_robots_info.append({
                "robot_id": robot_id,
                "name": robot_name,
                "online": is_online,
                "last_seen": last_seen_str,
                "hardware_enabled": hardware_enabled,
                "assigned_users": assigned_users
            })

        # 데이터베이스 사용자 정보
        db_users = []
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute('''
                SELECT u.id, u.username, u.email, u.role, u.created_at, u.last_login,
                       COUNT(ura.robot_id) as assigned_robots
                FROM users u
                LEFT JOIN user_robot_assignments ura ON u.id = ura.user_id AND ura.is_active = TRUE
                GROUP BY u.id, u.username, u.email, u.role, u.created_at, u.last_login
            ''')

            for row in cursor.fetchall():
                db_users.append({
                    "id": row[0],
                    "username": row[1],
                    "email": row[2],
                    "role": row[3],
                    "created_at": row[4],
                    "last_login": row[5],
                    "assigned_robots_count": row[6]
                })
            conn.close()
        except Exception as e:
            print(f"데이터베이스 사용자 조회 오류: {e}")

        return jsonify({
            "current_user": {
                "id": current_user.id,
                "username": current_user.username,
                "email": current_user.email,
                "role": current_user.role
            },
            "active_sessions": active_sessions,
            "registered_robots": registered_robots_info,
            "db_users": db_users,
            "stats": {
                "total_sessions": len(session_user_mapping),
                "total_robots": len(registered_robots_info),
                "online_robots": len([r for r in registered_robots_info if r['online']]),
                "total_db_users": len(db_users)
            }
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500