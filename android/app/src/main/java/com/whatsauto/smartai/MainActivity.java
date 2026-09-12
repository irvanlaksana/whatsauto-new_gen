package com.whatsauto.smartai;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.whatsauto.smartai.plugin.AutoReplyPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Registrasi plugin harus terjadi sebelum super.onCreate().
        registerPlugin(AutoReplyPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
