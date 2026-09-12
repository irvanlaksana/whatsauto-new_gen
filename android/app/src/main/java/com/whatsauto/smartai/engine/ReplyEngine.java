package com.whatsauto.smartai.engine;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Port Java dari mesin balasan TypeScript (src/lib/engine.ts).
 *
 * Urutan pemeriksaan harus sama persis dengan versi TS agar hasil di simulator
 * dan di perangkat identik:
 * saklar utama → channel → jam aktif → grup → blacklist → whitelist → cooldown
 * → AI(always) → sambutan → aturan → AI(fallback) → default.
 */
public final class ReplyEngine {

    private static final Pattern PLACEHOLDER =
            Pattern.compile("\\{\\s*([a-zA-Z0-9_.\\- ]+)\\s*\\}", Pattern.CASE_INSENSITIVE);
    private static final Pattern NON_ALNUM = Pattern.compile("[^a-z0-9]+");
    private static final String[] DAYS =
            {"Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"};

    private ReplyEngine() {
    }

    public static final class Incoming {
        public String sender = "";
        public String phone = "";
        public String text = "";
        public String channel = "whatsapp";
        public boolean isGroup = false;
        public boolean isFirstMessage = false;
    }

    public static final class Decision {
        public boolean shouldReply = false;
        public String text = "";
        public String source = "none";
        public String reason = "no_match";
        public long delayMs = 0L;
    }

    public static Decision decide(
            ReplyProgram program, Incoming message, long nowMs, Map<String, Long> lastReplyAt) {
        Decision decision = new Decision();
        Calendar now = Calendar.getInstance();
        now.setTimeInMillis(nowMs);

        // 1. Saklar utama.
        if (!program.autoReplyEnabled) return skip(decision, "disabled");

        // 2. Channel aktif.
        if (!program.channels.contains(message.channel)) return skip(decision, "channel_off");

        // 3. Jam operasional.
        if (!withinActiveHours(program, now)) return skip(decision, "outside_hours");

        // 4. Grup.
        if (message.isGroup && !program.replyToGroups) return skip(decision, "group_ignored");

        // 5. Blacklist.
        if (matchesContact(program.blacklist, message)) return skip(decision, "blacklisted");

        // 6. Whitelist.
        if ("whitelist".equals(program.contactPolicy) && !matchesContact(program.whitelist, message)) {
            return skip(decision, "not_whitelisted");
        }

        // 7. Cooldown.
        if (program.cooldownMinutes > 0 && lastReplyAt != null) {
            Long last = lastReplyAt.get(identityKey(message));
            long window = (long) (program.cooldownMinutes * 60_000L);
            if (last != null && last > 0 && nowMs - last < window) return skip(decision, "cooldown");
        }

        // 8. AI selalu — native tidak memanggil AI (butuh UI terbuka), jadi pesan
        //    ditandai agar tidak dibalas ganda oleh balasan default.
        if (program.aiEnabled && "always".equals(program.aiMode)) {
            return skip(decision, "ai_pending");
        }

        // 9. Pesan sambutan.
        if (message.isFirstMessage && !program.welcomeMessage.trim().isEmpty()) {
            decision.shouldReply = true;
            decision.source = "welcome";
            decision.reason = "welcome";
            decision.delayMs = program.replyDelayMs;
            decision.text = render(program.welcomeMessage, message, null, now);
            return decision;
        }

        // 10. Aturan (sheet + manual).
        for (ReplyProgram.Rule rule : sortedRules(program.rules)) {
            if (!rule.active) continue;
            if (!rule.channels.isEmpty() && !rule.channels.contains(message.channel)) continue;
            if (!matchesRule(rule, message.text)) continue;

            decision.shouldReply = true;
            decision.source = "sheet".equals(rule.source) ? "sheet" : "rule";
            decision.reason = "matched";
            decision.delayMs = rule.delayMs != null ? rule.delayMs : program.replyDelayMs;
            decision.text = render(rule.reply, message, rule.extra, now);
            return decision;
        }

        // 11. AI fallback — sama seperti di atas, dilewati saat berjalan di latar
        //     belakang agar tidak membalas dua kali.
        if (program.aiEnabled && "fallback".equals(program.aiMode)) {
            return skip(decision, "ai_pending");
        }

        // 12. Balasan default.
        if (!program.defaultReply.trim().isEmpty()) {
            decision.shouldReply = true;
            decision.source = "default";
            decision.reason = "default";
            decision.delayMs = program.replyDelayMs;
            decision.text = render(program.defaultReply, message, null, now);
            return decision;
        }

        return skip(decision, "no_match");
    }

    private static Decision skip(Decision decision, String reason) {
        decision.shouldReply = false;
        decision.reason = reason;
        decision.source = "none";
        decision.text = "";
        decision.delayMs = 0L;
        return decision;
    }

    private static int matchRank(String matchType) {
        switch (matchType) {
            case "exact":
                return 0;
            case "contains":
                return 1;
            default:
                return 2;
        }
    }

    static List<ReplyProgram.Rule> sortedRules(List<ReplyProgram.Rule> rules) {
        List<ReplyProgram.Rule> copy = new ArrayList<>(rules);
        Collections.sort(copy, new Comparator<ReplyProgram.Rule>() {
            @Override
            public int compare(ReplyProgram.Rule a, ReplyProgram.Rule b) {
                if (a.priority != b.priority) return Integer.compare(b.priority, a.priority);
                int rank = Integer.compare(matchRank(a.matchType), matchRank(b.matchType));
                if (rank != 0) return rank;
                return a.id.compareTo(b.id);
            }
        });
        return copy;
    }

    static boolean matchesRule(ReplyProgram.Rule rule, String text) {
        String input = text == null ? "" : text.trim();
        String keyword = rule.keyword == null ? "" : rule.keyword.trim();
        if (keyword.isEmpty()) return false;

        switch (rule.matchType) {
            case "exact":
                return input.equalsIgnoreCase(keyword);
            case "contains":
                return input.toLowerCase(Locale.ROOT).contains(keyword.toLowerCase(Locale.ROOT));
            case "regex":
                try {
                    return Pattern.compile(keyword, Pattern.CASE_INSENSITIVE).matcher(input).find();
                } catch (Exception error) {
                    return false;
                }
            default:
                return false;
        }
    }

    static boolean withinActiveHours(ReplyProgram program, Calendar now) {
        if (!"custom".equals(program.hoursMode)) return true;
        int start = toMinutes(program.hoursStart);
        int end = toMinutes(program.hoursEnd);
        int current = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        if (start == end) return true;
        return start < end ? (current >= start && current < end) : (current >= start || current < end);
    }

    private static int toMinutes(String value) {
        try {
            String[] parts = value.split(":");
            return Integer.parseInt(parts[0].trim()) * 60 + Integer.parseInt(parts[1].trim());
        } catch (Exception error) {
            return 0;
        }
    }

    /**
     * Kunci identitas pengirim: nomor bila ada, jika tidak pakai nama.
     * Notifikasi Android umumnya tidak membawa nomor telepon.
     */
    public static String identityKey(Incoming message) {
        String phone = normalizePhone(message.phone);
        if (!phone.isEmpty()) return phone;
        return message.sender == null ? "" : message.sender.trim().toLowerCase(Locale.ROOT);
    }

    static String normalizePhone(String phone) {
        if (phone == null) return "";
        String digits = phone.replaceAll("\\D", "");
        if (digits.startsWith("0")) return "62" + digits.substring(1);
        return digits;
    }

    static boolean matchesContact(List<ReplyProgram.Contact> contacts, Incoming message) {
        String phone = normalizePhone(message.phone);
        String sender = message.sender == null ? "" : message.sender.trim().toLowerCase(Locale.ROOT);
        for (ReplyProgram.Contact contact : contacts) {
            String contactPhone = normalizePhone(contact.phone);
            if (!contactPhone.isEmpty() && contactPhone.equals(phone)) return true;
            String name = contact.name == null ? "" : contact.name.trim().toLowerCase(Locale.ROOT);
            if (!name.isEmpty() && name.equals(sender)) return true;
        }
        return false;
    }

    static String normalizeKey(String key) {
        if (key == null) return "";
        String value = Normalizer.normalize(key.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        value = NON_ALNUM.matcher(value).replaceAll("_");
        return value.replaceAll("^_+|_+$", "");
    }

    /** Substitusi variabel, identik dengan src/lib/variables.ts. */
    static String render(
            String template, Incoming message, Map<String, String> extra, Calendar now) {
        Map<String, String> lookup = new HashMap<>();
        String time = String.format(Locale.ROOT, "%02d:%02d",
                now.get(Calendar.HOUR_OF_DAY), now.get(Calendar.MINUTE));
        String date = String.format(Locale.ROOT, "%02d/%02d/%04d",
                now.get(Calendar.DAY_OF_MONTH), now.get(Calendar.MONTH) + 1, now.get(Calendar.YEAR));
        String day = DAYS[now.get(Calendar.DAY_OF_WEEK) - 1];

        lookup.put("sender", message.sender);
        lookup.put("nama", message.sender);
        lookup.put("phone", message.phone);
        lookup.put("nomor", message.phone);
        lookup.put("received_msg", message.text);
        lookup.put("pesan", message.text);
        lookup.put("time", time);
        lookup.put("jam", time);
        lookup.put("date", date);
        lookup.put("tanggal", date);
        lookup.put("datetime", date + " " + time);
        lookup.put("day", day);
        lookup.put("hari", day);
        lookup.put("channel", message.channel);
        lookup.put("platform", message.channel);

        if (extra != null) {
            for (Map.Entry<String, String> entry : extra.entrySet()) {
                String key = normalizeKey(entry.getKey());
                if (!key.isEmpty() && !lookup.containsKey(key)) lookup.put(key, entry.getValue());
            }
        }

        Matcher matcher = PLACEHOLDER.matcher(template);
        StringBuffer output = new StringBuffer();
        while (matcher.find()) {
            String key = normalizeKey(matcher.group(1));
            String replacement = lookup.containsKey(key) ? lookup.get(key) : matcher.group(0);
            matcher.appendReplacement(output, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(output);
        return output.toString();
    }
}
