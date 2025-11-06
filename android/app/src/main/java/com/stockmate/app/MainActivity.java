package com.stockmate.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.util.Log;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Bridge;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private static final int PERMISSION_REQUEST_CODE = 100;
    
    private PedometerManager pedometerManager;
    private WebView webView;
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // PedometerManager 초기화
        pedometerManager = new PedometerManager(this);
        
        // 필요한 권한 요청 (Android 10+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACTIVITY_RECOGNITION) 
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    this,
                    new String[]{Manifest.permission.ACTIVITY_RECOGNITION},
                    PERMISSION_REQUEST_CODE
                );
            }
        }
    }
    
    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            // 권한 처리
        }
    }
    
    @Override
    public void onStart() {
        super.onStart();
        
        // Bridge에서 WebView 가져오기
        setupPedometerBridge();
    }
    
    private void setupPedometerBridge() {
        try {
            Bridge bridge = getBridge();
            if (bridge != null) {
                webView = bridge.getWebView();
                if (webView != null) {
                    // JavaScript Bridge 추가
                    webView.addJavascriptInterface(new PedometerBridge(), "PedometerBridge");
                } else {
                    // WebView가 아직 준비되지 않았으면 잠시 후 다시 시도
                    new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            setupPedometerBridge();
                        }
                    }, 500);
                }
            } else {
                new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        setupPedometerBridge();
                    }
                }, 500);
            }
        } catch (Exception e) {
            // 예외 발생 시 잠시 후 다시 시도
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
                @Override
                public void run() {
                    setupPedometerBridge();
                }
            }, 500);
        }
    }
    
    @Override
    public void onDestroy() {
        if (pedometerManager != null) {
            pedometerManager.stopTracking();
        }
        super.onDestroy();
    }
    
    /**
     * JavaScript Bridge - Vue에서 호출할 수 있는 Android 함수들
     */
    public class PedometerBridge {
        @JavascriptInterface
        public void startTracking() {
            runOnUiThread(() -> {
                pedometerManager.setListener(new PedometerManager.PedometerListener() {
                    @Override
                    public void onStepCountUpdate(int stepCount, float distance) {
                        // JavaScript로 데이터 전달
                        final String jsCode = String.format(
                            "if (window.pedometerCallback) { window.pedometerCallback(%d, %f); }",
                            stepCount, distance
                        );
                        runOnUiThread(() -> {
                            if (webView != null) {
                                webView.evaluateJavascript(jsCode, null);
                            }
                        });
                    }
                });
                pedometerManager.startTracking();
            });
        }
        
        @JavascriptInterface
        public void stopTracking() {
            runOnUiThread(() -> {
                pedometerManager.stopTracking();
            });
        }
        
        @JavascriptInterface
        public void resetTracking() {
            runOnUiThread(() -> {
                pedometerManager.reset();
            });
        }
        
        @JavascriptInterface
        public int getStepCount() {
            return pedometerManager != null ? pedometerManager.getStepCount() : 0;
        }
        
        @JavascriptInterface
        public float getTotalDistance() {
            return pedometerManager != null ? pedometerManager.getTotalDistance() : 0f;
        }
    }
}
