# 다른 컴퓨터에서 프로젝트 실행하기

이 프로젝트를 다른 컴퓨터에서 빌드하고 실행하기 위해 필요한 설치 항목들을 정리했습니다.

## 필수 설치 항목

### 1. Node.js 및 pnpm

```bash
# Node.js 설치 (버전 18 이상 권장)
# https://nodejs.org/ 에서 다운로드 또는 nvm 사용

# pnpm 설치
npm install -g pnpm
```

### 2. Java JDK 21

Android 빌드를 위해 Java JDK 21이 필요합니다.

**macOS (Homebrew):**
```bash
brew install openjdk@21
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install openjdk-21-jdk
```

**Windows:**
- https://adoptium.net/ 에서 JDK 21 다운로드
- 설치 후 환경 변수 설정 필요

**환경 변수 설정 확인:**
```bash
java -version  # Java 21 확인
echo $JAVA_HOME  # JAVA_HOME 설정 확인 (macOS/Linux)
```

### 3. Android Studio

Android Studio를 설치하면 Android SDK, 빌드 도구 등이 자동으로 설치됩니다.

**다운로드:**
- https://developer.android.com/studio

**설치 후:**
1. Android Studio 실행
2. SDK Manager에서 다음 설치:
   - Android SDK Platform 33 이상
   - Android SDK Build-Tools
   - Android SDK Command-line Tools

**환경 변수 설정:**

**macOS/Linux (~/.zshrc 또는 ~/.bashrc):**
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk  # macOS
# 또는
export ANDROID_HOME=$HOME/Android/Sdk  # Linux

export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

**Windows:**
- 시스템 환경 변수에 `ANDROID_HOME` 추가
- `ANDROID_HOME/platform-tools`를 PATH에 추가

### 4. Git (선택사항)

프로젝트를 Git에서 클론하는 경우:
```bash
git --version  # 설치 확인
```

## 프로젝트 설정

### 1. 프로젝트 클론/복사

```bash
# Git에서 클론하는 경우
git clone <repository-url>
cd Frontend

# 또는 프로젝트 폴더를 직접 복사
```

### 2. 의존성 설치

```bash
pnpm install
```

### 3. Capacitor 동기화

```bash
npx cap sync android
```

## 빌드 및 실행

### 웹 개발 서버 실행

```bash
pnpm dev
```

### Android 앱 빌드

```bash
# 1. 웹 빌드
pnpm build

# 2. Capacitor 동기화
npx cap sync android

# 3. Android Studio에서 빌드
npx cap open android
```

Android Studio에서:
1. `Build` > `Build Bundle(s) / APK(s)` > `Build APK(s)`
2. 또는 `Run` > `Run 'app'` (에뮬레이터/실기기 연결 필요)

## 체크리스트

다른 컴퓨터에서 실행하기 전 확인:

- [ ] Node.js 18+ 설치됨
- [ ] pnpm 설치됨
- [ ] Java JDK 21 설치됨
- [ ] Android Studio 설치됨
- [ ] Android SDK 설치됨
- [ ] ANDROID_HOME 환경 변수 설정됨
- [ ] PATH에 Android SDK 경로 추가됨
- [ ] `pnpm install` 완료
- [ ] `npx cap sync android` 완료

## 문제 해결

### Java 버전 문제

```bash
# Java 버전 확인
java -version

# 여러 Java 버전이 있는 경우 (macOS/Linux)
export JAVA_HOME=$(/usr/libexec/java_home -v 21)  # macOS
# 또는
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64  # Linux
```

### Android SDK 경로 문제

```bash
# Android SDK 경로 확인
echo $ANDROID_HOME

# adb 경로 확인
which adb
```

### Capacitor 플러그인 문제

```bash
# Capacitor 캐시 클리어
npx cap clean

# 다시 동기화
npx cap sync android
```

## 추가 정보

- 프로젝트 루트의 `SETUP.md` 파일 참고
- `package.json`의 `scripts` 섹션 확인
- Android Studio에서 Gradle 동기화 확인

