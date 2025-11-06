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
        stepCount = 0;
        totalDistance = 0f;
        
        if (stepDetectorSensor != null) {
            // 여러 지연 옵션 시도
            boolean registered = sensorManager.registerListener(this, stepDetectorSensor, SensorManager.SENSOR_DELAY_UI);
            if (!registered) {
                registered = sensorManager.registerListener(this, stepDetectorSensor, SensorManager.SENSOR_DELAY_NORMAL);
            }
            if (!registered) {
                registered = sensorManager.registerListener(this, stepDetectorSensor, SensorManager.SENSOR_DELAY_GAME);
            }
            if (!registered) {
                registered = sensorManager.registerListener(this, stepDetectorSensor, SensorManager.SENSOR_DELAY_FASTEST);
            }
            
            if (registered && listener != null) {
                listener.onStepCountUpdate(0, 0f);
            }
        }
    }
    
    public void stopTracking() {
        sensorManager.unregisterListener(this);
    }
    
    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_STEP_DETECTOR) {
            // 각 스텝이 감지될 때마다 호출됨
            stepCount++;
            totalDistance = stepCount * estimatedStepLength;
            
            
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

