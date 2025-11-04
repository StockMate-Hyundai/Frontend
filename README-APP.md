# Stock Mate - 모바일 앱 빌드 가이드

이 프로젝트는 **PWA(Progressive Web App)**와 **Capacitor**를 사용하여 모바일 앱으로 빌드할 수 있습니다.

## 📱 앱 빌드 방법

### 1. PWA (Progressive Web App)

웹 앱을 PWA로 배포하면 사용자가 홈 화면에 추가하여 앱처럼 사용할 수 있습니다.

#### 빌드 및 배포
```bash
# 프로덕션 빌드
pnpm run build

# 빌드된 파일을 웹 서버에 배포
# dist 폴더의 내용을 웹 서버에 업로드
```

#### PWA 기능
- ✅ 오프라인 지원 (Service Worker)
- ✅ 홈 화면 설치 가능
- ✅ 앱처럼 실행 (Standalone 모드)
- ✅ 자동 업데이트

### 2. Capacitor (네이티브 앱)

Capacitor를 사용하여 iOS와 Android 네이티브 앱을 빌드할 수 있습니다.

#### 필요한 환경
- **iOS**: macOS, Xcode
- **Android**: Android Studio

#### 설치 및 설정

1. **iOS 플랫폼 추가** (macOS만 가능)
```bash
pnpm add @capacitor/ios
npx cap add ios
```

2. **Android 플랫폼 추가**
```bash
pnpm add @capacitor/android
npx cap add android
```

3. **웹 앱 빌드 후 동기화**
```bash
# 웹 앱 빌드
pnpm run build

# Capacitor에 빌드 결과 동기화
pnpm run cap:sync
```

#### iOS 앱 빌드

1. Xcode에서 프로젝트 열기
```bash
pnpm run cap:open:ios
```

2. Xcode에서:
   - 시뮬레이터 선택 후 실행
   - 또는 실제 기기에 연결 후 실행
   - Archive 생성하여 App Store 배포

#### Android 앱 빌드

1. Android Studio에서 프로젝트 열기
```bash
pnpm run cap:open:android
```

2. Android Studio에서:
   - 에뮬레이터 실행 또는 실제 기기 연결
   - Run 버튼 클릭하여 실행
   - Build > Generate Signed Bundle/APK로 배포용 빌드

### 3. 앱 아이콘 생성

PWA 아이콘은 빌드 시 자동 생성되지만, 수동으로 생성하려면:

1. 512x512 PNG 이미지 준비 (logo_icon.png 등)
2. 다음 도구 사용:
   - https://www.pwabuilder.com/imageGenerator
   - https://realfavicongenerator.net/

3. 생성된 아이콘을 `public/` 폴더에 배치:
   - `pwa-192x192.png`
   - `pwa-512x512.png`

## 🔧 주요 스크립트

```bash
# 개발 서버 실행
pnpm run dev

# 프로덕션 빌드
pnpm run build

# 앱 빌드 및 동기화 (Capacitor)
pnpm run build:app

# iOS 프로젝트 열기
pnpm run cap:open:ios

# Android 프로젝트 열기
pnpm run cap:open:android

# Capacitor 동기화
pnpm run cap:sync
```

## 📝 설정 파일

### capacitor.config.ts
- Capacitor 설정 파일
- 서버 URL, 앱 이름 등 설정

### vite.config.js
- VitePWA 플러그인 설정
- PWA manifest 설정
- Service Worker 설정

### public/manifest.json
- PWA manifest 파일
- 앱 이름, 아이콘, 테마 색상 등

## 🚀 배포 체크리스트

### PWA 배포
- [ ] HTTPS 설정 (PWA 필수)
- [ ] manifest.json 확인
- [ ] Service Worker 작동 확인
- [ ] 아이콘 이미지 준비
- [ ] 오프라인 동작 테스트

### iOS 배포
- [ ] Apple Developer 계정 필요
- [ ] Bundle ID 설정
- [ ] App Store Connect에 앱 등록
- [ ] 인증서 및 프로비저닝 프로파일 설정
- [ ] Xcode에서 Archive 생성
- [ ] TestFlight 또는 App Store 배포

### Android 배포
- [ ] Google Play Console 계정 필요
- [ ] 앱 서명 키 생성
- [ ] Google Play Console에 앱 등록
- [ ] APK/AAB 파일 생성
- [ ] Play Store 또는 내부 배포

## 📱 주요 기능

- ✅ 반응형 디자인 (모바일/테블릿 최적화)
- ✅ 오프라인 지원 (PWA)
- ✅ 푸시 알림 지원 가능
- ✅ 카메라 접근 (QR 코드 스캔)
- ✅ 네이티브 기능 통합 가능

## 🔍 문제 해결

### PWA가 설치되지 않을 때
- HTTPS가 활성화되어 있는지 확인
- manifest.json이 올바른지 확인
- Service Worker가 등록되었는지 확인 (브라우저 개발자 도구 > Application)

### Capacitor 빌드 오류
- `pnpm run build` 먼저 실행
- `pnpm run cap:sync` 실행하여 동기화
- 플랫폼 폴더(ios/android) 삭제 후 다시 추가

## 📚 추가 자료

- [Capacitor 공식 문서](https://capacitorjs.com/docs)
- [PWA 가이드](https://web.dev/progressive-web-apps/)
- [Vite PWA 플러그인](https://vite-pwa-org.netlify.app/)

