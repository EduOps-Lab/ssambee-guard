# ![ssambee-guard Logo](https://via.placeholder.com/150?text=ssambee-guard)

# ssambee-guard

> **환경에 맞춤 저렴하고 효율적인 서버 감시 및 알림 확인**

`ssambee-guard`는 서버의 로그, 생체 신호(biometrics), 그리고 시스템 지표를 최소한의 비용으로 24시간 감시하고 실시간으로 알림을 제공하는 오픈소스 모니터링 솔루션입니다. AWS Lambda와 Turso(LibSQL)를 활용하여 월 $0.1 미만의 비용으로 운영이 가능하도록 설계되었습니다.

---

## 🌟 왜 ssambee-guard 인가요?

- **초저비용**: AWS Lambda와 Turso DB의 Free Tier를 극한으로 활용하여 운영 비용을 최소화합니다.
- **실시간 관제**: Server-Sent Events(SSE)를 통해 실시간으로 서버의 로그와 상태를 대시보드에서 확인할 수 있습니다.
- **다양한 알림**: Discord 웹훅과 카카오 알림톡(Solapi)을 연동하여 장애 상황을 즉각적으로 전파합니다.
- **효율적인 로그 분석**: 서버 측 페이지네이션과 필터링 기능을 통해 수많은 로그 중 필요한 정보를 빠르게 찾을 수 있습니다.

---

## 🚀 시작하기 (Getting Started)

### 1. Minimal Setup (Docker)

프로젝트를 로컬에서 가장 빠르게 확인해보는 방법은 Docker를 사용하는 것입니다.

```bash
# 저장소 복제
git clone https://github.com/your-repo/ssambee-guard.git
cd ssambee-guard

# 환경 변수 설정 (최소 설정)
cp frontend/.env.example frontend/.env.local

# Docker 실행
docker-compose up --build
```
이제 `http://localhost:3000`에서 대시보드 UI를 확인할 수 있습니다.

### 2. Hello World (Log Ingest Test)

대시보드에 첫 번째 로그를 찍어보려면 다음 `curl` 명령어를 실행해보세요:

```bash
curl -X POST https://<your-lambda-url>/ingest \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: <your-internal-secret>" \
  -d '{
    "logs": [
      {
        "level": "INFO",
        "message": "Hello World! ssambee-guard가 정상적으로 작동 중입니다.",
        "metadata": { "source": "curl-test" }
      }
    ]
  }'
```
성공하면 대시보드 실시간 로그 피드에서 즉시 해당 메시지를 확인할 수 있습니다.

---

## ⚙️ 초기 설정 (Configuration)

이 프로젝트를 실제로 운영하기 위해서는 다음의 외부 서비스 설정이 필요합니다:

1.  **Turso DB**: 서버 지표와 로그를 저장할 데이터베이스. (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`)
2.  **Discord Webhook**: 에러 및 리소스 알림을 받을 채널 URL. (`DISCORD_WEBHOOK_URL`)
3.  **Solapi (Optional)**: 카카오 알림톡 전송을 위한 API Key/Secret. (AWS SSM Parameter Store에 저장)
4.  **Shared Secret**: 인제스트 API 보안을 위한 키. (`INTERNAL_INGEST_SECRET`)

자세한 DB 설정 방법은 `functions/monitoring-dashboard/TURSO_SETUP.md`를 참고하세요.

---

## 🛠 개발하기 (Developing)

로컬 개발 환경을 구축하는 단계입니다:

```bash
# 1. 의존성 설치
pnpm install

# 2. 프론트엔드 개발 서버 실행
cd frontend
pnpm run dev

# 3. 람다 함수 테스트
pnpm test
```

### 디렉토리 구조
- `frontend/`: Next.js 16 (React 19) 기반의 관리자 대시보드
- `functions/`: AWS Lambda용 소스 코드
  - `central-monitor`: 시스템 지표 및 Discord 알림 처리
  - `kakao-notification`: SQS 트리거를 통한 알림톡 전송
  - `monitoring-dashboard`: 대시보드 API 및 SSE 스트리밍
  - `log-cleanup`: 오래된 로그 자동 삭제 (Batch)
- `terraform/`: AWS 인프라 정의 코드

---

## 🏗 빌드 및 배포 (Building & Deploying)

### 빌드 (Bundling)
AWS Lambda에 업로드하기 위해 TypeScript 코드를 번들링합니다:

```bash
pnpm run build
```
이 명령어는 `esbuild`를 사용하여 `functions/*/dist/index.js`를 생성합니다.

### 배포 (Deploying)
Terraform을 사용하여 AWS 인프라를 배포합니다:

```bash
cd terraform
terraform init
terraform plan
terraform apply
```
배포가 완료되면 생성된 API Gateway URL과 Lambda Function URL이 출력됩니다.

---

## ✨ 주요 기능 (Features)

- **실시간 스트리밍 대시보드**: SSE를 통한 실시간 로그 및 메트릭 시각화.
- **로그 검색 및 필터링**: 레벨별, 기간별 정밀 로그 조회.
- **알림 이력 관리**: 발생한 모든 알림의 상세 내용을 저장하고 조회.
- **자동 로그 정리**: 14일이 지난 로그는 자동으로 삭제하여 Turso DB 용량 최적화.
- **사용자 관리**: 관리자 승인 기반의 회원가입 및 권한 관리 시스템.

---

## 🤝 기여하기 (Contributing)

`ssambee-guard`에 관심을 가져주셔서 감사합니다! 기여는 언제나 환영입니다.

- 버그를 발견하거나 제안 사항이 있다면 **Issue**를 생성해 주세요.
- 코드 기여를 원하신다면 저장소를 **Fork**한 뒤 **Feature Branch**에서 작업하여 **Pull Request**를 보내주세요.
- **Good First Issue** 라벨이 붙은 이슈부터 시작해보는 것을 추천합니다.

"당신의 작은 기여가 누군가의 월 서버 비용을 아껴줄 수 있습니다."

---

## 🔗 링크 (Links)

- **Issue Tracker**: [GitHub Issues](https://github.com/your-repo/ssambee-guard/issues)
- **Related Projects**:
  - [Solapi SDK](https://github.com/solapi/solapi-nodejs)
  - [Turso (LibSQL)](https://turso.tech)

---

## 📜 라이선스 (Licensing)

이 프로젝트는 **ISC License**를 따릅니다. 자세한 내용은 `package.json`의 `license` 항목을 참고하세요.
