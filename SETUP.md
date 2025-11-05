# 프로젝트 설정 가이드

다른 컴퓨터에서 프로젝트를 실행하기 위해 필요한 설정입니다.

## 필수 요구사항

### 1. Node.js 및 패키지 매니저
- **Node.js**: v18 이상 권장
- **pnpm**: 패키지 매니저 (npm 대신 사용)
  ```bash
  npm install -g pnpm
  ```

### 2. Android 개발 환경 (Android 앱 빌드용)
- **Android Studio**: 최신 버전
- **Java JDK**: 21 버전 (프로젝트에서 Java 21 사용)
- **Android SDK**: Android Studio 설치 시 자동 설치
- **Gradle**: Android Studio 설치 시 자동 설치

#### Java JDK 21 설치 확인
```bash
java -version
# java version "21.x.x" 출력되어야 함
```

### 3. 환경 변수 설정
프로젝트 루트에 `.env` 파일을 생성하고 필요한 환경 변수를 설정하세요:

```env
# 카카오 지도 API 키 (선택사항 - 지점 관리 페이지에서만 사용)
VITE_KAKAO_APP_KEY=your_kakao_app_key_here
```

> **참고**: `.env` 파일은 `.gitignore`에 포함되어 있으므로, 각 컴퓨터에서 별도로 생성해야 합니다.

## 설치 단계

### 1. 프로젝트 클론 및 디렉토리 이동
```bash
git clone <repository-url>
cd Frontend
```

### 2. 패키지 설치
```bash
pnpm install
```

> **참고**: `pnpm install` 실행 시 `postinstall` 스크립트가 자동으로 실행되어 아이콘을 빌드합니다.

### 3. Capacitor 동기화 (Android 앱 개발 시)
Android 앱을 빌드하려는 경우:

```bash
# Capacitor 동기화 (웹 빌드 파일을 Android 프로젝트로 복사)
npx cap sync android
```

### 4. Android 프로젝트 빌드 (Android Studio 없이)
```bash
cd android
./gradlew assembleDebug
```

또는 Android Studio에서 직접 빌드:
```bash
npx cap open android
```

## 프로젝트 구조

```
Frontend/
├── android/              # Android 네이티브 프로젝트
│   └── app/
│       └── src/main/java/com/stockmate/app/
│           └── StepCounterPlugin.java  # 커스텀 Capacitor 플러그인
├── src/
│   ├── utils/
│   │   └── pedometer.js  # 걸음수 측정 유틸리티
│   └── pages/
│       └── warehouse-navigation.vue  # 창고 네비게이션 페이지
├── package.json
└── capacitor.config.ts
```

## 주요 커맨드

### 웹 개발 서버 실행
```bash
pnpm run dev
```

### 프로덕션 빌드
```bash
pnpm run build
```

### Android 앱 빌드
```bash
pnpm run build:app:android
```

### Capacitor 동기화만 실행
```bash
pnpm run cap:sync
```

## 문제 해결

### 1. "StepCounter plugin is not implemented" 에러
- Android 프로젝트를 완전히 clean rebuild:
  ```bash
  cd android
  ./gradlew clean
  ./gradlew assembleDebug
  ```

### 2. 패키지 설치 오류
- `node_modules` 삭제 후 재설치:
  ```bash
  rm -rf node_modules
  pnpm install
  ```

### 3. Capacitor 동기화 오류
- 웹 빌드를 먼저 실행:
  ```bash
  pnpm run build
  npx cap sync android
  ```

### 4. Java 버전 문제
- Java 21이 설치되어 있는지 확인:
  ```bash
  java -version
  ```
- Java 21이 없으면 설치:
  - macOS: `brew install openjdk@21`
  - Linux: `sudo apt install openjdk-21-jdk`
  - Windows: [Oracle JDK 21](https://www.oracle.com/java/technologies/downloads/#java21) 다운로드

## 주의사항

1. **커스텀 플러그인**: `StepCounterPlugin.java`는 커스텀 Capacitor 플러그인입니다. Android 빌드 시 자동으로 포함됩니다.

2. **환경 변수**: `.env` 파일은 각 컴퓨터에서 별도로 생성해야 합니다. Git에 커밋되지 않습니다.

3. **Android SDK**: Android 앱을 빌드하려면 Android Studio와 Android SDK가 설치되어 있어야 합니다.

4. **권한**: Android 앱에서 걸음수 측정 기능을 사용하려면 `ACTIVITY_RECOGNITION` 권한이 필요합니다. `AndroidManifest.xml`에 이미 선언되어 있습니다.

## 참고 자료

- [Capacitor 공식 문서](https://capacitorjs.com/docs)
- [Vue 3 공식 문서](https://vuejs.org/)
- [Vite 공식 문서](https://vitejs.dev/)

