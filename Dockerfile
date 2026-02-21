FROM node:22-alpine

# Alpine에서 일부 native 모듈 라이브러리 호환성을 위해 권장
RUN apk add --no-cache libc6-compat

WORKDIR /app

RUN npm install -g npm@11

# package.json - package-lock.json 만 먼저 복사하여 종속성 캐싱 활용
COPY package.json package-lock.json* ./

# Husky가 CI/Docker 환경에서 에러를 내지 않도록 설치 (준비 스크트트립ㅌ 무시 옵션)
RUN npm ci --ignore-scripts

COPY . .

# TW CSS v4는 PostCSS/Lightning CSS 빌드가 필요할수있으므로 필요시 .next 캐시 폴더 권한 설정
RUN mkdir -p .next && chown node:node .next

EXPOSE 3000

# 컨테이너 실행시 node 유저로 실행
USER node

CMD ["npm", "run", "dev"]