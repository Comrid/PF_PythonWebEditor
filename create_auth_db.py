#!/usr/bin/env python3
"""
사용자 인증 데이터베이스 생성 스크립트
"""

import sqlite3
import hashlib
import os
from datetime import datetime

# 데이터베이스 파일 경로
DB_PATH = "static/db/auth.db"

def create_database():
    """인증 데이터베이스 생성"""
    # 디렉토리 생성
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 사용자 테이블 생성
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT,
            role TEXT DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP
        )
    ''')
    
    # 사용자-로봇 할당 테이블 생성
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_robot_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            robot_id TEXT NOT NULL,
            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # 기본 관리자 계정 생성
    admin_password = hashlib.sha256("admin123".encode()).hexdigest()
    cursor.execute('''
        INSERT OR IGNORE INTO users (username, password_hash, email, role)
        VALUES (?, ?, ?, ?)
    ''', ("admin", admin_password, "admin@example.com", "admin"))
    
    # 테스트 사용자 계정 생성
    test_password = hashlib.sha256("test123".encode()).hexdigest()
    cursor.execute('''
        INSERT OR IGNORE INTO users (username, password_hash, email, role)
        VALUES (?, ?, ?, ?)
    ''', ("testuser", test_password, "test@example.com", "user"))
    
    conn.commit()
    conn.close()
    
    print("✅ 인증 데이터베이스가 생성되었습니다.")
    print(f"📁 데이터베이스 위치: {DB_PATH}")
    print("👤 기본 계정:")
    print("   - 관리자: admin / admin123")
    print("   - 사용자: testuser / test123")

if __name__ == "__main__":
    create_database()
