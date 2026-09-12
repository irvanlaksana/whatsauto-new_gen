package com.whatsauto.smartai.engine;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

/**
 * Model program balasan yang dikirim dari UI (hasil sinkronisasi spreadsheet).
 * Bentuk JSON-nya identik dengan tipe {@code ReplyProgram} di TypeScript.
 */
public final class ReplyProgram {

    public boolean autoReplyEnabled = true;
    public String welcomeMessage = "";
    public String defaultReply = "";
    public double cooldownMinutes = 2;
    public long replyDelayMs = 800L;
    public String hoursMode = "always";
    public String hoursStart = "08:00";
    public String hoursEnd = "22:00";
    public String contactPolicy = "everyone";
    public boolean replyToGroups = false;
    /** AI hanya dieksekusi saat UI terbuka; native memakainya untuk tidak membalas ganda. */
    public boolean aiEnabled = false;
    public String aiMode = "fallback";
    public List<String> channels = new ArrayList<>();
    public List<Rule> rules = new ArrayList<>();
    public List<Contact> whitelist = new ArrayList<>();
    public List<Contact> blacklist = new ArrayList<>();
    public String generatedAt = "";
    public int version = 0;

    public static final class Rule {
        public String id = "";
        public String keyword = "";
        public String matchType = "contains";
        public String reply = "";
        public boolean active = true;
        /** null = memakai jeda global. */
        public Long delayMs = null;
        public int priority = 0;
        public List<String> channels = new ArrayList<>();
        public String source = "manual";
        public Map<String, String> extra = new HashMap<>();
    }

    public static final class Contact {
        public String name = "";
        public String phone = "";
    }

    private ReplyProgram() {
    }

    public static ReplyProgram fromJson(String json) throws JSONException {
        ReplyProgram program = new ReplyProgram();
        JSONObject root = new JSONObject(json);
        JSONObject settings = root.optJSONObject("settings");
        if (settings != null) {
            program.autoReplyEnabled = settings.optBoolean("autoReplyEnabled", true);
            program.welcomeMessage = settings.optString("welcomeMessage", "");
            program.defaultReply = settings.optString("defaultReply", "");
            program.cooldownMinutes = settings.optDouble("cooldownMinutes", 2);
            program.replyDelayMs = (long) settings.optDouble("replyDelayMs", 800);
            program.contactPolicy = settings.optString("contactPolicy", "everyone");
            program.replyToGroups = settings.optBoolean("replyToGroups", false);

            JSONObject hours = settings.optJSONObject("activeHours");
            if (hours != null) {
                program.hoursMode = hours.optString("mode", "always");
                program.hoursStart = hours.optString("start", "08:00");
                program.hoursEnd = hours.optString("end", "22:00");
            }

            JSONObject ai = settings.optJSONObject("ai");
            if (ai != null) {
                program.aiEnabled = ai.optBoolean("enabled", false);
                program.aiMode = ai.optString("mode", "fallback");
            }

            JSONArray channels = settings.optJSONArray("channels");
            if (channels != null) {
                for (int i = 0; i < channels.length(); i++) {
                    program.channels.add(channels.optString(i));
                }
            }
        }

        JSONArray rules = root.optJSONArray("rules");
        if (rules != null) {
            for (int i = 0; i < rules.length(); i++) {
                JSONObject item = rules.optJSONObject(i);
                if (item == null) continue;
                Rule rule = new Rule();
                rule.id = item.optString("id", "rule_" + i);
                rule.keyword = item.optString("keyword", "");
                rule.matchType = item.optString("matchType", "contains");
                rule.reply = item.optString("reply", "");
                rule.active = item.optBoolean("active", true);
                rule.priority = item.optInt("priority", 0);
                rule.source = item.optString("source", "manual");
                rule.delayMs = item.isNull("delayMs") ? null : (long) item.optDouble("delayMs", 0);

                JSONArray ruleChannels = item.optJSONArray("channels");
                if (ruleChannels != null) {
                    for (int c = 0; c < ruleChannels.length(); c++) {
                        rule.channels.add(ruleChannels.optString(c));
                    }
                }

                JSONObject extra = item.optJSONObject("extra");
                if (extra != null) {
                    Iterator<String> keys = extra.keys();
                    while (keys.hasNext()) {
                        String key = keys.next();
                        rule.extra.put(key, extra.optString(key, ""));
                    }
                }
                program.rules.add(rule);
            }
        }

        readContacts(root.optJSONArray("whitelist"), program.whitelist);
        readContacts(root.optJSONArray("blacklist"), program.blacklist);
        program.generatedAt = root.optString("generatedAt", "");
        program.version = root.optInt("version", 0);
        return program;
    }

    private static void readContacts(JSONArray array, List<Contact> target) {
        if (array == null) return;
        for (int i = 0; i < array.length(); i++) {
            JSONObject item = array.optJSONObject(i);
            if (item == null) continue;
            Contact contact = new Contact();
            contact.name = item.optString("name", "");
            contact.phone = item.optString("phone", "");
            target.add(contact);
        }
    }

    public int activeRuleCount() {
        int count = 0;
        for (Rule rule : rules) {
            if (rule.active) count++;
        }
        return count;
    }
}
