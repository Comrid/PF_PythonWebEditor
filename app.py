#TODO 중앙 서버 + 로봇 클라이언트 아키텍처

from __future__ import annotations
from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_socketio import SocketIO, emit
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from secrets import token_hex
import psutil
import requests
import time
import sqlite3
from datetime import datetime

from blueprints.custom_code_bp import custom_code_bp
from blueprints.tutorial_bp import tutorial_bp
from auth import *
from pathlib import Path

# 데이터베이스 경로
DB_PATH = Path(__file__).parent / "static" / "db" / "auth.db"

import threading

app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['SECRET_KEY'] = token_hex(32)
app.register_blueprint(custom_code_bp)
app.register_blueprint(tutorial_bp)

# Flask-Login 초기화
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = '로그인이 필요합니다.'
login_manager.login_message_category = 'info'

@login_manager.user_loader
def load_user(user_id):
    from auth import get_user_by_id
    return get_user_by_id(user_id)


socketio = SocketIO(
    app,                                    # Flask 애플리케이션 인스턴스
    cors_allowed_origins="*",               # CORS 설정 - 모든 도메인 허용
    async_mode='threading',                 # 비동기 모드 - 스레딩 사용
    logger=False,                           # SocketIO 로거 비활성화
    engineio_logger=False,                  # Engine.IO 로거 비활성화
    ping_timeout=60,                        # 핑 타임아웃 60초
    ping_interval=25,                       # 핑 간격 25초
    transports=['websocket', 'polling'],    # 전송 방식 설정
    allow_upgrades=True
)

# 중앙 서버 상태 관리
running_threads: dict[str, threading.Thread] = {}           # 실행 중인 스레드를 추적하는 딕셔너리
stop_flags: dict[str, bool] = {}                            # 실행 중지 플래그를 추적하는 딕셔너리
gesture_states: dict[str, dict[str, dict[str, float]]] = {} # 제스처 최신 상태 저장: 세션별 → 위젯별
pid_states: dict[str, dict[str, dict[str, float]]] = {}     # PID 최신 값 저장: 세션별 → 위젯ID별 {p,i,d}
slider_states: dict[str, dict[str, list[float]]] = {}       # Slider 최신 값 저장: 세션별 → 위젯ID별 [values]

# 로봇 관리 시스템
registered_robots: dict[str, dict] = {}                      # 등록된 로봇 정보: robot_id → {name, url, status, last_seen}
user_robot_mapping: dict[str, str] = {}                      # 사용자 세션 → 로봇 ID 매핑
robot_heartbeats: dict[str, float] = {}                      # 로봇 하트비트: robot_id → timestamp

# 세션 관리 시스템
session_user_mapping: dict[str, dict] = {}                   # 세션 ID → 사용자 정보 매핑






@app.route('/')
@login_required
def index():
    return render_template('first.html')

@app.route('/login')
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/editor')
@login_required
def editor():
    return render_template('index.html',
                         user_id=current_user.id,
                         username=current_user.username,
                         email=current_user.email,
                         role=current_user.role)

@app.route('/tutorial')
@login_required
def tutorial():
    return render_template('tutorial.html')

@app.route('/admin')
@login_required
def admin():
    """관리자 페이지 - 현재 접속한 사용자, 세션, 로봇 정보 표시"""
    return render_template('admin.html',
                         user_id=current_user.id,
                         username=current_user.username,
                         email=current_user.email,
                         role=current_user.role)

#region Authentication API
@app.route('/api/auth/login', methods=['POST'])
def api_login():
    """사용자 로그인"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({"error": "사용자명과 비밀번호를 입력해주세요."}), 400

        user = authenticate_user(username, password)
        if user:
            login_user(user)
            return jsonify({
                "success": True,
                "message": "로그인 성공",
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "role": user.role
                }
            })
        else:
            return jsonify({"error": "사용자명 또는 비밀번호가 올바르지 않습니다."}), 401

    except Exception as e:
        print(f"로그인 오류: {e}")
        return jsonify({"error": "로그인 중 오류가 발생했습니다."}), 500

@app.route('/api/auth/register', methods=['POST'])
def api_register():
    """사용자 회원가입"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        email = data.get('email')

        if not username or not password:
            return jsonify({"error": "사용자명과 비밀번호를 입력해주세요."}), 400

        if len(password) < 6:
            return jsonify({"error": "비밀번호는 6자 이상이어야 합니다."}), 400

        user = create_user(username, password, email)
        if user:
            return jsonify({
                "success": True,
                "message": "회원가입 성공"
            })
        else:
            return jsonify({"error": "이미 존재하는 사용자명입니다."}), 409

    except Exception as e:
        print(f"회원가입 오류: {e}")
        return jsonify({"error": "회원가입 중 오류가 발생했습니다."}), 500

@app.route('/api/auth/user', methods=['GET'])
@login_required
def api_get_user():
    """현재 사용자 정보 조회"""
    return jsonify({
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role
    })

@app.route('/api/sessions', methods=['GET'])
@login_required
def get_active_sessions():
    """활성 세션 목록 조회 (관리자만)"""
    if current_user.role != 'admin':
        return jsonify({"error": "관리자 권한이 필요합니다"}), 403

    sessions = []
    for sid, user_info in session_user_mapping.items():
        robot_id = user_robot_mapping.get(sid)
        sessions.append({
            "session_id": sid,
            "user": user_info,
            "assigned_robot": robot_id,
            "robot_online": robot_id in registered_robots if robot_id else False
        })

    return jsonify(sessions)

@app.route('/api/admin/status', methods=['GET'])
@login_required
def get_admin_status():
    """관리자 페이지용 전체 상태 정보 조회"""
    try:
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
            if robot_id in robot_heartbeats:
                last_seen = robot_heartbeats[robot_id]
                is_robot_online = (current_time - last_seen) < 30
                robot_last_seen = datetime.fromtimestamp(last_seen).isoformat()

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
                last_seen = robot_heartbeats.get(robot_id, 0)
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

#region Robot Management API
@app.route('/api/robots', methods=['GET'])
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
            if robot_id in registered_robots:
                robot_info = registered_robots[robot_id]
                last_seen = robot_heartbeats.get(robot_id, 0)
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
                "hardware_enabled": hardware_enabled
            })

        print(f"사용자 {current_user.username}에게 반환할 로봇 목록: {len(robots)}개")
        return jsonify(robots)
    except Exception as e:
        print(f"로봇 목록 조회 오류: {e}")
        return jsonify([])

@app.route('/api/robot/register', methods=['POST'])
def register_robot_simple():
    """로봇 등록 (app_wifi.py에서 호출)"""
    try:
        data = request.get_json()
        robot_id = data.get('robot_id')
        robot_name = data.get('robot_name')
        status = data.get('status', 'available')
        user_id = data.get('user_id')  # 선택적 사용자 ID

        if not robot_id or not robot_name:
            return jsonify({"success": False, "error": "robot_id와 robot_name이 필요합니다"}), 400

        # 로봇 등록 (SocketIO 전용)
        # 실제 로봇은 SocketIO로 연결되므로 URL은 None으로 설정
        registered_robots[robot_id] = {
            "name": robot_name,
            "url": None,  # SocketIO 연결된 로봇은 URL이 None
            "status": status,
            "created_at": datetime.now().isoformat(),
            "session_id": None  # SocketIO 세션 ID는 연결 시 설정됨
        }

        # 하트비트 초기화
        robot_heartbeats[robot_id] = time.time()

        # 사용자 ID가 제공된 경우 자동 할당
        if user_id:
            assign_robot_to_user(user_id, robot_id)
            print(f"로봇 등록 및 사용자 할당됨: {robot_name} (ID: {robot_id}) -> 사용자 {user_id}")
        else:
            print(f"로봇 등록됨: {robot_name} (ID: {robot_id}) - 사용자 할당 필요")

        return jsonify({
            "success": True,
            "message": f"로봇 {robot_name}이 등록되었습니다",
            "robot_id": robot_id,
            "needs_assignment": user_id is None
        })

    except Exception as e:
        print(f"로봇 등록 오류: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/robot/assign', methods=['POST'])
@login_required
def assign_robot():
    """로봇을 현재 사용자에게 할당"""
    try:
        data = request.get_json()
        robot_name = data.get('robot_name')

        if not robot_name:
            return jsonify({"success": False, "error": "로봇 이름이 필요합니다"}), 400

        # 등록된 로봇 중에서 이름으로 찾기
        robot_id = None
        for rid, robot_info in registered_robots.items():
            if robot_info.get('name') == robot_name:
                robot_id = rid
                break

        if not robot_id:
            return jsonify({"success": False, "error": f"로봇 '{robot_name}'을 찾을 수 없습니다"}), 404

        # 사용자에게 로봇 할당
        if assign_robot_to_user(current_user.id, robot_id):
            return jsonify({
                "success": True,
                "message": f"로봇 '{robot_name}'이 할당되었습니다",
                "robot_id": robot_id
            })
        else:
            return jsonify({"success": False, "error": "로봇 할당에 실패했습니다"}), 500

    except Exception as e:
        print(f"로봇 할당 오류: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/robots/register', methods=['POST'])
def register_robot():
    """새 로봇 등록 (기존 호환성)"""
    try:
        data = request.get_json()
        robot_id = data.get('robot_id')
        robot_name = data.get('robot_name')
        robot_url = data.get('robot_url')

        if not all([robot_id, robot_name, robot_url]):
            return jsonify({"success": False, "error": "robot_id, robot_name, robot_url이 모두 필요합니다"}), 400

        # 로봇 등록
        registered_robots[robot_id] = {
            "name": robot_name,
            "url": robot_url,
            "status": "offline",
            "last_seen": None,
            "registered_at": datetime.now().isoformat()
        }

        # 하트비트 초기화
        robot_heartbeats[robot_id] = 0

        return jsonify({"success": True, "message": f"로봇 {robot_name}이 등록되었습니다"})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/robots/<robot_id>', methods=['DELETE'])
def unregister_robot(robot_id):
    """로봇 등록 해제"""
    try:
        if robot_id in registered_robots:
            del registered_robots[robot_id]
            robot_heartbeats.pop(robot_id, None)

            # 해당 로봇을 사용하는 사용자 세션 정리
            sessions_to_remove = [sid for sid, rid in user_robot_mapping.items() if rid == robot_id]
            for sid in sessions_to_remove:
                user_robot_mapping.pop(sid, None)

            return jsonify({"success": True, "message": f"로봇 {robot_id}이 등록 해제되었습니다"})
        else:
            return jsonify({"success": False, "error": "로봇을 찾을 수 없습니다"}), 404

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/robots/<robot_id>/heartbeat', methods=['POST'])
def robot_heartbeat(robot_id):
    """로봇 하트비트 업데이트"""
    try:
        if robot_id in registered_robots:
            robot_heartbeats[robot_id] = time.time()
            registered_robots[robot_id]['last_seen'] = datetime.now().isoformat()
            return jsonify({"success": True})
        else:
            return jsonify({"success": False, "error": "등록되지 않은 로봇입니다"}), 404

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/robots/<robot_id>/assign', methods=['POST'])
@login_required
def assign_robot_to_session(robot_id):
    """사용자에게 로봇 할당"""
    try:
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

@app.route('/api/robots/<robot_id>/delete', methods=['DELETE'])
@login_required
def delete_robot(robot_id):
    """로봇 삭제 (관리자만)"""
    try:
        # 관리자 권한 확인
        if current_user.role != 'admin':
            return jsonify({"success": False, "error": "관리자 권한이 필요합니다"}), 403

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
        
        # 하트비트에서 제거
        robot_heartbeats.pop(robot_id, None)

        # 해당 로봇을 사용하는 사용자 세션 정리
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

@app.route('/api/robot/emit/image', methods=['POST'])
def robot_emit_image():
    """로봇에서 이미지 데이터 수신 및 중계"""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        image_data = data.get('image_data')
        widget_id = data.get('widget_id')

        if not all([session_id, image_data, widget_id]):
            return jsonify({"success": False, "error": "필수 필드가 누락되었습니다"}), 400

        # 브라우저로 이미지 데이터 중계
        relay_image_data({
            'i': image_data,
            'w': widget_id
        }, session_id)

        return jsonify({"success": True})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/robot/emit/text', methods=['POST'])
def robot_emit_text():
    """로봇에서 텍스트 데이터 수신 및 중계"""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        text = data.get('text')
        widget_id = data.get('widget_id')

        if not all([session_id, text, widget_id]):
            return jsonify({"success": False, "error": "필수 필드가 누락되었습니다"}), 400

        # 브라우저로 텍스트 데이터 중계
        relay_text_data({
                'text': text,
                'widget_id': widget_id
        }, session_id)

        return jsonify({"success": True})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/robot/stdout', methods=['POST'])
def robot_stdout():
    """로봇에서 stdout 데이터 수신 및 중계"""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        output = data.get('output')

        if not all([session_id, output]):
            return jsonify({"success": False, "error": "필수 필드가 누락되었습니다"}), 400

        # 브라우저로 stdout 데이터 중계
        relay_stdout_data({'output': output}, session_id)

        return jsonify({"success": True})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/robot/stderr', methods=['POST'])
def robot_stderr():
    """로봇에서 stderr 데이터 수신 및 중계"""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        output = data.get('output')

        if not all([session_id, output]):
            return jsonify({"success": False, "error": "필수 필드가 누락되었습니다"}), 400

        # 브라우저로 stderr 데이터 중계
        relay_stderr_data({'output': output}, session_id)

        return jsonify({"success": True})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/robot/finished', methods=['POST'])
def robot_finished():
    """로봇에서 finished 데이터 수신 및 중계"""
    try:
        data = request.get_json()
        session_id = data.get('session_id')

        if not session_id:
            return jsonify({"success": False, "error": "session_id가 필요합니다"}), 400

        # 브라우저로 finished 데이터 중계
        relay_finished_data({}, session_id)

        return jsonify({"success": True})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
#endregion

#region Code Execution
def execute_code_on_robot(code: str, sid: str, robot_id: str, user_info: dict = None):
    """로봇에 코드 실행 요청 전송"""
    try:
        # 할당된 로봇 확인
        if robot_id not in registered_robots:
            socketio.emit('execution_error', {'error': '할당된 로봇을 찾을 수 없습니다.'}, room=sid)
            return

        robot_info = registered_robots[robot_id]

        # 사용자 정보 준비
        user_data = {
            'user_id': user_info.get('user_id') if user_info else None,
            'username': user_info.get('username', 'Unknown') if user_info else 'Unknown',
            'email': user_info.get('email') if user_info else None,
            'role': user_info.get('role', 'user') if user_info else 'user'
        }

        # SocketIO 연결된 로봇인지 확인
        if robot_info.get('url') is None:
            # SocketIO로 직접 전송 (로봇 클라이언트의 세션 ID 사용)
            robot_session_id = robot_info.get('session_id')
            if robot_session_id:
                socketio.emit('execute_code', {
                    'code': code,
                    'session_id': sid,
                    'user_info': user_data
                }, room=robot_session_id)
                socketio.emit('execution_started', {
                    'message': f'로봇 {robot_id}에서 코드 실행을 시작합니다...',
                    'user': user_data['username']
                }, room=sid)
            else:
                socketio.emit('execution_error', {'error': '로봇 클라이언트의 세션 ID를 찾을 수 없습니다.'}, room=sid)
        else:
            # HTTP API로 전송 (기존 방식)
            robot_url = robot_info['url']
            response = requests.post(
                f"{robot_url}/execute",
                json={
                    'code': code,
                    'session_id': sid
                },
                timeout=30
            )

            if response.status_code == 200:
                socketio.emit('execution_started', {'message': f'로봇 {robot_id}에서 코드 실행을 시작합니다...'}, room=sid)
            else:
                socketio.emit('execution_error', {'error': f'로봇 실행 요청 실패: {response.text}'}, room=sid)

    except requests.exceptions.RequestException as e:
        socketio.emit('execution_error', {'error': f'로봇 통신 오류: {str(e)}'}, room=sid)
    except Exception as e:
        socketio.emit('execution_error', {'error': f'코드 실행 중 오류가 발생했습니다: {str(e)}'}, room=sid)

def relay_image_data(data: dict, session_id: str):
    """로봇에서 받은 이미지 데이터를 브라우저로 중계"""
    try:
        socketio.emit('image_data', data, room=session_id)
    except Exception as e:
        print(f"DEBUG: 이미지 데이터 중계 실패: {e}")

def relay_text_data(data: dict, session_id: str):
    """로봇에서 받은 텍스트 데이터를 브라우저로 중계"""
    try:
        socketio.emit('text_data', data, room=session_id)
    except Exception as e:
        print(f"DEBUG: 텍스트 데이터 중계 실패: {e}")

def relay_stdout_data(data: dict, session_id: str):
    """로봇에서 받은 stdout 데이터를 브라우저로 중계"""
    try:
        socketio.emit('stdout', data, room=session_id)
    except Exception as e:
        print(f"DEBUG: stdout 데이터 중계 실패: {e}")

def relay_stderr_data(data: dict, session_id: str):
    """로봇에서 받은 stderr 데이터를 브라우저로 중계"""
    try:
        socketio.emit('stderr', data, room=session_id)
    except Exception as e:
        print(f"DEBUG: stderr 데이터 중계 실패: {e}")

def relay_finished_data(data: dict, session_id: str):
    """로봇에서 받은 finished 데이터를 브라우저로 중계"""
    try:
        socketio.emit('finished', data, room=session_id)
    except Exception as e:
        print(f"DEBUG: finished 데이터 중계 실패: {e}")

@socketio.on('execute_code')
def handle_execute_code(data):
    try:
        code = data.get('code', '')
        if not code:
            emit('execution_error', {'error': '코드가 제공되지 않았습니다.'})
            return

        # 현재 세션 ID 가져오기
        sid = request.sid

        # 현재 사용자 정보 가져오기
        user_info = session_user_mapping.get(sid, {})
        user_id = user_info.get('user_id')
        username = user_info.get('username', 'Unknown')

        print(f"사용자 {username} (ID: {user_id})이 코드 실행을 요청했습니다.")

        # 할당된 로봇 확인
        robot_id = user_robot_mapping.get(sid)
        if not robot_id:
            emit('execution_error', {'error': '로봇이 할당되지 않았습니다. 먼저 로봇을 선택하세요.'})
            return

        # 로봇에 코드 실행 요청 전송 (사용자 정보 포함)
        execute_code_on_robot(code, sid, robot_id, user_info)

    except Exception as e:
        emit('execution_error', {'error': f'코드 실행 중 오류가 발생했습니다: {str(e)}'})

@socketio.on('stop_execution')
def handle_stop_execution():
    """실행 중인 코드를 중지"""
    try:
        sid = request.sid
        thread = running_threads.get(sid, None)

        if thread is None:
            socketio.emit('execution_error', {'error': '실행 중인 코드가 없습니다.'}, room=sid)
            return

        # 1단계: 중지 플래그 설정 (안전한 종료 시도)
        stop_flags[sid] = True

        if thread.is_alive():
            # 안전하게 스레드에 예외를 주입하는 헬퍼 (라즈베리파이 포함 호환)
            def raise_in_thread(thread, exc_type = SystemExit):
                import ctypes
                if thread is None or not thread.is_alive():
                    return False

                func = ctypes.pythonapi.PyThreadState_SetAsyncExc
                func.argtypes = [ctypes.c_ulong, ctypes.py_object]
                func.restype = ctypes.c_int

                tid = ctypes.c_ulong(thread.ident)
                res = func(tid, ctypes.py_object(exc_type))

                if res > 1:
                    func(tid, ctypes.py_object(0))
                    return False

                return res == 1
            # 강제 종료 실행 (안전 헬퍼 사용)
            ok = raise_in_thread(thread, SystemExit)

            thread.join(timeout=2.0)  # 2초 대기

            if thread.is_alive():
                print(f"DEBUG: 강제 종료 후에도 스레드가 살아있음")
                socketio.emit('execution_stopped', {
                    'message': '코드 실행 중지 요청이 완료되었습니다.',
                    'warning': '스레드가 완전히 종료되지 않았을 수 있습니다.'
                }, room=sid)
            else:
                print(f"DEBUG: 강제 종료 성공")
                socketio.emit('execution_stopped', {'message': '코드 실행이 중지되었습니다.'}, room=sid)
        else:
            socketio.emit('execution_stopped', {'message': '코드 실행이 중지되었습니다.'}, room=sid)

        # 최종 정리: 스레드가 실제로 종료된 경우에만 정리 (그 외에는 execute_code()의 finally에 위임)
        try:
            if not thread.is_alive():
                running_threads.pop(sid, None)
                stop_flags.pop(sid, None)
        except Exception:
            pass

    except Exception as e:
        print(f"DEBUG: 스레드 중지 중 오류: {str(e)}")
        socketio.emit('execution_error', {'error': f'코드 중지 중 오류가 발생했습니다: {str(e)}'})
#endregion

#region SocketIO connect/disconnect
@socketio.on('connect')
def handle_connect():
    print('클라이언트가 연결되었습니다.')

    # 사용자가 로그인되어 있는 경우
    if current_user.is_authenticated:
        try:
            # 세션-사용자 매핑 저장
            session_user_mapping[request.sid] = {
                'user_id': current_user.id,
                'username': current_user.username,
                'email': current_user.email,
                'role': current_user.role
            }
            print(f"세션 {request.sid}에 사용자 {current_user.username} (ID: {current_user.id}) 매핑")

            # 자동 할당 비활성화 - 사용자가 직접 선택하도록 함
            print(f"사용자 {current_user.username}의 로봇 할당은 에디터에서 직접 선택해야 합니다.")
        except Exception as e:
            print(f"사용자 로봇 매핑 오류: {e}")
    else:
        print(f"세션 {request.sid}에 로그인되지 않은 사용자 연결")

    emit('connected', {'message': '서버에 연결되었습니다.'})

@socketio.on('disconnect')
def handle_disconnect():
    print('클라이언트가 연결을 해제했습니다.')

    # 연결 해제 시 실행 중인 스레드 정리
    sid = request.sid

    # 세션-사용자 매핑 정리
    if sid in session_user_mapping:
        user_info = session_user_mapping.pop(sid)
        print(f"세션 {sid}에서 사용자 {user_info['username']} (ID: {user_info['user_id']}) 매핑 제거")

    # 세션-로봇 매핑 정리
    if sid in user_robot_mapping:
        robot_id = user_robot_mapping.pop(sid)
        print(f"세션 {sid}에서 로봇 {robot_id} 매핑 제거")

    # 메인 프로세스 스레드 정리
    if sid in running_threads:
        try:
            stop_flags[sid] = True
            running_threads.pop(sid, None)
            stop_flags.pop(sid, None)
        except Exception:
            pass
#endregion

# Gesture updates from frontend
@socketio.on('gesture_update')
def handle_gesture_update(data):
    sid = request.sid
    data = data.get('data')
    if data: gesture_states[sid] = data

# PID updates from frontend
@socketio.on('pid_update')
def handle_pid_update(payload):
    sid = request.sid
    try:
        widget_id = payload.get('widget_id')
        p = float(payload.get('p', 0.0))
        i = float(payload.get('i', 0.0))
        d = float(payload.get('d', 0.0))
    except Exception:
        return
    if not widget_id:
        return
    session_map = pid_states.get(sid)
    if session_map is None:
        session_map = {}
        pid_states[sid] = session_map
    session_map[widget_id] = {'p': p, 'i': i, 'd': d}

# Slider updates from frontend
@socketio.on('slider_update')
def handle_slider_update(payload):
    sid = request.sid
    try:
        widget_id = payload.get('widget_id')
        values = payload.get('values')
        if not isinstance(values, list):
            return
        values = [float(v) for v in values]
    except Exception:
        return
    if not widget_id:
        return
    session_map = slider_states.get(sid)
    if session_map is None:
        session_map = {}
        slider_states[sid] = session_map
    session_map[widget_id] = values

#region Robot Client SocketIO Events
@socketio.on('robot_connected')
def handle_robot_connected(data):
    """로봇 클라이언트 연결 처리"""
    try:
        robot_id = data.get('robot_id')
        robot_name = data.get('robot_name')
        hardware_enabled = data.get('hardware_enabled', False)

        print(f"🤖 로봇 클라이언트 연결됨: {robot_name} (ID: {robot_id})")

        # 로봇 등록 (SocketIO 연결 시)
        registered_robots[robot_id] = {
            "name": robot_name,
            "url": None,  # SocketIO 연결이므로 URL 불필요
            "status": "online",
            "hardware_enabled": hardware_enabled,
            "connected_at": datetime.now().isoformat(),
            "session_id": request.sid  # 로봇 클라이언트의 세션 ID 저장
        }

        # 하트비트 초기화
        robot_heartbeats[robot_id] = time.time()

        # 연결 확인 응답
        emit('robot_registered', {
            'success': True,
            'message': f'로봇 {robot_name}이 등록되었습니다',
            'robot_id': robot_id
        })

    except Exception as e:
        print(f"로봇 연결 처리 오류: {e}")
        emit('robot_registered', {
            'success': False,
            'error': str(e)
        })

@socketio.on('robot_disconnected')
def handle_robot_disconnected(data):
    """로봇 클라이언트 연결 해제 처리"""
    try:
        robot_id = data.get('robot_id')
        if robot_id in registered_robots:
            print(f"🤖 로봇 클라이언트 연결 해제됨: {robot_id}")
            registered_robots[robot_id]['status'] = 'offline'
            # 세션 ID 정리
            registered_robots[robot_id].pop('session_id', None)

            # 해당 로봇을 사용하는 사용자 세션 정리
            sessions_to_remove = [sid for sid, rid in user_robot_mapping.items() if rid == robot_id]
            for sid in sessions_to_remove:
                user_robot_mapping.pop(sid, None)
                print(f"사용자 세션 {sid}에서 로봇 {robot_id} 할당 해제")

    except Exception as e:
        print(f"로봇 연결 해제 처리 오류: {e}")

@socketio.on('robot_heartbeat')
def handle_robot_heartbeat(data):
    """로봇 하트비트 처리"""
    try:
        robot_id = data.get('robot_id')
        status = data.get('status', 'online')

        if robot_id in registered_robots:
            robot_heartbeats[robot_id] = time.time()
            registered_robots[robot_id]['status'] = status
            registered_robots[robot_id]['last_seen'] = datetime.now().isoformat()

    except Exception as e:
        print(f"로봇 하트비트 처리 오류: {e}")

@socketio.on('robot_emit_image')
def handle_robot_emit_image(data):
    """로봇에서 이미지 데이터 수신 및 중계"""
    try:
        session_id = data.get('session_id')
        image_data = data.get('image_data')
        widget_id = data.get('widget_id')

        if not all([session_id, image_data, widget_id]):
            return

        # 브라우저로 이미지 데이터 중계
        relay_image_data({
            'i': image_data,
            'w': widget_id
        }, session_id)

    except Exception as e:
        print(f"로봇 이미지 데이터 중계 오류: {e}")

@socketio.on('robot_emit_text')
def handle_robot_emit_text(data):
    """로봇에서 텍스트 데이터 수신 및 중계"""
    try:
        session_id = data.get('session_id')
        text = data.get('text')
        widget_id = data.get('widget_id')

        if not all([session_id, text, widget_id]):
            return

        # 브라우저로 텍스트 데이터 중계
        relay_text_data({
            'text': text,
            'widget_id': widget_id
        }, session_id)

    except Exception as e:
        print(f"로봇 텍스트 데이터 중계 오류: {e}")

@socketio.on('robot_stdout')
def handle_robot_stdout(data):
    """로봇에서 stdout 데이터 수신 및 중계"""
    try:
        session_id = data.get('session_id')
        output = data.get('output')

        if not all([session_id, output]):
            return

        # 브라우저로 stdout 데이터 중계
        relay_stdout_data({'output': output}, session_id)

    except Exception as e:
        print(f"로봇 stdout 데이터 중계 오류: {e}")

@socketio.on('robot_stderr')
def handle_robot_stderr(data):
    """로봇에서 stderr 데이터 수신 및 중계"""
    try:
        session_id = data.get('session_id')
        output = data.get('output')

        if not all([session_id, output]):
            return

        # 브라우저로 stderr 데이터 중계
        relay_stderr_data({'output': output}, session_id)

    except Exception as e:
        print(f"로봇 stderr 데이터 중계 오류: {e}")

@socketio.on('robot_finished')
def handle_robot_finished(data):
    """로봇에서 finished 데이터 수신 및 중계"""
    try:
        session_id = data.get('session_id')
        output = data.get('output', '실행 완료')

        if not session_id:
            return

        # 브라우저로 finished 데이터 중계
        relay_finished_data({'output': output}, session_id)

    except Exception as e:
        print(f"로봇 finished 데이터 중계 오류: {e}")
#endregion







@app.route("/api/cpu-usage")
def api_cpu_usage():
    """CPU 사용량 정보 반환"""
    try:
        # 전체 CPU 사용량 (평균)
        cpu_percent = psutil.cpu_percent(interval=0.1, percpu=False)

        # 개별 CPU 스레드 사용량
        cpu_percent_per_cpu = psutil.cpu_percent(interval=0.1, percpu=True)

        # CPU 개수
        cpu_count = psutil.cpu_count()

        return jsonify({
            "success": True,
            "cpu_percent": cpu_percent,
            "cpu_percent_per_cpu": cpu_percent_per_cpu,
            "cpu_count": cpu_count
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# AI-Chat은 이제 JavaScript에서 직접 처리됩니다 (llm.js 사용)









if __name__ == '__main__':
    socketio.run(app, debug=False, host='0.0.0.0', allow_unsafe_werkzeug=True, port=5000)