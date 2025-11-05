package com.stockmate.app;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.util.Log;

/**
 * 안드로이드 내장 Pedometer 센서를 사용한 이동 거리 측정
 * TYPE_STEP_DETECTOR를 사용하여 각 스텝 감지 시마다 카운팅
 */
public class PedometerManager implements SensorEventListener {
    private static final String TAG = "PedometerManager";
    
    private SensorManager sensorManager;
    private Sensor stepDetectorSensor;
    
    // 스텝 관련
    private int stepCount = 0;
    private float totalDistance = 0f;
    private float stepLength = 0.7f; // 기본값: 70cm
    private float estimatedStepLength = 0.7f;
    
    // 리스너
    private PedometerListener listener;
    
    public interface PedometerListener {
        void onStepCountUpdate(int stepCount, float distance);
    }
    
    public PedometerManager(Context context) {
        sensorManager = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        stepDetectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR);
    }
    
    public void setListener(PedometerListener listener) {
        this.listener = listener;
    }
    
    public void setStepLength(float length) {
        this.stepLength = length;
        this.estimatedStepLength = length;
    }
    
    public void startTracking() {
        Log.d(TAG, "startTracking() 호출됨");
        stepCount = 0;
        totalDistance = 0f;
        
        if (stepDetectorSensor != null) {
            Log.d(TAG, "Step Detector 센서 등록 시도: " + stepDetectorSensor.getName());
            
            // 여러 지연 옵션 시도
            boolean registered = sensorManager.registerListener(this, stepDetectorSensor, SensorManager.SENSOR_DELAY_UI);
            if (!registered) {
                Log.d(TAG, "SENSOR_DELAY_UI 실패, SENSOR_DELAY_NORMAL 시도");
                registered = sensorManager.registerListener(this, stepDetectorSensor, SensorManager.SENSOR_DELAY_NORMAL);
            }
            if (!registered) {
                Log.d(TAG, "SENSOR_DELAY_NORMAL 실패, SENSOR_DELAY_GAME 시도");
                registered = sensorManager.registerListener(this, stepDetectorSensor, SensorManager.SENSOR_DELAY_GAME);
            }
            if (!registered) {
                Log.d(TAG, "SENSOR_DELAY_GAME 실패, SENSOR_DELAY_FASTEST 시도");
                registered = sensorManager.registerListener(this, stepDetectorSensor, SensorManager.SENSOR_DELAY_FASTEST);
            }
            
            Log.d(TAG, "최종 센서 등록 결과: " + registered);
            
            if (registered && listener != null) {
                listener.onStepCountUpdate(0, 0f);
            }
        } else {
            Log.w(TAG, "Step Detector 센서를 지원하지 않습니다");
        }
    }
    
    public void stopTracking() {
        Log.d(TAG, "stopTracking() 호출됨");
        sensorManager.unregisterListener(this);
    }
    
    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_STEP_DETECTOR) {
            // 각 스텝이 감지될 때마다 호출됨
            stepCount++;
            totalDistance = stepCount * estimatedStepLength;
            
            // 스텝 감지 로그 (INFO 레벨로 더 눈에 띄게)
            Log.i(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            Log.i(TAG, "📍 스텝 감지! 현재 걸음수: " + stepCount + " 걸음");
            Log.i(TAG, "📏 누적 이동 거리: " + String.format("%.2f", totalDistance) + " m");
            Log.i(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            
            if (listener != null) {
                listener.onStepCountUpdate(stepCount, totalDistance);
            }
        }
    }
    
    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // 필요시 구현
    }
    
    public void reset() {
        stepCount = 0;
        totalDistance = 0f;
        Log.d(TAG, "reset() 호출됨 - 스텝 초기화");
    }
    
    public int getStepCount() {
        return stepCount;
    }
    
    public float getTotalDistance() {
        return totalDistance;
    }
    
    public float getEstimatedStepLength() {
        return estimatedStepLength;
    }
}

