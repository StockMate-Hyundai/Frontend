package com.stockmate.app;

import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "StepCounter")
public class StepCounterPlugin extends Plugin implements SensorEventListener {

    private SensorManager sensorManager;
    private Sensor stepCounterSensor;
    private int totalSteps = 0;
    private int initialSteps = 0;
    private boolean isTracking = false;

    @Override
    public void load() {
        super.load();
        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        }
    }

    @PluginMethod
    public void getSteps(PluginCall call) {
        if (stepCounterSensor == null) {
            call.reject("Step Counter 센서를 사용할 수 없습니다");
            return;
        }

        // 센서 리스너 등록 (한 번만)
        if (!isTracking) {
            sensorManager.registerListener(this, stepCounterSensor, SensorManager.SENSOR_DELAY_NORMAL);
            isTracking = true;
        }

        JSObject ret = new JSObject();
        ret.put("steps", totalSteps);
        call.resolve(ret);
    }

    @PluginMethod
    public void startTracking(PluginCall call) {
        if (stepCounterSensor == null) {
            call.reject("Step Counter 센서를 사용할 수 없습니다");
            return;
        }

        sensorManager.registerListener(this, stepCounterSensor, SensorManager.SENSOR_DELAY_NORMAL);
        initialSteps = totalSteps;
        isTracking = true;

        JSObject ret = new JSObject();
        ret.put("initialSteps", initialSteps);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        if (sensorManager != null && isTracking) {
            sensorManager.unregisterListener(this);
            isTracking = false;
        }
        call.resolve();
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_STEP_COUNTER) {
            totalSteps = (int) event.values[0];
            
            // JavaScript로 이벤트 전송
            JSObject ret = new JSObject();
            ret.put("steps", totalSteps);
            notifyListeners("stepUpdate", ret);
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // 정확도 변경 처리 (필요시)
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (sensorManager != null && isTracking) {
            sensorManager.unregisterListener(this);
        }
    }
}

