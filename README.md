# vue

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volar) (and disable Vetur).

## Type Support for `.vue` Imports in TS

Since TypeScript cannot handle type information for `.vue` imports, they are shimmed to be a generic Vue component type by default. In most cases this is fine if you don't really care about component prop types outside of templates.

However, if you wish to get actual prop types in `.vue` imports (for example to get props validation when using manual `h(...)` calls), you can run `Volar: Switch TS Plugin on/off` from VS Code command palette.

## Customize configuration

See [Vite Configuration Reference](https://vitejs.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

## 환경 변수 설정

프로젝트를 실행하기 전에 환경 변수를 설정해야 합니다.

### 카카오 지도 (지점 관리 페이지)

`VITE_KAKAO_APP_KEY` 환경 변수를 설정해야 지도 기능을 사용할 수 있습니다.

#### 카카오 개발자 콘솔 설정 방법

1. **카카오 계정으로 로그인**
   - [카카오 개발자 콘솔](https://developers.kakao.com/) 접속
   - 카카오 계정으로 로그인

2. **애플리케이션 추가**
   - "내 애플리케이션" 메뉴 클릭
   - "애플리케이션 추가하기" 클릭
   - 앱 이름 입력 (예: "StockMate")
   - "저장" 클릭

3. **플랫폼 설정**
   - "앱 설정" > "플랫폼" 메뉴로 이동
   - "Web 플랫폼 등록" 클릭
   - 사이트 도메인 입력:
     - 개발용: `http://localhost:5173` (또는 사용 중인 포트)
     - 운영용: `https://yourdomain.com`
   - "저장" 클릭

4. **JavaScript 키 복사**
   - "앱 키" 메뉴로 이동
   - "JavaScript 키" 항목의 "복사" 버튼 클릭

5. **환경 변수 설정**
   - 프로젝트 루트에 `.env` 파일 생성 (없는 경우)
   - 다음 내용 추가:

```env
VITE_KAKAO_APP_KEY=복사한_JavaScript_키
```

6. **개발 서버 재시작**
   - 환경 변수 변경 후 서버를 재시작해야 합니다
   - `Ctrl+C`로 서버 중지 후 `npm run dev` 다시 실행

> **참고**: 
> - 카카오 지도 API는 무료 사용량이 제공됩니다.
> - 배포 시 운영 도메인도 등록해야 합니다.
> - `.env` 파일은 `.gitignore`에 포함되어 있으므로 보안에 안전합니다.
