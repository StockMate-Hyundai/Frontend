package com.stockmate.app;

import com.getcapacitor.BridgeActivity;
import java.util.Arrays;
import java.util.List;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // PedometerPlugin 수동 등록
        // Capacitor 7에서는 로컬 플러그인을 자동으로 스캔하지 못할 수 있으므로
        // MainActivity에서 수동으로 등록합니다.
        this.init(savedInstanceState, Arrays.asList(
            PedometerPlugin.class
        ));
    }
}
