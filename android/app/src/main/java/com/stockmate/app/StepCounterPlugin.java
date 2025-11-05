package com.stockmate.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.content.Context;
import android.os.Build;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * 안드로이드 내장 Pedometer 센서를 사용한 이동 거리 측정
 * TYPE_STEP_DETECTOR를 사용하여 각 스텝 감지 시마다 카운팅
 * 시작 시점부터의 스텝만 계산하므로 정확함
 */
@CapacitorPlugin(
    name = "StepCounter",
    permissions = {
        @Permission(
            strings = { Manifest.permission.ACTIVITY_RECOGNITION },
            alias = "activity_recognition"
        )
    }
)
public class StepCounterPlugin extends Plugin implements SensorEventListener {

    private static final String TAG = "StepCounterPlugin";
    
    private SensorManager sensorManager;
    private Sensor stepDetectorSensor; // TYPE_STEP_DETECTOR만 사용
    
    // 스텝 관련
    private int stepCount = 0;
    private float totalDistance = 0f;
    
    // 스텝 길이 (미터) - 평균 성인 보행 길이
    // 사용자 키에 따라 조정 가능
    private float stepLength = 0.7f;  // 기본값: 70cm
    private float estimatedStepLength = 0.7f;
    
    private boolean isTracking = false;
    private boolean isRequestingPermission = false;

    @Override
    public void load() {
        super.load();
        Log.d(TAG, "[load] 플러그인 로드 시작");
        Log.d(TAG, "[load] Android 버전: " + Build.VERSION.SDK_INT);
        
        // 권한 확인
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACTIVITY_RECOGNITION) 
                    != PackageManager.PERMISSION_GRANTED) {
                Log.w(TAG, "[load] ACTIVITY_RECOGNITION 권한이 없습니다. 런타임 권한 요청 필요");
            } else {
                Log.d(TAG, "[load] ACTIVITY_RECOGNITION 권한이 있습니다");
            }
        } else {
            Log.d(TAG, "[load] Android 10 미만이므로 권한이 필요 없습니다");
        }
        
        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            // TYPE_STEP_DETECTOR만 사용
            stepDetectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR);
            if (stepDetectorSensor != null) {
                Log.d(TAG, "[load] Step Detector 센서 발견: " + stepDetectorSensor.getName());
                Log.d(TAG, "[load] 센서 정보 - Type: " + stepDetectorSensor.getType() + 
                    ", Power: " + stepDetectorSensor.getPower() + 
                    ", Vendor: " + stepDetectorSensor.getVendor());
            } else {
                Log.e(TAG, "[load] Step Detector 센서를 찾을 수 없습니다");
            }
        } else {
            Log.e(TAG, "[load] SensorManager를 가져올 수 없습니다");
        }
    }
    
    /**
     * 권한 확인 및 요청
     */
    private boolean checkPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACTIVITY_RECOGNITION) 
                    != PackageManager.PERMISSION_GRANTED) {
                if (!isRequestingPermission) {
                    Log.d(TAG, "[checkPermission] 권한 요청 필요");
                    isRequestingPermission = true;
                    requestPermissionForAlias("activity_recognition", call, "activityRecognitionPermsCallback");
                }
                return false;
            } else {
                Log.d(TAG, "[checkPermission] 권한이 있습니다");
                isRequestingPermission = false;
                return true;
            }
        }
        // Android 10 미만에서는 권한 불필요
        return true;
    }
    
    @PermissionCallback
    private void activityRecognitionPermsCallback(PluginCall call) {
        isRequestingPermission = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACTIVITY_RECOGNITION) 
                    == PackageManager.PERMISSION_GRANTED) {
                Log.d(TAG, "[activityRecognitionPermsCallback] 권한 승인됨");
                // 권한이 승인되면 원래 작업 계속
                String methodName = call.getMethodName();
                if ("getSteps".equals(methodName)) {
                    executeGetSteps(call);
                } else if ("startTracking".equals(methodName)) {
                    executeStartTracking(call);
                }
            } else {
                Log.e(TAG, "[activityRecognitionPermsCallback] 권한 거부됨");
                call.reject("ACTIVITY_RECOGNITION 권한이 필요합니다");
            }
        }
    }
    
    /**
     * getSteps 실행 (권한 체크 없이)
     */
    private void executeGetSteps(PluginCall call) {
        if (stepDetectorSensor == null) {
            Log.e(TAG, "[executeGetSteps] Step Detector 센서를 사용할 수 없습니다");
            call.reject("Step Detector 센서를 사용할 수 없습니다");
            return;
        }

        JSObject ret = new JSObject();
        ret.put("steps", stepCount);
        ret.put("distance", totalDistance);
        Log.d(TAG, "[executeGetSteps] 걸음수 반환: " + stepCount + ", 거리: " + totalDistance + " m");
        call.resolve(ret);
    }
    
    /**
     * startTracking 실행 (권한 체크 없이)
     * TYPE_STEP_DETECTOR: 각 스텝이 감지될 때마다 이벤트 발생
     */
    private void executeStartTracking(PluginCall call) {
        if (stepDetectorSensor == null) {
            Log.e(TAG, "[executeStartTracking] Step Detector 센서를 사용할 수 없습니다");
            call.reject("Step Detector 센서를 사용할 수 없습니다");
            return;
        }

        // 이미 추적 중이면 다시 등록하지 않음
        if (isTracking) {
            Log.d(TAG, "[executeStartTracking] 이미 추적 중입니다");
            JSObject ret = new JSObject();
            ret.put("steps", stepCount);
            ret.put("distance", totalDistance);
            ret.put("status", "already_tracking");
            call.resolve(ret);
            return;
        }

        // 스텝 카운터 초기화
        stepCount = 0;
        totalDistance = 0f;
        Log.d(TAG, "[executeStartTracking] startTracking() 호출됨");
        Log.d(TAG, "[executeStartTracking] Step Detector 센서 등록 시도: " + stepDetectorSensor.getName());
        Log.d(TAG, "[executeStartTracking] 센서 정보 - Type: " + stepDetectorSensor.getType() + 
            ", Power: " + stepDetectorSensor.getPower() + 
            ", Vendor: " + stepDetectorSensor.getVendor());

        // 여러 지연 옵션 시도
        boolean registered = sensorManager.registerListener(this, stepDetectorSensor, SensorManager.SENSOR_DELAY_UI);
        if (!registered) {
            Log.d(TAG, "[executeStartTracking] SENSOR_DELAY_UI 실패, SENSOR_DELAY_NORMAL 시도");
            registered = sensorManager.registerListener(this, stepDetectorSensor, SensorManager.SENSOR_DELAY_NORMAL);
        }
        if (!registered) {
            Log.d(TAG, "[executeStartTracking] SENSOR_DELAY_NORMAL 실패, SENSOR_DELAY_GAME 시도");
            registered = sensorManager.registerListener(this, stepDetectorSensor, SensorManager.SENSOR_DELAY_GAME);
        }
        if (!registered) {
            Log.d(TAG, "[executeStartTracking] SENSOR_DELAY_GAME 실패, SENSOR_DELAY_FASTEST 시도");
            registered = sensorManager.registerListener(this, stepDetectorSensor, SensorManager.SENSOR_DELAY_FASTEST);
        }

        Log.d(TAG, "[executeStartTracking] 최종 센서 등록 결과: " + registered);

        if (registered) {
            isTracking = true;
            Log.d(TAG, "[executeStartTracking] 센서 리스너 등록 성공");
            
            // 초기값 전송
            JSObject initialRet = new JSObject();
            initialRet.put("steps", 0);
            initialRet.put("distance", 0f);
            notifyListeners("stepUpdate", initialRet);
        } else {
            Log.e(TAG, "[executeStartTracking] 센서 리스너 등록 실패");
            call.reject("센서 리스너 등록 실패");
            return;
        }

        JSObject ret = new JSObject();
        ret.put("steps", stepCount);
        ret.put("distance", totalDistance);
        ret.put("status", "tracking_started");
        ret.put("sensorType", "step_detector");
        call.resolve(ret);
    }

    @PluginMethod
    public void getSteps(PluginCall call) {
        Log.d(TAG, "[getSteps] 걸음수 요청");
        
        // 권한 확인
        if (!checkPermission(call)) {
            Log.d(TAG, "[getSteps] 권한 요청 중...");
            return; // 권한 요청 중이면 여기서 종료
        }
        
        // 권한이 있으면 실행
        executeGetSteps(call);
    }

    @PluginMethod
    public void startTracking(PluginCall call) {
        Log.d(TAG, "[startTracking] 추적 시작 요청");
        
        // 권한 확인
        if (!checkPermission(call)) {
            Log.d(TAG, "[startTracking] 권한 요청 중...");
            return; // 권한 요청 중이면 여기서 종료
        }
        
        // 권한이 있으면 실행
        executeStartTracking(call);
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        Log.d(TAG, "[stopTracking] 추적 중지 요청");
        if (sensorManager != null && isTracking) {
            sensorManager.unregisterListener(this);
            isTracking = false;
            Log.d(TAG, "[stopTracking] 센서 리스너 해제 완료");
        }
        call.resolve();
    }

    @PluginMethod
    public void reset(PluginCall call) {
        Log.d(TAG, "[reset] reset() 호출됨 - 스텝 초기화");
        stepCount = 0;
        totalDistance = 0f;
        JSObject ret = new JSObject();
        ret.put("steps", stepCount);
        ret.put("distance", totalDistance);
        call.resolve(ret);
    }

    @PluginMethod
    public void setStepLength(PluginCall call) {
        Float length = call.getFloat("length");
        if (length != null && length > 0) {
            this.stepLength = length;
            this.estimatedStepLength = length;
            Log.d(TAG, "[setStepLength] 스텝 길이 설정: " + length + " m");
            JSObject ret = new JSObject();
            ret.put("stepLength", estimatedStepLength);
            call.resolve(ret);
        } else {
            call.reject("유효하지 않은 스텝 길이입니다");
        }
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_STEP_DETECTOR) {
            // TYPE_STEP_DETECTOR: 각 스텝이 감지될 때마다 호출됨
            // 값은 항상 1.0 (걸음 하나 감지)
            stepCount++;
            totalDistance = stepCount * estimatedStepLength;

            Log.d(TAG, "[onSensorChanged] [STEP_DETECTOR] 스텝 감지: " + stepCount + ", 거리: " + totalDistance + " m");
            
            // JavaScript로 이벤트 전송
            JSObject ret = new JSObject();
            ret.put("steps", stepCount);
            ret.put("distance", totalDistance);
            ret.put("stepsSinceStart", stepCount); // 시작 이후 걸음수
            notifyListeners("stepUpdate", ret);
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        Log.d(TAG, "[onAccuracyChanged] 센서 정확도 변경: " + accuracy);
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        Log.d(TAG, "[handleOnDestroy] 플러그인 종료");
        if (sensorManager != null && isTracking) {
            sensorManager.unregisterListener(this);
            isTracking = false;
        }
    }
}
