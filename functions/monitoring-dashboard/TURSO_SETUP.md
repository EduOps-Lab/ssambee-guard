# Turso DB Setup Guide

이 가이드는 Turso DB를 생성하고 대시보드에 필요한 테이블 스키마를 설정하는 방법을 안내합니다.

## 1. Turso DB 생성
1. [Turso](https://turso.tech/)에 가입하고 로그인합니다.
2. 새 데이터베이스를 생성합니다 (예: `ssambee-guard-db`).
3. 데이터베이스의 **URL**과 **Auth Token**을 복사해두세요. (나중에 Lambda 환경 변수에 필요합니다.)

## 2. 테이블 스키마 설정
Turso CLI 또는 웹 대시보드의 쿼리 에디터에서 다음 SQL을 실행하여 테이블을 생성하세요.

### 사용자 테이블 (근무자 4인)
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 생체 신호 데이터 테이블
```sql
CREATE TABLE biometrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    heart_rate INTEGER,
    systolic_bp INTEGER,
    diastolic_bp INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 로그 테이블 (Morgan 로그 등)
```sql
CREATE TABLE logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL, -- INFO, ERROR, WARN
    message TEXT NOT NULL,
    metadata TEXT, -- JSON format for additional info
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 3. 초기 사용자 데이터 추가
비밀번호는 보안을 위해 해싱되어 저장되어야 합니다. (아래는 예시이며, 실제 구현 시 서버에서 생성한 해시값을 넣어야 합니다.)
4명의 근무자 계정을 생성하는 예시입니다:

```sql
-- 예시 계정 (비밀번호는 추후 백엔드 구현 시 설정된 로직으로 생성된 해시값을 넣어야 함)
-- 여기서는 일단 자리를 만들어 둡니다.
INSERT INTO users (username, password_hash) VALUES ('admin1', 'HASHED_PASSWORD_1');
INSERT INTO users (username, password_hash) VALUES ('admin2', 'HASHED_PASSWORD_2');
INSERT INTO users (username, password_hash) VALUES ('admin3', 'HASHED_PASSWORD_3');
INSERT INTO users (username, password_hash) VALUES ('admin4', 'HASHED_PASSWORD_4');
```

## 4. 환경 변수 설정
Lambda와 프론트엔드 연동을 위해 다음 값이 필요합니다:
- `TURSO_URL`: `libsql://...`
- `TURSO_AUTH_TOKEN`: `eyJ...`
- `JWT_SECRET`: (임의의 긴 문자열)
