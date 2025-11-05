# Pedometer 플러그인 설치 가이드

## Capawesome Pedometer 플러그인 설치

`@capawesome-team/capacitor-pedometer`는 Capawesome Insiders 전용 플러그인입니다.

### 1. Capawesome Insiders 가입 및 라이센스 키 발급

1. [Capawesome Insiders](https://capawesome.io/insiders/) 가입
2. 라이센스 키 발급

### 2. npm 레지스트리 설정

```bash
npm config set @capawesome-team:registry https://npm.registry.capawesome.io
npm config set //npm.registry.capawesome.io/:_authToken <YOUR_LICENSE_KEY>
```

**주의**: `<YOUR_LICENSE_KEY>`를 발급받은 라이센스 키로 교체하세요.

### 3. 플러그인 설치

```bash
pnpm add @capawesome-team/capacitor-pedometer
npx cap sync android
```

### 4. Android 설정

#### Proguard 설정 (proguard-rules.pro)

```
-keep class io.capawesome.capacitorjs.plugins.** { *; }
```

### 5. 사용 방법

이미 `src/utils/pedometer.js`가 Capawesome 플러그인 API에 맞게 작성되어 있습니다.

## 대안: 무료 플러그인 사용

만약 Capawesome Insiders가 없다면, 커스텀 플러그인을 다시 만들어야 합니다.

