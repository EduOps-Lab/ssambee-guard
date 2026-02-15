# Morgan Log Middleware Guide (Backend EC2)

이 가이드는 백엔드(Node.js) 서버에서 Morgan 로그와 생체 신호 데이터를 효율적으로 Lambda로 전송하는 방법을 안내합니다.

## 1. 패키지 설치
백엔드 서버에서 `axios`가 필요합니다.
```bash
npm install axios
```

## 2. Morgan 미들웨어 설정 (로그 배치 전송)
서버 성능을 위해 로그를 즉시 보내지 않고, 배치로 모아서 보냅니다.

```javascript
const morgan = require('morgan');
const axios = require('axios');

const LAMBDA_INGEST_URL = 'https://<your-lambda-url>/ingest';
let logBatch = [];
const BATCH_SIZE = 20;
const SEND_INTERVAL = 5000; // 5초

// 로그 전송 함수
const flushLogs = async () => {
    if (logBatch.length === 0) return;

    const logsToSend = [...logBatch];
    logBatch = [];

    try {
        await axios.post(LAMBDA_INGEST_URL, {
            logs: logsToSend
        }, {
            headers: { 'x-internal-secret': 'your-shared-secret' }
        });
    } catch (error) {
        console.error('Failed to send logs to Lambda:', error.message);
        // 실패 시 다시 큐에 넣거나 버릴 수 있습니다.
    }
};

// 주기적으로 전송
setInterval(flushLogs, SEND_INTERVAL);

// Morgan 설정
const morganMiddleware = morgan((tokens, req, res) => {
    const logEntry = {
        level: res.statusCode >= 400 ? 'ERROR' : 'INFO',
        message: `${tokens.method(req, res)} ${tokens.url(req, res)} ${res.statusCode} - ${tokens['response-time'](req, res)} ms`,
        metadata: {
            method: tokens.method(req, res),
            url: tokens.url(req, res),
            status: res.statusCode,
            responseTime: tokens['response-time'](req, res),
            ip: req.ip
        }
    };

    logBatch.push(logEntry);

    if (logBatch.length >= BATCH_SIZE) {
        flushLogs();
    }

    return null; // 콘솔 출력 생략 시 (출력을 원하면 morgan('combined') 등 사용)
});

module.exports = morganMiddleware;
```

## 3. 생체 신호 데이터 전송 예시
생체 신호 데이터는 발생 시 또는 주기적으로 전송할 수 있습니다.

```javascript
const sendBiometrics = async (deviceId, heartRate, systolic, diastolic) => {
    try {
        await axios.post(LAMBDA_INGEST_URL, {
            biometrics: [{
                device_id: deviceId,
                heart_rate: heartRate,
                systolic_bp: systolic,
                diastolic_bp: diastolic
            }]
        }, {
            headers: { 'x-internal-secret': 'your-shared-secret' }
        });
    } catch (error) {
        console.error('Failed to send biometrics:', error.message);
    }
};
```

## 4. 보안 주의사항
`/ingest` 엔드포인트는 공개되어 있으므로, 실제 운영 환경에서는 `x-api-key` 헤더 등을 추가하여 Lambda에서 검증하도록 강화하는 것을 권장합니다.
현재 구현된 코드에 API Key 검증 로직을 추가하고 싶으시면 말씀해 주세요.
