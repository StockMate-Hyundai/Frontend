# CORS 문제 해결 가이드

## 문제
안드로이드 Capacitor 앱에서 `https://localhost` origin으로 API 요청 시 CORS 에러 발생

## 해결 방법

### 방법 1: 서버에서 CORS 설정 추가 (권장)

서버(`api.stockmate.site`)에서 다음 origin들을 허용해야 합니다:

**Node.js/Express 예시:**
```javascript
const cors = require('cors');

app.use(cors({
  origin: [
    'https://stockmate.site',           // 웹 도메인
    'https://localhost',                 // Capacitor 앱 (필수!)
    'capacitor://localhost',             // Capacitor 앱 (대체)
    'ionic://localhost',                 // Capacitor 앱 (대체)
    'http://localhost:5173',            // 개발 서버
    'http://localhost',                 // 개발 환경
  ],
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
}));
```

**Spring Boot 예시:**
```java
@Configuration
public class CorsConfig {
    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**")
                    .allowedOrigins(
                        "https://stockmate.site",
                        "https://localhost",        // 필수!
                        "capacitor://localhost",
                        "ionic://localhost",
                        "http://localhost:5173"
                    )
                    .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
                    .allowedHeaders("*")
                    .allowCredentials(false);
            }
        };
    }
}
```

**Django 예시:**
```python
# settings.py
CORS_ALLOWED_ORIGINS = [
    "https://stockmate.site",
    "https://localhost",          # 필수!
    "capacitor://localhost",
    "ionic://localhost",
    "http://localhost:5173",
]

CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
]
```

### 방법 2: Capacitor HTTP 플러그인 사용 (플러그인 설치 필요)

네이티브 HTTP 클라이언트를 사용하여 CORS를 완전히 우회할 수 있습니다.

```bash
pnpm add @capacitor-community/http
```

그 다음 `src/api/http.js`를 수정하여 Capacitor 환경에서는 네이티브 HTTP를 사용하도록 설정합니다.

## 테스트

서버 설정 후 다음을 확인하세요:

1. 서버 재시작
2. 안드로이드 앱 다시 빌드 및 실행
3. 로그인 시도

## 현재 상태

- ✅ Capacitor 설정: `capacitor.config.ts`에 네트워크 설정 완료
- ✅ Android 보안 설정: `network_security_config.xml` 추가
- ⚠️ **서버 CORS 설정 필요**: `https://localhost` origin 허용 필요

