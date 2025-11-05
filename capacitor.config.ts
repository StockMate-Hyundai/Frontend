import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stockmate.app',
  appName: 'Stock Mate',
  webDir: 'dist',
  server: {
    // 개발 중: 로컬 서버 사용 (Android 기기/에뮬레이터의 경우 로컬 IP 주소 사용)
    // 실제 기기: 192.168.x.x 형식의 로컬 IP 주소 사용
    // 에뮬레이터: 10.0.2.2 (localhost를 가리킴)
    // iOS 시뮬레이터: localhost 사용 가능
    // url: process.env.CAPACITOR_SERVER_URL || 'http://localhost:5173',
    cleartext: true, // HTTP 허용 (개발 환경)
    
    // 프로덕션: 외부 API 허용
    allowNavigation: [
      'https://api.stockmate.site',
      'https://*.stockmate.site',
      '*',  // 임시: 모든 도메인 허용 (프로덕션에서는 제거 권장)
    ],
    androidScheme: 'https',
    // CORS 우회를 위한 설정
    hostname: 'localhost',
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
};

export default config;
