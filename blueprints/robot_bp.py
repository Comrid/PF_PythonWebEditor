"""
로봇 관리 Blueprint
"""

from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user
from datetime import datetime
import time
import sqlite3
from pathlib import Path
from auth import get_user_robots, assign_robot_to_user, get_robot_name_from_db

# Blueprint 생성
robot_bp = Blueprint('robot', __name__, url_prefix='/api')

# 데이터베이스 경로
DB_PATH = Path(__file__).parent.parent / "static" / "db" / "auth.db"

# 전역 변수들을 current_app에서 가져오는 헬퍼 함수들
def get_registered_robots():
    """등록된 로봇 딕셔너리 반환"""
    return current_app.config.get('registered_robots', {})

def get_user_robot_mapping():
    """사용자-로봇 매핑 딕셔너리 반환"""
    return current_app.config.get('user_robot_mapping', {})


def get_session_user_mapping():
    """세션-사용자 매핑 딕셔너리 반환"""
    return current_app.config.get('session_user_mapping', {})

def get_socketio():
    """SocketIO 인스턴스 반환"""
    return current_app.config.get('socketio')

#region Robot Management API
@robot_bp.route('/robots', methods=['GET'])
@login_required
def get_robots():
    """사용자에게 할당된 로봇 목록 조회"""
    try:
        current_time = time.time()
        robots = []

        # 사용자에게 할당된 로봇 ID 목록 조회
        user_robot_ids = get_user_robots(current_user.id)
        print(f"사용자 {current_user.username}의 할당된 로봇: {user_robot_ids}")

        # 할당된 로봇만 표시
        for robot_id in user_robot_ids:
            # 등록된 로봇 정보 가져오기
            registered_robots = get_registered_robots()
            if robot_id in registered_robots:
                robot_info = registered_robots[robot_id]
                last_seen = robot_info.get('last_heartbeat', 0)
                is_online = (current_time - last_seen) < 30  # 30초 이내에 하트비트가 있으면 온라인
                hardware_enabled = robot_info.get("hardware_enabled", False)
                last_seen_str = datetime.fromtimestamp(last_seen).isoformat() if last_seen else None
            else:
                # 등록되지 않은 로봇 (데이터베이스에만 있는 경우)
                robot_name = get_robot_name_from_db(robot_id)
                robot_info = {"name": robot_name}
                is_online = False
                hardware_enabled = False
                last_seen_str = None

            robots.append({
                "robot_id": robot_id,
                "name": robot_info.get("name", f"Robot {robot_id}"),
                "online": is_online,
                "assigned": True,  # 할당된 로봇만 표시하므로 항상 True
                "last_seen": last_seen_str,
                "hardware_enabled": hardware_enabled,
                "robot_version": robot_info.get("robot_version", "1.0.0"),
                "needs_update": robot_info.get("needs_update", False)
            })

        print(f"사용자 {current_user.username}에게 반환할 로봇 목록: {len(robots)}개")
        return jsonify(robots)
    except Exception as e:
        print(f"로봇 목록 조회 오류: {e}")
        return jsonify([])











@robot_bp.route('/robot/assign', methods=['POST'])
@login_required
def assign_robot():
    """로봇을 현재 사용자에게 할당"""
    try:
        data = request.get_json()
        robot_name = data.get('robot_name')

        if not robot_name:
            return jsonify({"success": False, "error": "로봇 이름이 필요합니다"}), 400

        # 사용자에게 로봇 할당 (데이터베이스에서 직접 찾아서 할당)
        success, message = assign_robot_to_user(current_user.id, robot_name)

        if success:
            return jsonify({
                "success": True,
                "message": message
            })
        else:
            return jsonify({"success": False, "error": message}), 400

    except Exception as e:
        print(f"로봇 할당 오류: {e}")
        return jsonify({"success": False, "error": str(e)}), 500














@robot_bp.route('/robots/register', methods=['POST'])
def register_robot():
    """새 로봇 등록 (기존 호환성)"""
    try:
        data = request.get_json()
        robot_id = data.get('robot_id')
        robot_name = data.get('robot_name')

        if not all([robot_id, robot_name]):
            return jsonify({"success": False, "error": "robot_id, robot_name이 모두 필요합니다"}), 400

        # 로봇 등록
        registered_robots = get_registered_robots()
        registered_robots[robot_id] = {
            "name": robot_name,
            "status": "offline",
            "last_seen": None,
            "registered_at": datetime.now().isoformat()
        }

        # 하트비트는 로봇 등록 시 자동으로 초기화됨

        return jsonify({"success": True, "message": f"로봇 {robot_name}이 등록되었습니다"})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@robot_bp.route('/robots/<robot_id>', methods=['DELETE'])
def unregister_robot(robot_id):
    """로봇 등록 해제"""
    try:
        registered_robots = get_registered_robots()
        if robot_id in registered_robots:
            del registered_robots[robot_id]

            # 해당 로봇을 사용하는 사용자 세션 정리
            user_robot_mapping = get_user_robot_mapping()
            sessions_to_remove = [sid for sid, rid in user_robot_mapping.items() if rid == robot_id]
            for sid in sessions_to_remove:
                user_robot_mapping.pop(sid, None)

            return jsonify({"success": True, "message": f"로봇 {robot_id}이 등록 해제되었습니다"})
        else:
            return jsonify({"success": False, "error": "로봇을 찾을 수 없습니다"}), 404

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@robot_bp.route('/robots/<robot_id>/assign', methods=['POST'])
@login_required
def assign_robot_to_session(robot_id):
    """사용자에게 로봇 할당"""
    try:
        registered_robots = get_registered_robots()
        # 로봇이 등록되어 있는지 확인 (SocketIO 연결된 로봇 또는 데이터베이스에 있는 로봇)
        robot_exists = robot_id in registered_robots
        if not robot_exists:
            # 데이터베이스에서 확인
            user_robot_ids = get_user_robots(current_user.id)
            robot_exists = robot_id in user_robot_ids

        if not robot_exists:
            return jsonify({"success": False, "error": "등록되지 않은 로봇입니다"}), 404

        # 사용자에게 로봇 할당
        if assign_robot_to_user(current_user.id, robot_id):
            # HTTP 요청에서는 세션 ID를 직접 가져올 수 없으므로,
            # 사용자의 모든 활성 세션에 로봇 할당
            session_user_mapping = get_session_user_mapping()
            user_robot_mapping = get_user_robot_mapping()
            user_sessions = [sid for sid, user_info in session_user_mapping.items()
                           if user_info.get('user_id') == current_user.id]

            for sid in user_sessions:
                user_robot_mapping[sid] = robot_id
                print(f"사용자 {current_user.username}의 세션 {sid}에 로봇 {robot_id} 할당")

            # 로봇 이름 가져오기
            robot_name = "Unknown"
            if robot_id in registered_robots:
                robot_name = registered_robots[robot_id].get('name', f"Robot {robot_id}")
            else:
                robot_name = get_robot_name_from_db(robot_id)

            return jsonify({
                "success": True,
                "message": f"로봇 {robot_name}이 할당되었습니다",
                "robot_id": robot_id
            })
        else:
            return jsonify({"success": False, "error": "로봇 할당에 실패했습니다"}), 500

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@robot_bp.route('/robots/<robot_id>/delete', methods=['DELETE'])
@login_required
def delete_robot(robot_id):
    """로봇 삭제 (관리자만)"""
    try:
        # 관리자 권한 확인
        if current_user.role != 'admin':
            return jsonify({"success": False, "error": "관리자 권한이 필요합니다"}), 403

        registered_robots = get_registered_robots()
        # 로봇 이름 가져오기 (등록된 로봇 또는 데이터베이스에서)
        robot_name = "Unknown"
        if robot_id in registered_robots:
            robot_name = registered_robots[robot_id].get('name', robot_id)
        else:
            # 데이터베이스에서 로봇 이름 조회
            robot_name = get_robot_name_from_db(robot_id)

        # 등록된 로봇에서 제거 (있는 경우에만)
        if robot_id in registered_robots:
            del registered_robots[robot_id]
            print(f"등록된 로봇에서 {robot_id} 제거")

        # 하트비트는 registered_robots에서 자동으로 제거됨

        # 해당 로봇을 사용하는 사용자 세션 정리
        user_robot_mapping = get_user_robot_mapping()
        sessions_to_remove = [sid for sid, rid in user_robot_mapping.items() if rid == robot_id]
        for sid in sessions_to_remove:
            user_robot_mapping.pop(sid, None)
            print(f"사용자 세션 {sid}에서 로봇 {robot_id} 할당 해제")

        # 데이터베이스에서 로봇 할당 정보 삭제
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute('''
                DELETE FROM user_robot_assignments
                WHERE robot_id = ?
            ''', (robot_id,))
            deleted_count = cursor.rowcount
            conn.commit()
            conn.close()
            print(f"데이터베이스에서 로봇 {robot_id} 할당 정보 삭제 완료 (삭제된 행: {deleted_count})")
        except Exception as e:
            print(f"데이터베이스 로봇 삭제 오류: {e}")

        return jsonify({
            "success": True,
            "message": f"로봇 {robot_name}이 삭제되었습니다",
            "robot_id": robot_id
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

