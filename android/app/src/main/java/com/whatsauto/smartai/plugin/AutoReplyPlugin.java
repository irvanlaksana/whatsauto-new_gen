package com.whatsauto.smartai.plugin;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.whatsauto.smartai.engine.ReplyProgram;
import com.whatsauto.smartai.service.ChatAutomationService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;

/**
 * Jembatan JavaScript ↔ Android.
 *
 * Selain meneruskan program balasan ke layanan latar belakang, plugin ini juga
 * menjalankan permintaan HTTP (Google Sheets, Gemini) agar WebView tidak
 * terbentur CORS.
 */
@CapacitorPlugin(name = "AutoReply")
public class AutoReplyPlugin extends Plugin {

    private static final String EVENT_NAME = "autoReplyEvent";

    private final AutoReplyStore.EventListener eventListener = new AutoReplyStore.EventListener() {
        @Override
        public void onEvent(JSONObject event) {
            try {
                notifyListeners(EVENT_NAME, new JSObject(event.toString()));
            } catch (Exception ignored) {
                /* event tidak kritikal */
            }
        }
    };

    @Override
    public void load() {
        AutoReplyStore.addListener(eventListener);
    }

    @Override
    protected void handleOnDestroy() {
        AutoReplyStore.removeListener(eventListener);
        super.handleOnDestroy();
    }

    @PluginMethod
    public void ping(PluginCall call) {
        JSObject result = new JSObject();
        result.put("ok", true);
        result.put("version", "1.0");
        call.resolve(result);
    }

    @PluginMethod
    public void getPermissions(PluginCall call) {
        JSObject result = new JSObject();
        ReplyProgram program = AutoReplyStore.loadProgram(getContext());
        result.put("notificationListener", isNotificationListenerEnabled());
        result.put("accessibility", isAccessibilityEnabled());
        result.put("programLoaded", program != null);
        result.put("ruleCount", program == null ? 0 : program.rules.size());
        result.put("automationRunning", ChatAutomationService.isRunning());
        result.put("supported", true);
        call.resolve(result);
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        openSettings(new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS"), call);
    }

    @PluginMethod
    public void openAccessibilitySettings(PluginCall call) {
        openSettings(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS), call);
    }

    private void openSettings(Intent intent, PluginCall call) {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            try {
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                fallback.setData(Uri.parse("package:" + getContext().getPackageName()));
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallback);
                call.resolve();
            } catch (Exception second) {
                call.reject("Tidak bisa membuka pengaturan: " + second.getMessage());
            }
        }
    }

    @PluginMethod
    public void setProgram(PluginCall call) {
        JSONObject program = call.getObject("program");
        if (program == null) {
            call.reject("Program kosong.");
            return;
        }
        AutoReplyStore.saveProgram(getContext(), program.toString());
        AutoReplyStore.pushEvent(
                getContext(),
                "automation",
                "Program balasan diperbarui",
                AutoReplyStore.programRuleCount(getContext()) + " aturan dimuat ke layanan Android");

        JSObject result = new JSObject();
        result.put("ok", true);
        result.put("ruleCount", AutoReplyStore.programRuleCount(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void getProgramInfo(PluginCall call) {
        ReplyProgram program = AutoReplyStore.loadProgram(getContext());
        JSObject result = new JSObject();
        result.put("ruleCount", program == null ? 0 : program.rules.size());
        result.put("generatedAt", program == null ? "" : program.generatedAt);
        call.resolve(result);
    }

    @PluginMethod
    public void getEvents(PluginCall call) {
        int limit = call.getInt("limit", 60);
        JSONArray events = AutoReplyStore.events(getContext(), limit);
        JSObject result = new JSObject();
        result.put("events", toJsonArray(events));
        call.resolve(result);
    }

    @PluginMethod
    public void clearEvents(PluginCall call) {
        AutoReplyStore.clearEvents(getContext());
        call.resolve();
    }

    @PluginMethod
    public void request(PluginCall call) {
        final String url = call.getString("url");
        final String method = call.getString("method", "GET");
        final String body = call.getString("body", "");
        final int timeout = call.getInt("timeoutMs", 20000);
        final JSONObject headers = call.getObject("headers");

        if (url == null || url.isEmpty()) {
            call.reject("URL kosong.");
            return;
        }

        // bridge.execute() menjalankan Runnable di thread pool Capacitor (bukan UI thread).
        bridge.execute(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection connection = null;
                try {
                    connection = (HttpURLConnection) new URL(url).openConnection();
                    connection.setRequestMethod(method);
                    connection.setConnectTimeout(timeout);
                    connection.setReadTimeout(timeout);
                    connection.setInstanceFollowRedirects(true);

                    if (headers != null) {
                        Iterator<String> keys = headers.keys();
                        while (keys.hasNext()) {
                            String key = keys.next();
                            connection.setRequestProperty(key, headers.optString(key, ""));
                        }
                    }

                    if (!body.isEmpty()) {
                        connection.setDoOutput(true);
                        try (OutputStream stream = connection.getOutputStream()) {
                            stream.write(body.getBytes(StandardCharsets.UTF_8));
                        }
                    }

                    int status = connection.getResponseCode();
                    InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
                    String payload = readAll(stream);

                    JSObject result = new JSObject();
                    result.put("ok", status >= 200 && status < 300);
                    result.put("status", status);
                    result.put("body", payload);
                    call.resolve(result);
                } catch (Exception error) {
                    JSObject result = new JSObject();
                    result.put("ok", false);
                    result.put("status", 0);
                    result.put("body", "");
                    result.put("error", error.getMessage() == null ? "network error" : error.getMessage());
                    call.resolve(result);
                } finally {
                    if (connection != null) connection.disconnect();
                }
            }
        });
    }

    private static JSArray toJsonArray(JSONArray source) {
        JSArray result = new JSArray();
        for (int i = 0; i < source.length(); i++) {
            result.put(source.opt(i));
        }
        return result;
    }

    private static String readAll(InputStream stream) throws Exception {
        if (stream == null) return "";
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                builder.append(line).append('\n');
            }
        }
        return builder.toString();
    }

    private boolean isNotificationListenerEnabled() {
        try {
            return NotificationManagerCompat.getEnabledListenerPackages(getContext())
                    .contains(getContext().getPackageName());
        } catch (Exception error) {
            return false;
        }
    }

    private boolean isAccessibilityEnabled() {
        try {
            String expected = getContext().getPackageName() + "/" + ChatAutomationService.class.getName();
            String enabled = Settings.Secure.getString(
                    getContext().getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
            return enabled != null && enabled.contains(expected);
        } catch (Exception error) {
            return false;
        }
    }
}
