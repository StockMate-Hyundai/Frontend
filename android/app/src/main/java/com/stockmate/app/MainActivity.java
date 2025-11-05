package com.stockmate.app;

import com.getcapacitor.BridgeActivity;
import com.stockmate.app.StepCounterPlugin;

public class MainActivity extends BridgeActivity {
    static {
        // StepCounter 플러그인 수동 등록
        registerPlugin(StepCounterPlugin.class);
    }
}
