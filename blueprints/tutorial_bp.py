from flask import Blueprint, request, jsonify
from pathlib import Path
import sqlite3

# Blueprint 생성
tutorial_bp = Blueprint('tutorial_bp', __name__, url_prefix='/api/tutorial')

# 절대 경로로 변경
TUTORIAL_DB_PATH = Path(__file__).parent.parent / "static" / "db" / "tutorial.db"

def db_tutorial_init():
    """튜토리얼 데이터베이스 초기화"""
    conn = sqlite3.connect(TUTORIAL_DB_PATH)
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tutorial_progress (
            tutorial_id TEXT PRIMARY KEY,
            completed BOOLEAN NOT NULL,
            completed_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    conn.commit()
    conn.close()

# Blueprint 생성 시 데이터베이스 초기화
def init_tutorial_db():
    """튜토리얼 데이터베이스 초기화"""
    db_tutorial_init()

# Blueprint 등록 시 자동으로 데이터베이스 초기화
init_tutorial_db()



@tutorial_bp.route("/progress", methods=["GET"])
def api_tutorial_progress_get():
    try:
        conn = sqlite3.connect(TUTORIAL_DB_PATH)
        cursor = conn.cursor()

        cursor.execute('SELECT tutorial_id, completed, completed_at FROM tutorial_progress WHERE completed = 1')
        rows = cursor.fetchall()

        progress = {}
        for row in rows:
            progress[row[0]] = {
                "completed": bool(row[1]),
                "completed_at": row[2]
            }

        conn.close()
        return jsonify(progress)
    except Exception as e:
        print(f"튜토리얼 진행상황 조회 실패: {e}")
        return jsonify({"error": str(e)}), 500

@tutorial_bp.route("/progress", methods=["POST"])
def api_tutorial_progress_post():
    try:
        data = request.get_json()
        tutorial_id = data.get("tutorial_id")
        completed = data.get("completed")
        completed_at = data.get("completed_at")

        if not tutorial_id:
            return jsonify({"success": False, "error": "tutorial_id가 필요합니다"}), 400

        conn = sqlite3.connect(TUTORIAL_DB_PATH)
        cursor = conn.cursor()

        if completed:
            # 완료 상태로 저장/업데이트
            cursor.execute('''
                INSERT OR REPLACE INTO tutorial_progress (tutorial_id, completed, completed_at)
                VALUES (?, ?, ?)
            ''', (tutorial_id, 1, completed_at))
        else:
            # 미완료 상태로 변경 (삭제)
            cursor.execute('DELETE FROM tutorial_progress WHERE tutorial_id = ?', (tutorial_id,))

        conn.commit()
        conn.close()

        return jsonify({"success": True})
    except Exception as e:
        print(f"튜토리얼 진행상황 저장 실패: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@tutorial_bp.route("/reset", methods=["POST"])
def api_tutorial_reset():
    """튜토리얼 데이터베이스 완전 초기화"""
    try:
        # 데이터베이스 파일이 존재하면 삭제
        if TUTORIAL_DB_PATH.exists():
            TUTORIAL_DB_PATH.unlink()
            print(f"튜토리얼 데이터베이스 삭제됨: {TUTORIAL_DB_PATH}")

        # 데이터베이스 재생성
        db_tutorial_init()

        return jsonify({"success": True, "message": "데이터베이스가 초기화되었습니다."})
    except Exception as e:
        print(f"튜토리얼 데이터베이스 초기화 실패: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
