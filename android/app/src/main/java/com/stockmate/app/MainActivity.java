package com.stockmate.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // Capacitor 7에서는 @CapacitorPlugin 어노테이션이 있는 플러그인을 자동으로 스캔합니다.
    // StepCounterPlugin은 @CapacitorPlugin(name = "StepCounter")로 선언되어 있으므로
    // 별도의 수동 등록이 필요 없습니다.
    // 
    // 만약 자동 스캔이 작동하지 않는다면, Capacitor의 플러그인 스캔 메커니즘을 확인해야 합니다.
}
