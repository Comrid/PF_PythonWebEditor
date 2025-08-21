# === 설정 ===
CUSTOM_CODE_DIR = Path("static/custom_code")  # 사용자 코드 저장 디렉토리

def get_custom_code_files():
    try:
        files = []
        for file_path in CUSTOM_CODE_DIR.glob("*.py"):
            files.append({
                "name": file_path.name,
                "path": str(file_path),
                "size": file_path.stat().st_size,
                "mtime": int(file_path.stat().st_mtime)
            })
        return sorted(files, key=lambda x: x["mtime"], reverse=True)  # 최신순 정렬
    except Exception as e:
        print(f"Error reading custom code directory: {e}")
        return []


