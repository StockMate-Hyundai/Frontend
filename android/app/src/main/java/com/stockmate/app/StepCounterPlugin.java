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
    private Sensor stepCounterSensor;
    private Sensor stepDetectorSensor; // STEP_DETECTOR 센서 추가
    private int totalSteps = 0;
    private int initialSteps = 0;
    private boolean isTracking = false;
    private boolean isRequestingPermission = false;
    private boolean useStepDetector = false; // STEP_DETECTOR 사용 여부

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
            // 먼저 TYPE_STEP_COUNTER 시도
            stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
            if (stepCounterSensor != null) {
                Log.d(TAG, "[load] Step Counter 센서 발견: " + stepCounterSensor.getName());
                useStepDetector = false;
            } else {
                Log.w(TAG, "[load] Step Counter 센서를 찾을 수 없습니다. Step Detector 시도...");
                // TYPE_STEP_COUNTER가 없으면 TYPE_STEP_DETECTOR 사용
                stepDetectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR);
                if (stepDetectorSensor != null) {
                    Log.d(TAG, "[load] Step Detector 센서 발견: " + stepDetectorSensor.getName());
                    useStepDetector = true;
                } else {
                    Log.e(TAG, "[load] Step Counter 및 Step Detector 센서를 모두 찾을 수 없습니다");
                }
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
                // 권한이 승인되면 원래 작업 계속 (재귀 방지를 위해 직접 실행)
                String methodName = call.getMethodName();
                if ("getSteps".equals(methodName)) {
                    // getSteps 직접 실행 (권한 체크 건너뛰기)
                    executeGetSteps(call);
                } else if ("startTracking".equals(methodName)) {
                    // startTracking 직접 실행 (권한 체크 건너뛰기)
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
        Sensor sensor = useStepDetector ? stepDetectorSensor : stepCounterSensor;
        if (sensor == null) {
            Log.e(TAG, "[executeGetSteps] 걸음 센서를 사용할 수 없습니다");
            call.reject("걸음 센서를 사용할 수 없습니다");
            return;
        }

        if (!isTracking) {
            Log.d(TAG, "[executeGetSteps] 센서 리스너 등록 시작 (타입: " + (useStepDetector ? "STEP_DETECTOR" : "STEP_COUNTER") + ")");
            boolean registered = sensorManager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_NORMAL);
            if (registered) {
                Log.d(TAG, "[executeGetSteps] 센서 리스너 등록 성공");
                isTracking = true;
            } else {
                Log.e(TAG, "[executeGetSteps] 센서 리스너 등록 실패");
            }
        }

        JSObject ret = new JSObject();
        ret.put("steps", totalSteps);
        Log.d(TAG, "[executeGetSteps] 걸음수 반환: " + totalSteps);
        call.resolve(ret);
    }
    
    /**
     * startTracking 실행 (권한 체크 없이)
     * Android 공식 문서 참고: https://developer.android.com/health-and-fitness/guides/basic-fitness-app/read-step-count-data
     */
    private void executeStartTracking(PluginCall call) {
        Sensor sensor = useStepDetector ? stepDetectorSensor : stepCounterSensor;
        if (sensor == null) {
            Log.e(TAG, "[executeStartTracking] 걸음 센서를 사용할 수 없습니다");
            call.reject("걸음 센서를 사용할 수 없습니다");
            return;
        }

        // 이미 추적 중이면 다시 등록하지 않음
        if (isTracking) {
            Log.d(TAG, "[executeStartTracking] 이미 추적 중입니다");
            JSObject ret = new JSObject();
            ret.put("initialSteps", initialSteps);
            ret.put("status", "already_tracking");
            call.resolve(ret);
            return;
        }

        // 센서 리스너 등록
        // TYPE_STEP_COUNTER: 리스너 등록 시 즉시 현재 값 반환 (부팅 이후 누적 걸음수)
        // TYPE_STEP_DETECTOR: 매 걸음마다 이벤트 발생 (1씩 증가)
        Log.d(TAG, "[executeStartTracking] 센서 타입: " + (useStepDetector ? "STEP_DETECTOR" : "STEP_COUNTER"));
        boolean registered = sensorManager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_NORMAL);
        if (registered) {
            Log.d(TAG, "[executeStartTracking] 센서 리스너 등록 성공");
            isTracking = true;
            
            // STEP_DETECTOR를 사용하는 경우 초기값을 0으로 설정
            if (useStepDetector) {
                initialSteps = 0;
                totalSteps = 0;
                Log.d(TAG, "[executeStartTracking] STEP_DETECTOR 사용, 초기값 0으로 설정");
            } else {
                // STEP_COUNTER는 onSensorChanged에서 첫 번째 값으로 초기값 설정
                initialSteps = 0;
                totalSteps = 0;
                Log.d(TAG, "[executeStartTracking] STEP_COUNTER 사용, 초기값 대기 중...");
            }
        } else {
            Log.e(TAG, "[executeStartTracking] 센서 리스너 등록 실패");
            call.reject("센서 리스너 등록 실패");
            return;
        }

        JSObject ret = new JSObject();
        ret.put("initialSteps", initialSteps);
        ret.put("status", "tracking_started");
        ret.put("sensorType", useStepDetector ? "step_detector" : "step_counter");
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

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_STEP_COUNTER) {
            // TYPE_STEP_COUNTER: 부팅 이후 누적 걸음수 (float 값)
            float stepCountSinceBoot = event.values[0];
            int newSteps = (int) stepCountSinceBoot;
            
            // 초기값이 설정되지 않았으면 첫 번째 값을 초기값으로 설정
            if (initialSteps == 0 && newSteps > 0) {
                initialSteps = newSteps;
                totalSteps = newSteps;
                Log.d(TAG, "[onSensorChanged] [STEP_COUNTER] 초기 걸음수 설정: " + initialSteps);
            }
            
            if (newSteps != totalSteps) {
                totalSteps = newSteps;
                int stepsSinceStart = totalSteps - initialSteps;
                Log.d(TAG, "[onSensorChanged] [STEP_COUNTER] 걸음수 업데이트 - 누적: " + totalSteps + ", 초기: " + initialSteps + ", 시작 이후: " + stepsSinceStart);
                
                // JavaScript로 이벤트 전송 (시작 이후 걸음수)
                JSObject ret = new JSObject();
                ret.put("steps", totalSteps);
                ret.put("stepsSinceStart", stepsSinceStart);
                notifyListeners("stepUpdate", ret);
            }
        } else if (event.sensor.getType() == Sensor.TYPE_STEP_DETECTOR) {
            // TYPE_STEP_DETECTOR: 매 걸음마다 이벤트 발생 (값은 항상 1.0)
            // 부팅 이후 누적이 아니라, 매 걸음마다 1씩 증가
            totalSteps++;
            int stepsSinceStart = totalSteps - initialSteps; // initialSteps는 0이므로 totalSteps와 같음
            Log.d(TAG, "[onSensorChanged] [STEP_DETECTOR] 걸음 감지! 총 걸음수: " + totalSteps + ", 시작 이후: " + stepsSinceStart);
            
            // JavaScript로 이벤트 전송
            JSObject ret = new JSObject();
            ret.put("steps", totalSteps);
            ret.put("stepsSinceStart", stepsSinceStart);
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

