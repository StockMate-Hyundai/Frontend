# 1) 빌드 스테이지: Vite + React 앱을 빌드
FROM node:20-alpine AS builder
WORKDIR /app

# pnpm 설치
RUN npm install -g pnpm

# 먼저 package.json과 lock 파일을 복사합니다.
COPY package.json pnpm-lock.yaml ./

# 전체 소스 코드를 복사합니다.
# postinstall 스크립트가 소스 코드 내 파일을 필요로 하므로, 의존성 설치 전에 복사해야 합니다.
COPY . .

# 의존성 설치
RUN pnpm install --frozen-lockfile

# 프로덕션용 번들 생성 (이미 코드가 복사되었으므로 이 단계만 남깁니다)
RUN pnpm run build

# 2) 프로덕션 스테이지: NGINX로 정적 파일 서빙
FROM nginx:stable-alpine

# 기본 default.conf 제거
RUN rm /etc/nginx/conf.d/default.conf

# SPA용 커스텀 Nginx 설정 복사
COPY nginx.conf /etc/nginx/conf.d/app.conf

# 빌드 결과물 복사
COPY --from=builder /app/dist /usr/share/nginx/html

# HTTP 포트 노출
EXPOSE 80

# Nginx 실행
CMD ["nginx", "-g", "daemon off;"]

