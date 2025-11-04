import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stockmate.app',
  appName: 'Stock Mate',
  webDir: 'dist',
  server: {
    // 개발 중: 로컬 서버 사용 시 주석 해제
    // url: 'http://localhost:5173',
    // cleartext: true,
    
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
