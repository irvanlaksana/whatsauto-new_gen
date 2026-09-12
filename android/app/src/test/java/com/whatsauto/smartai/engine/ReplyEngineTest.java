package com.whatsauto.smartai.engine;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.Calendar;
import java.util.HashMap;
import java.util.Map;

/**
 * Unit test JVM untuk mesin balasan native.
 *
 * JSON di bawah ini persis seperti yang dikirim UI (hasil sinkronisasi
 * spreadsheet), jadi test ini sekaligus memverifikasi parsing
 * {@link ReplyProgram} dan logika {@link ReplyEngine} tanpa perangkat/emulator.
 * Cermin dari tests/engine.test.ts — bila salah satu diubah, ubah keduanya.
 */
public class ReplyEngineTest {

    private static final String PROGRAM_JSON = "{"
            + "\"version\":3,"
            + "\"generatedAt\":\"2026-09-12T00:00:00.000Z\","
            + "\"settings\":{"
            + "  \"autoReplyEnabled\":true,"
            + "  \"welcomeMessage\":\"Halo {sender}, ada yang bisa dibantu?\","
            + "  \"defaultReply\":\"Maaf belum dikenali.\","
            + "  \"cooldownMinutes\":2,"
            + "  \"replyDelayMs\":800,"
            + "  \"activeHours\":{\"mode\":\"custom\",\"start\":\"22:00\",\"end\":\"02:00\"},"
            + "  \"contactPolicy\":\"everyone\","
            + "  \"replyToGroups\":false,"
            + "  \"channels\":[\"whatsapp\",\"whatsapp_business\",\"telegram\"],"
            + "  \"ai\":{\"enabled\":false,\"mode\":\"fallback\"}"
            + "},"
            + "\"rules\":["
            + rule("sheet_2_harga", "harga", "contains", "Harga {produk} Rp {harga} ya Kak {sender}",
                    true, 0, 5, "sheet", "[]", "{\"produk\":\"Paket Hemat\",\"harga\":\"125000\"}") + ","
            + rule("manual_menu", "menu", "contains", "Daftar layanan kami",
                    true, -1, 0, "manual", "[]", "{}") + ","
            + rule("sheet_exact_admin", "admin", "exact", "Admin segera membalas",
                    true, -1, 0, "sheet", "[]", "{}") + ","
            + rule("manual_contains_admin", "admin", "contains", "contains admin",
                    true, -1, 0, "manual", "[]", "{}") + ","
            + rule("sheet_promo_off", "promo", "contains", "TIDAK BOLEH MUNCUL",
                    false, -1, 99, "sheet", "[]", "{}") + ","
            + rule("manual_regex_hai", "^(hai|halo)$", "regex", "hai juga",
                    true, -1, 0, "manual", "[\"telegram\"]", "{}") + ","
            + rule("sheet_ongkir_low", "ongkir", "contains", "ongkir murah",
                    true, -1, 1, "sheet", "[]", "{}") + ","
            + rule("sheet_ongkir_high", "ongkir", "contains", "ongkir gratis",
                    true, -1, 9, "sheet", "[]", "{}") + ","
            + rule("manual_regex_rusak", "([", "regex", "TIDAK BOLEH MUNCUL",
                    true, -1, 0, "manual", "[]", "{}")
            + "],"
            + "\"whitelist\":[{\"name\":\"Budi\",\"phone\":\"+6281234567890\"}],"
            + "\"blacklist\":[{\"name\":\"Spam\",\"phone\":\"+628111999222\"}]"
            + "}";

    private static String rule(String id, String keyword, String matchType, String reply,
                               boolean active, int delayMs, int priority, String source,
                               String channels, String extra) {
        String delay = delayMs < 0 ? "null" : String.valueOf(delayMs);
        return "{\"id\":\"" + id + "\",\"keyword\":\"" + keyword + "\",\"matchType\":\"" + matchType
                + "\",\"reply\":\"" + reply + "\",\"active\":" + active + ",\"delayMs\":" + delay
                + ",\"priority\":" + priority + ",\"source\":\"" + source + "\",\"channels\":" + channels
                + ",\"extra\":" + extra + "}";
    }

    private static ReplyProgram program() throws Exception {
        return ReplyProgram.fromJson(PROGRAM_JSON);
    }

    /** Timestamp pada jam lokal tertentu agar test tidak tergantung zona waktu runner. */
    private static long at(int hour, int minute) {
        Calendar calendar = Calendar.getInstance();
        calendar.set(2026, Calendar.SEPTEMBER, 12, hour, minute, 0);
        calendar.set(Calendar.MILLISECOND, 0);
        return calendar.getTimeInMillis();
    }

    private static ReplyEngine.Incoming incoming(String sender, String text) {
        ReplyEngine.Incoming message = new ReplyEngine.Incoming();
        message.sender = sender;
        message.phone = "";
        message.text = text;
        message.channel = "whatsapp";
        message.isGroup = false;
        message.isFirstMessage = false;
        return message;
    }

    private static Map<String, Long> noCooldown() {
        return new HashMap<>();
    }

    // ------------------------------------------------------------- parsing

    @Test
    public void parsesProgramFromUiJson() throws Exception {
        ReplyProgram program = program();
        assertEquals(3, program.version);
        assertEquals(9, program.rules.size());
        assertTrue(program.autoReplyEnabled);
        assertEquals(2, program.cooldownMinutes, 0.0001);
        assertEquals(800L, program.replyDelayMs);
        assertEquals("custom", program.hoursMode);
        assertEquals(3, program.channels.size());
        assertEquals(1, program.whitelist.size());
        assertEquals(1, program.blacklist.size());
        assertEquals(8, program.activeRuleCount());

        ReplyProgram.Rule harga = program.rules.get(0);
        assertEquals(Long.valueOf(0L), harga.delayMs);
        assertEquals("Paket Hemat", harga.extra.get("produk"));

        ReplyProgram.Rule menu = program.rules.get(1);
        assertNull("delayMs null berarti pakai jeda global", menu.delayMs);
    }

    // ------------------------------------------------------------- aturan

    @Test
    public void matchesSheetRuleAndRendersVariables() throws Exception {
        ReplyEngine.Decision decision = ReplyEngine.decide(
                program(), incoming("Rina", "harga berapa ya?"), at(23, 30), noCooldown());

        assertTrue(decision.shouldReply);
        assertEquals("sheet", decision.source);
        assertEquals("matched", decision.reason);
        assertEquals("Harga Paket Hemat Rp 125000 ya Kak Rina", decision.text);
        assertEquals(0L, decision.delayMs);
    }

    @Test
    public void exactBeatsContainsOnSamePriority() throws Exception {
        ReplyEngine.Decision decision = ReplyEngine.decide(
                program(), incoming("Rina", "admin"), at(23, 30), noCooldown());
        assertEquals("Admin segera membalas", decision.text);
    }

    @Test
    public void higherPriorityWins() throws Exception {
        ReplyEngine.Decision decision = ReplyEngine.decide(
                program(), incoming("Rina", "ongkir berapa?"), at(23, 30), noCooldown());
        assertEquals("ongkir gratis", decision.text);
    }

    @Test
    public void inactiveRuleIsSkippedAndFallsBackToDefault() throws Exception {
        ReplyEngine.Decision decision = ReplyEngine.decide(
                program(), incoming("Rina", "ada promo?"), at(23, 30), noCooldown());
        assertEquals("default", decision.source);
        assertEquals("Maaf belum dikenali.", decision.text);
    }

    @Test
    public void invalidRegexDoesNotCrash() throws Exception {
        ReplyEngine.Decision decision = ReplyEngine.decide(
                program(), incoming("Rina", "([ bingung"), at(23, 30), noCooldown());
        assertEquals("default", decision.source);
    }

    @Test
    public void ruleChannelFilterIsRespected() throws Exception {
        ReplyEngine.Incoming onTelegram = incoming("Rina", "hai");
        onTelegram.channel = "telegram";
        assertEquals("hai juga",
                ReplyEngine.decide(program(), onTelegram, at(23, 30), noCooldown()).text);

        ReplyEngine.Incoming onWhatsapp = incoming("Rina", "hai");
        assertEquals("Maaf belum dikenali.",
                ReplyEngine.decide(program(), onWhatsapp, at(23, 30), noCooldown()).text);
    }

    @Test
    public void disabledChannelIsIgnored() throws Exception {
        ReplyEngine.Incoming message = incoming("Rina", "menu");
        message.channel = "instagram";
        ReplyEngine.Decision decision = ReplyEngine.decide(program(), message, at(23, 30), noCooldown());
        assertFalse(decision.shouldReply);
        assertEquals("channel_off", decision.reason);
    }

    // ---------------------------------------------------------- kebijakan

    @Test
    public void welcomeMessageWinsForFirstMessage() throws Exception {
        ReplyEngine.Incoming message = incoming("Rina", "harga");
        message.isFirstMessage = true;
        ReplyEngine.Decision decision = ReplyEngine.decide(program(), message, at(23, 30), noCooldown());
        assertEquals("welcome", decision.source);
        assertEquals("Halo Rina, ada yang bisa dibantu?", decision.text);
    }

    @Test
    public void blacklistAlwaysWins() throws Exception {
        ReplyEngine.Incoming message = incoming("Spam", "menu");
        message.phone = "+628111999222";
        ReplyEngine.Decision decision = ReplyEngine.decide(program(), message, at(23, 30), noCooldown());
        assertFalse(decision.shouldReply);
        assertEquals("blacklisted", decision.reason);
    }

    @Test
    public void whitelistPolicyIsEnforced() throws Exception {
        ReplyProgram program = program();
        program.contactPolicy = "whitelist";

        ReplyEngine.Incoming stranger = incoming("Rina", "menu");
        stranger.phone = "+628999000111";
        assertEquals("not_whitelisted",
                ReplyEngine.decide(program, stranger, at(23, 30), noCooldown()).reason);

        ReplyEngine.Incoming listed = incoming("Budi", "menu");
        listed.phone = "081234567890";
        assertTrue(ReplyEngine.decide(program, listed, at(23, 30), noCooldown()).shouldReply);
    }

    @Test
    public void cooldownUsesIdentityWhenPhoneIsMissing() throws Exception {
        ReplyProgram program = program();
        ReplyEngine.Incoming message = incoming("Rina", "menu");
        long now = at(23, 30);

        assertTrue(ReplyEngine.decide(program, message, now, noCooldown()).shouldReply);

        Map<String, Long> lastReply = new HashMap<>();
        lastReply.put(ReplyEngine.identityKey(message), now);
        ReplyEngine.Decision blocked =
                ReplyEngine.decide(program, message, now + 30_000L, lastReply);
        assertFalse(blocked.shouldReply);
        assertEquals("cooldown", blocked.reason);

        ReplyEngine.Decision afterWindow =
                ReplyEngine.decide(program, message, now + 3 * 60_000L, lastReply);
        assertTrue(afterWindow.shouldReply);
    }

    @Test
    public void activeHoursSupportOvernightRange() throws Exception {
        ReplyProgram program = program();
        ReplyEngine.Incoming message = incoming("Rina", "menu");

        assertEquals("matched", ReplyEngine.decide(program, message, at(23, 30), noCooldown()).reason);
        assertEquals("matched", ReplyEngine.decide(program, message, at(1, 15), noCooldown()).reason);
        assertEquals("outside_hours", ReplyEngine.decide(program, message, at(12, 0), noCooldown()).reason);
    }

    @Test
    public void groupsAreIgnoredUnlessAllowed() throws Exception {
        ReplyProgram program = program();
        ReplyEngine.Incoming message = incoming("Rina", "menu");
        message.isGroup = true;

        assertEquals("group_ignored", ReplyEngine.decide(program, message, at(23, 30), noCooldown()).reason);

        program.replyToGroups = true;
        assertTrue(ReplyEngine.decide(program, message, at(23, 30), noCooldown()).shouldReply);
    }

    @Test
    public void aiModeSkipsNativeReplyToAvoidDoubleAnswer() throws Exception {
        ReplyProgram program = program();
        program.aiEnabled = true;
        program.aiMode = "fallback";

        ReplyEngine.Decision fallback =
                ReplyEngine.decide(program, incoming("Rina", "zzz"), at(23, 30), noCooldown());
        assertFalse(fallback.shouldReply);
        assertEquals("ai_pending", fallback.reason);

        program.aiMode = "always";
        assertEquals("ai_pending",
                ReplyEngine.decide(program, incoming("Rina", "menu"), at(23, 30), noCooldown()).reason);
    }

    @Test
    public void masterSwitchDisablesEverything() throws Exception {
        ReplyProgram program = program();
        program.autoReplyEnabled = false;
        assertEquals("disabled",
                ReplyEngine.decide(program, incoming("Rina", "menu"), at(23, 30), noCooldown()).reason);
    }

    @Test
    public void backendRulesAreLabelledAsBackend() throws Exception {
        ReplyProgram program = program();
        ReplyProgram.Rule backendRule = new ReplyProgram.Rule();
        backendRule.id = "backend_1";
        backendRule.keyword = "kurir";
        backendRule.matchType = "contains";
        backendRule.reply = "Kurir tersedia";
        backendRule.active = true;
        backendRule.source = "backend";
        program.rules.add(backendRule);

        ReplyEngine.Decision decision =
                ReplyEngine.decide(program, incoming("Rina", "kurir apa saja?"), at(23, 30), noCooldown());
        assertTrue(decision.shouldReply);
        assertEquals("backend", decision.source);
        assertEquals("Kurir tersedia", decision.text);
    }

    @Test
    public void sourceLabelMapsManualToRule() {
        assertEquals("sheet", ReplyEngine.sourceLabel("sheet"));
        assertEquals("backend", ReplyEngine.sourceLabel("backend"));
        assertEquals("rule", ReplyEngine.sourceLabel("manual"));
        assertEquals("rule", ReplyEngine.sourceLabel(null));
    }

    @Test
    public void identityKeyFallsBackToSenderName() {
        ReplyEngine.Incoming withPhone = incoming("Rina", "menu");
        withPhone.phone = "081234567890";
        assertEquals("6281234567890", ReplyEngine.identityKey(withPhone));

        assertEquals("rina", ReplyEngine.identityKey(incoming("Rina", "menu")));
    }
}
