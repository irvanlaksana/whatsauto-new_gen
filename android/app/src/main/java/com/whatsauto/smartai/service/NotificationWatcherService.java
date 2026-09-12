package com.whatsauto.smartai.service;

import android.app.Notification;
import android.app.PendingIntent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.text.SpannableString;

import com.whatsauto.smartai.engine.ReplyEngine;
import com.whatsauto.smartai.engine.ReplyProgram;
import com.whatsauto.smartai.plugin.AutoReplyStore;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Membaca notifikasi pesan masuk lalu meminta balasan ke {@link ReplyEngine}.
 * Balasan dikirim melalui {@link ChatAutomationService}.
 */
public class NotificationWatcherService extends NotificationListenerService {

    private static final Map<String, String> PACKAGE_TO_CHANNEL = new HashMap<>();

    static {
        PACKAGE_TO_CHANNEL.put("com.whatsapp", "whatsapp");
        PACKAGE_TO_CHANNEL.put("com.whatsapp.w4b", "whatsapp_business");
        PACKAGE_TO_CHANNEL.put("org.telegram.messenger", "telegram");
        PACKAGE_TO_CHANNEL.put("org.telegram.plus", "telegram");
        PACKAGE_TO_CHANNEL.put("org.telegram.messenger.web", "telegram");
        PACKAGE_TO_CHANNEL.put("com.instagram.android", "instagram");
        PACKAGE_TO_CHANNEL.put("com.google.android.apps.messaging", "sms");
        PACKAGE_TO_CHANNEL.put("com.samsung.android.messaging", "sms");
    }

    private final Handler handler = new Handler(Looper.getMainLooper());

    /** Mencegah notifikasi yang sama diproses dua kali. */
    private final LinkedHashMap<String, Boolean> handled =
            new LinkedHashMap<String, Boolean>(24, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Boolean> eldest) {
                    return size() > 60;
                }
            };

    private boolean warnedAboutProgram = false;

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            handle(sbn);
        } catch (Exception error) {
            log("error", "Gagal memproses notifikasi", String.valueOf(error.getMessage()));
        }
    }

    private void handle(StatusBarNotification sbn) throws Exception {
        if (sbn == null || sbn.getNotification() == null) return;

        String packageName = sbn.getPackageName();
        if (packageName == null || packageName.equals(getPackageName())) return;

        String channel = PACKAGE_TO_CHANNEL.get(packageName);
        if (channel == null) return;

        ReplyProgram program = AutoReplyStore.loadProgram(this);
        if (program == null) {
            if (!warnedAboutProgram) {
                warnedAboutProgram = true;
                log("error", "Program balasan belum dimuat", "Buka aplikasi dan tekan “Kirim ulang ke Android”.");
            }
            return;
        }
        warnedAboutProgram = false;

        Notification notification = sbn.getNotification();
        Bundle extras = notification.extras;
        if (extras == null) return;

        String title = text(extras.getCharSequence(Notification.EXTRA_TITLE));
        String body = text(extras.getCharSequence(Notification.EXTRA_TEXT));
        if (body.isEmpty()) body = text(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
        if (body.isEmpty()) body = joinLines(extras);
        if (body.isEmpty()) return;

        boolean isGroup = extras.getBoolean(Notification.EXTRA_IS_GROUP_CONVERSATION)
                || (notification.flags & Notification.FLAG_GROUP_SUMMARY) != 0;

        String sender = title;
        if (isGroup && body.contains(":")) {
            int split = body.indexOf(':');
            if (split > 0 && split < 40) {
                sender = body.substring(0, split).trim();
                body = body.substring(split + 1).trim();
            }
        }
        if (sender.isEmpty()) sender = "Pengirim";

        String dedupeKey = packageName + "|" + sender + "|" + body.hashCode();
        if (handled.containsKey(dedupeKey)) return;
        handled.put(dedupeKey, Boolean.TRUE);

        ReplyEngine.Incoming incoming = new ReplyEngine.Incoming();
        incoming.sender = sender;
        incoming.phone = "";
        incoming.text = body;
        incoming.channel = channel;
        incoming.isGroup = isGroup;

        String identity = ReplyEngine.identityKey(incoming);
        String seenKey = channel + "|" + identity;
        incoming.isFirstMessage = AutoReplyStore.isFirstMessage(this, seenKey);
        AutoReplyStore.markSeen(this, seenKey);

        ReplyEngine.Decision decision =
                ReplyEngine.decide(program, incoming, System.currentTimeMillis(), AutoReplyStore.lastReplyMap(this));

        log("incoming", "Pesan dari " + sender, truncate(body));

        if (!decision.shouldReply) {
            log("skipped", "Tidak dibalas: " + decision.reason, truncate(body));
            return;
        }

        if (decision.text == null || decision.text.trim().isEmpty()) {
            log("skipped", "Balasan kosong (" + decision.reason + ")", null);
            return;
        }

        AutoReplyStore.markReply(this, identity, System.currentTimeMillis());

        final PendingIntent openChat = notification.contentIntent;
        final String replyText = decision.text;
        final String replySender = sender;

        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                dispatch(openChat, replyText, replySender);
            }
        }, Math.max(0, decision.delayMs));
    }

    /** Buka ruang chat lalu ketik balasan. */
    private void dispatch(PendingIntent openChat, String replyText, String sender) {
        if (!ChatAutomationService.isRunning()) {
            log("error", "Layanan aksesibilitas tidak aktif",
                    "Aktifkan di tab Android agar balasan bisa dikirim otomatis.");
            return;
        }

        if (openChat != null) {
            try {
                openChat.send();
            } catch (PendingIntent.CanceledException error) {
                log("error", "Gagal membuka ruang chat", String.valueOf(error.getMessage()));
            }
        } else {
            log("automation", "Notifikasi tanpa intent", "Mencoba membalas di jendela chat yang sedang terbuka.");
        }

        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                ChatAutomationService.sendReply(replyText, sender);
            }
        }, 1400L);
    }

    private static String text(CharSequence value) {
        if (value == null) return "";
        if (value instanceof SpannableString) return value.toString();
        return value.toString().trim();
    }

    private static String joinLines(Bundle extras) {
        CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        if (lines == null || lines.length == 0) return "";
        StringBuilder builder = new StringBuilder();
        for (CharSequence line : lines) {
            if (line == null) continue;
            if (builder.length() > 0) builder.append('\n');
            builder.append(line.toString().trim());
        }
        return builder.toString().trim();
    }

    private static String truncate(String value) {
        if (value == null) return null;
        return value.length() > 120 ? value.substring(0, 117) + "…" : value;
    }

    private void log(String kind, String message, String detail) {
        AutoReplyStore.pushEvent(this, kind, message, detail);
    }

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        log("automation", "Pemantau notifikasi aktif",
                String.format(Locale.US, "Memantau %d aplikasi chat.", PACKAGE_TO_CHANNEL.size()));
    }
}
