package com.whatsauto.smartai.service;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import com.whatsauto.smartai.plugin.AutoReplyStore;

import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.Deque;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Mengetik balasan ke ruang chat yang sedang terbuka.
 *
 * Pendekatannya generik: cari kolom input teks (EditText) di jendela aktif, isi
 * teksnya, lalu cari tombol kirim. ID resource hanya dipakai sebagai petunjuk
 * agar lebih cepat, bukan syarat mutlak.
 */
public class ChatAutomationService extends AccessibilityService {

    private static final Set<String> INPUT_IDS = new HashSet<>(Arrays.asList(
            "com.whatsapp:id/conversation_text_field",
            "com.whatsapp.w4b:id/conversation_text_field",
            "org.telegram.messenger:id/chat_message_input",
            "org.telegram.plus:id/chat_message_input",
            "com.instagram.android:id/row_thread_composer_input"
    ));

    private static final Set<String> SEND_IDS = new HashSet<>(Arrays.asList(
            "com.whatsapp:id/send",
            "com.whatsapp.w4b:id/send",
            "org.telegram.messenger:id/chat_send_button",
            "org.telegram.plus:id/chat_send_button",
            "com.instagram.android:id/row_thread_composer_button_send"
    ));

    private static final String[] SEND_LABELS = {"send", "kirim", "kirim pesan", "send message"};

    private static ChatAutomationService instance;

    private final Handler handler = new Handler(Looper.getMainLooper());

    public static boolean isRunning() {
        return instance != null;
    }

    public static void sendReply(String text, String sender) {
        ChatAutomationService service = instance;
        // Bila layanan mati, pemanggil (NotificationWatcherService) sudah mencatat errornya.
        if (service == null) return;
        service.attempt(text, sender, 3);
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
        log("automation", "Layanan aksesibilitas siap", null);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // Tidak dipakai: seluruh aksi dipicu dari NotificationWatcherService.
    }

    @Override
    public void onInterrupt() {
        log("automation", "Layanan aksesibilitas terganggu", null);
    }

    @Override
    public boolean onUnbind(Intent intent) {
        instance = null;
        return super.onUnbind(intent);
    }

    @Override
    public void onDestroy() {
        instance = null;
        super.onDestroy();
    }

    /** Coba sampai beberapa kali karena jendela chat butuh waktu untuk terbuka. */
    private void attempt(final String text, final String sender, final int retriesLeft) {
        AccessibilityNodeInfo input = findInput();
        if (input == null) {
            if (retriesLeft > 1) {
                handler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        attempt(text, sender, retriesLeft - 1);
                    }
                }, 700L);
                return;
            }
            log("error", "Kolom pesan tidak ditemukan",
                    "Pastikan ruang chat terbuka dan tampilan WhatsApp standar.");
            return;
        }

        if (!fillInput(input, text)) {
            log("error", "Gagal mengisi kolom pesan", null);
            return;
        }

        AccessibilityNodeInfo sendButton = findSendButton(input);
        if (sendButton == null) {
            log("error", "Tombol kirim tidak ditemukan", "Teks sudah diisi, kirim manual bila perlu.");
            return;
        }

        boolean clicked = sendButton.performAction(AccessibilityNodeInfo.ACTION_CLICK);
        if (!clicked && sendButton.getParent() != null) {
            clicked = sendButton.getParent().performAction(AccessibilityNodeInfo.ACTION_CLICK);
        }

        if (clicked) {
            log("replied", "Balasan terkirim ke " + sender, text);
        } else {
            log("error", "Gagal menekan tombol kirim", null);
        }
    }

    private AccessibilityNodeInfo findInput() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return null;

        AccessibilityNodeInfo fallback = null;
        Deque<AccessibilityNodeInfo> queue = new ArrayDeque<>();
        queue.add(root);

        while (!queue.isEmpty()) {
            AccessibilityNodeInfo node = queue.poll();
            if (node == null) continue;

            String id = node.getViewIdResourceName();
            String className = node.getClassName() == null ? "" : node.getClassName().toString();

            if (id != null && INPUT_IDS.contains(id)) return node;
            if (fallback == null
                    && className.contains("EditText")
                    && node.isEnabled()
                    && node.isVisibleToUser()) {
                fallback = node;
            }

            for (int i = 0; i < node.getChildCount(); i++) {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child != null) queue.add(child);
            }
        }
        return fallback;
    }

    private boolean fillInput(AccessibilityNodeInfo input, String text) {
        Bundle arguments = new Bundle();
        arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text);
        input.performAction(AccessibilityNodeInfo.ACTION_FOCUS);
        if (input.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)) return true;

        // Percobaan kedua setelah fokus benar-benar pindah.
        input.performAction(AccessibilityNodeInfo.ACTION_CLEAR_FOCUS);
        input.performAction(AccessibilityNodeInfo.ACTION_FOCUS);
        return input.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments);
    }

    private AccessibilityNodeInfo findSendButton(AccessibilityNodeInfo input) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) root = input;

        AccessibilityNodeInfo byLabel = null;
        AccessibilityNodeInfo nearInput = null;
        Deque<AccessibilityNodeInfo> queue = new ArrayDeque<>();
        queue.add(root);

        while (!queue.isEmpty()) {
            AccessibilityNodeInfo node = queue.poll();
            if (node == null) continue;

            String id = node.getViewIdResourceName();
            if (id != null && SEND_IDS.contains(id) && node.isClickable()) return node;

            String description = node.getContentDescription() == null
                    ? ""
                    : node.getContentDescription().toString().toLowerCase(Locale.ROOT);
            if (byLabel == null && node.isClickable() && matchesSendLabel(description)) byLabel = node;

            if (nearInput == null
                    && node.isClickable()
                    && isSiblingOfInput(node, input)
                    && !node.equals(input)) {
                nearInput = node;
            }

            for (int i = 0; i < node.getChildCount(); i++) {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child != null) queue.add(child);
            }
        }

        if (byLabel != null) return byLabel;
        return nearInput;
    }

    private static boolean matchesSendLabel(String description) {
        for (String label : SEND_LABELS) {
            if (description.equals(label)) return true;
        }
        return false;
    }

    private static boolean isSiblingOfInput(AccessibilityNodeInfo node, AccessibilityNodeInfo input) {
        AccessibilityNodeInfo nodeParent = node.getParent();
        AccessibilityNodeInfo inputParent = input.getParent();
        if (nodeParent == null || inputParent == null) return false;
        if (!nodeParent.equals(inputParent)) return false;

        String className = node.getClassName() == null ? "" : node.getClassName().toString();
        return className.contains("ImageView")
                || className.contains("ImageButton")
                || className.contains("Button");
    }

    private void log(String kind, String message, String detail) {
        AutoReplyStore.pushEvent(this, kind, message, detail);
    }
}
