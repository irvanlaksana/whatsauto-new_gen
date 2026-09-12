package com.whatsauto.smartai.plugin;

import android.content.Context;
import android.content.SharedPreferences;

import com.whatsauto.smartai.engine.ReplyProgram;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Penyimpanan bersama untuk sisi native: program balasan, cooldown, kontak yang
 * sudah pernah terlihat, dan ring buffer log aktivitas.
 */
public final class AutoReplyStore {

    private static final String PREFS_NAME = "whatsauto_store";
    private static final String KEY_PROGRAM = "program_json";
    private static final String KEY_EVENTS = "events_json";
    private static final String KEY_SEEN = "seen_contacts";
    private static final String KEY_LAST_REPLY_PREFIX = "last_reply_";
    private static final int MAX_EVENTS = 120;

    public interface EventListener {
        void onEvent(JSONObject event);
    }

    private static final List<EventListener> LISTENERS = new ArrayList<>();

    private AutoReplyStore() {
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    // ---------------------------------------------------------------- program

    public static void saveProgram(Context context, String json) {
        prefs(context).edit().putString(KEY_PROGRAM, json).apply();
    }

    public static ReplyProgram loadProgram(Context context) {
        String json = prefs(context).getString(KEY_PROGRAM, null);
        if (json == null || json.isEmpty()) return null;
        try {
            return ReplyProgram.fromJson(json);
        } catch (JSONException error) {
            return null;
        }
    }

    public static int programRuleCount(Context context) {
        String json = prefs(context).getString(KEY_PROGRAM, null);
        if (json == null) return 0;
        try {
            JSONArray rules = new JSONObject(json).optJSONArray("rules");
            return rules == null ? 0 : rules.length();
        } catch (JSONException error) {
            return 0;
        }
    }

    // --------------------------------------------------------------- cooldown

    public static void markReply(Context context, String phone, long atMs) {
        prefs(context).edit().putLong(KEY_LAST_REPLY_PREFIX + phone, atMs).apply();
    }

    public static Map<String, Long> lastReplyMap(Context context) {
        Map<String, Long> result = new HashMap<>();
        Map<String, ?> all = prefs(context).getAll();
        for (Map.Entry<String, ?> entry : all.entrySet()) {
            if (entry.getKey().startsWith(KEY_LAST_REPLY_PREFIX) && entry.getValue() instanceof Long) {
                result.put(entry.getKey().substring(KEY_LAST_REPLY_PREFIX.length()), (Long) entry.getValue());
            }
        }
        return result;
    }

    // ------------------------------------------------------- kontak terlihat

    public static boolean isFirstMessage(Context context, String key) {
        String stored = prefs(context).getString(KEY_SEEN, "");
        return !("," + stored + ",").contains("," + key + ",");
    }

    public static void markSeen(Context context, String key) {
        String stored = prefs(context).getString(KEY_SEEN, "");
        if (("," + stored + ",").contains("," + key + ",")) return;
        String[] parts = (stored.isEmpty() ? key : stored + "," + key).split(",");
        StringBuilder trimmed = new StringBuilder();
        int start = Math.max(0, parts.length - 400);
        for (int i = start; i < parts.length; i++) {
            if (trimmed.length() > 0) trimmed.append(",");
            trimmed.append(parts[i]);
        }
        prefs(context).edit().putString(KEY_SEEN, trimmed.toString()).apply();
    }

    // ----------------------------------------------------------------- events

    public static void pushEvent(Context context, String kind, String message, String detail) {
        JSONObject event = new JSONObject();
        try {
            java.text.SimpleDateFormat format = new java.text.SimpleDateFormat(
                    "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            format.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
            event.put("id", "evt_" + System.currentTimeMillis() + "_" + (int) (Math.random() * 1000));
            event.put("at", format.format(new java.util.Date()));
            event.put("kind", kind);
            event.put("message", message);
            if (detail != null && !detail.isEmpty()) event.put("detail", detail);
        } catch (JSONException error) {
            return;
        }

        JSONArray events = rawEvents(context);
        events.put(event);
        while (events.length() > MAX_EVENTS) {
            events.remove(0);
        }
        prefs(context).edit().putString(KEY_EVENTS, events.toString()).apply();

        for (EventListener listener : snapshot()) {
            listener.onEvent(event);
        }
    }

    private static JSONArray rawEvents(Context context) {
        String raw = prefs(context).getString(KEY_EVENTS, "[]");
        try {
            return new JSONArray(raw);
        } catch (JSONException error) {
            return new JSONArray();
        }
    }

    /** Event terbaru lebih dulu, supaya UI tinggal menampilkan. */
    public static JSONArray events(Context context, int limit) {
        JSONArray all = rawEvents(context);
        JSONArray result = new JSONArray();
        int start = Math.max(0, all.length() - limit);
        for (int i = all.length() - 1; i >= start; i--) {
            result.put(all.opt(i));
        }
        return result;
    }

    public static void clearEvents(Context context) {
        prefs(context).edit().putString(KEY_EVENTS, "[]").apply();
    }

    // -------------------------------------------------------------- listener

    public static void addListener(EventListener listener) {
        synchronized (LISTENERS) {
            if (!LISTENERS.contains(listener)) LISTENERS.add(listener);
        }
    }

    public static void removeListener(EventListener listener) {
        synchronized (LISTENERS) {
            LISTENERS.remove(listener);
        }
    }

    private static List<EventListener> snapshot() {
        synchronized (LISTENERS) {
            return new ArrayList<>(LISTENERS);
        }
    }
}
