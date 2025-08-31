from flask import Blueprint, request, jsonify
from pathlib import Path

# Blueprint 생성
custom_code_bp = Blueprint('custom_code_bp', __name__, url_prefix='/api/custom-code')

# 절대 경로로 변경
CUSTOM_CODE_DIR = Path(__file__).parent.parent / "static" / "custom_code"

@custom_code_bp.route("/files")
def get_files():
    files = []
    for file_path in CUSTOM_CODE_DIR.glob("*.py"):
        files.append({
            "name": file_path.name,
            "path": str(file_path),
            "size": file_path.stat().st_size,
            "mtime": int(file_path.stat().st_mtime)
        })
    files = sorted(files, key=lambda x: x["mtime"], reverse=True)
    return jsonify({"files": files})

@custom_code_bp.route("/save", methods=["POST"])
def save_file():
    data = request.get_json()
    filename = data.get("filename", "").strip()
    code = data.get("code", "")

    if "." in filename:
        filename = filename.split(".")[0] + ".py"
    else:
        filename += ".py"

    file_path = CUSTOM_CODE_DIR / filename
    file_path.write_text(code, encoding="utf-8")

    return jsonify({"success": True, "filename": filename})

@custom_code_bp.route("/load/<filename>")
def load_file(filename):
    if not filename.endswith(".py"):
        filename += ".py"
    file_path = CUSTOM_CODE_DIR / filename
    code = file_path.read_text(encoding="utf-8")
    return jsonify({"success": True, "code": code, "filename": filename})

@custom_code_bp.route("/delete/<filename>", methods=["DELETE"])
def delete_file(filename):
    if not filename.endswith(".py"):
        filename += ".py"
    file_path = CUSTOM_CODE_DIR / filename
    file_path.unlink()
    return jsonify({"success": True})
