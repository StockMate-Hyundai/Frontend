package com.stockmate.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.stockmate.app.StepCounterPlugin;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // StepCounter 플러그인 수동 등록
        // Capacitor는 node_modules에 설치된 플러그인만 자동 스캔하므로,
        // 앱 패키지 내의 커스텀 플러그인은 수동으로 등록해야 합니다
        List<Class<? extends Plugin>> plugins = new ArrayList<>();
        plugins.add(StepCounterPlugin.class);
        this.init(savedInstanceState, plugins);
    }
}
