export interface AutoRule {
  id: string;
  keyword: string;
  matchType: "exact" | "contains" | "regex";
  replyText: string;
  isActive: boolean;
  delayMs: number;
  interactive?: {
    type: "menu" | "buttons";
    options: string[];
  } | null;
}

export interface ContactsConfig {
  selectedOption: "Everyone" | "Only Whitelist" | "Exclude Blacklist" | "My Contacts Only";
  whitelist: Array<{ id: string; name: string; phone: string; label: string }>;
  blacklist: Array<{ id: string; name: string; phone: string; reason: string }>;
  groups: Array<{ id: string; name: string; isMuted: boolean }>;
}

export interface SpreadsheetRow {
  row: number;
  keyword: string;
  reply: string;
  status: string;
}

export interface GeminiProfile {
  ownerName: string;
  businessNiche: string;
  obstacleStatus: string;
  speakingStyle: string;
  promoInfo: string;
  marketingGoal: string;
}

export interface WhatsAutoSettings {
  isAutoReplyActive: boolean;
  apps: Record<string, boolean>;
  defaultReply: string;
  welcomeMessage: string;
  cooldownMinutes: number;
  replyDelayMs: number;
  activeHours: {
    type: "Always" | "Custom";
    start?: string;
    end?: string;
  };
  isGeminiActive: boolean;
  geminiMode: "always" | "fallback";
  geminiRecipientOption: "Everyone" | "Only Whitelist" | "Exclude Blacklist";
  geminiProfile: GeminiProfile;
}

export interface EngineResult {
  shouldReply: boolean;
  replyText: string;
  matchedSource: "Rule" | "Spreadsheet" | "WelcomeMessage" | "DefaultReply" | "Ignored" | "Gemini AI";
  ruleId?: string;
  interactive?: any;
}

/**
 * Replace placeholders like {sender}, {time}, {received_msg}
 */
export function replaceVariables(
  text: string,
  sender: string,
  receivedMsg: string,
  platform: string
): string {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString();

  return text
    .replace(/{sender}/g, sender)
    .replace(/{received_msg}/g, receivedMsg)
    .replace(/{time}/g, timeStr)
    .replace(/{date}/g, dateStr)
    .replace(/{platform}/g, platform);
}

/**
 * Primary auto-reply selection logic
 */
export function processIncomingMessage(params: {
  sender: string;
  phone: string;
  text: string;
  platform: string;
  isFirstMessage: boolean;
  rules: AutoRule[];
  contacts: ContactsConfig;
  spreadsheets: SpreadsheetRow[];
  settings: WhatsAutoSettings;
}): EngineResult {
  const { sender, phone, text, platform, isFirstMessage, rules, contacts, spreadsheets, settings } = params;

  // 1. Is Auto Reply globally switched on?
  if (!settings.isAutoReplyActive) {
    return { shouldReply: false, replyText: "", matchedSource: "Ignored" };
  }

  // 2. Is this specific app enabled?
  if (settings.apps && settings.apps[platform] === false) {
    return { shouldReply: false, replyText: "", matchedSource: "Ignored" };
  }

  // 3. Contact Permission filters
  const isBlacklisted = contacts.blacklist.some(
    (b) => b.phone.trim() === phone.trim() || b.name.toLowerCase() === sender.toLowerCase()
  );
  if (isBlacklisted) {
    return {
      shouldReply: true,
      replyText: "[IGNORED: Sender is blacklisted from receiving auto-replies]",
      matchedSource: "Ignored"
    };
  }

  const isWhitelisted = contacts.whitelist.some(
    (w) => w.phone.trim() === phone.trim() || w.name.toLowerCase() === sender.toLowerCase()
  );

  if (contacts.selectedOption === "Only Whitelist" && !isWhitelisted) {
    return {
      shouldReply: false,
      replyText: "[IGNORED: Sender not in Whitelist options]",
      matchedSource: "Ignored"
    };
  }

  // 4. Welcome message for first timers
  if (isFirstMessage && settings.welcomeMessage) {
    return {
      shouldReply: true,
      replyText: replaceVariables(settings.welcomeMessage, sender, text, platform),
      matchedSource: "WelcomeMessage"
    };
  }

  // 5. Try to find a custom reply rule
  const cleanInput = text.trim().toLowerCase();
  
  for (const rule of rules) {
    if (!rule.isActive) continue;

    let isMatch = false;
    const cleanKeyword = rule.keyword.trim().toLowerCase();

    if (rule.matchType === "exact") {
      isMatch = cleanInput === cleanKeyword;
    } else if (rule.matchType === "contains") {
      isMatch = cleanInput.includes(cleanKeyword);
    } else if (rule.matchType === "regex") {
      try {
        const regex = new RegExp(rule.keyword, "i");
        isMatch = regex.test(text);
      } catch (err) {
        isMatch = false;
      }
    }

    if (isMatch) {
      return {
        shouldReply: true,
        replyText: replaceVariables(rule.replyText, sender, text, platform),
        matchedSource: "Rule",
        ruleId: rule.id,
        interactive: rule.interactive
      };
    }
  }

  // 6. Try to look up in CSV/Spreadsheet sheet sync database
  for (const sheet of spreadsheets) {
    if (cleanInput.includes(sheet.keyword.trim().toLowerCase())) {
      return {
        shouldReply: true,
        replyText: replaceVariables(sheet.reply, sender, text, platform),
        matchedSource: "Spreadsheet"
      };
    }
  }

  // 7. Fallback to default response message
  if (settings.defaultReply) {
    return {
      shouldReply: true,
      replyText: replaceVariables(settings.defaultReply, sender, text, platform),
      matchedSource: "DefaultReply"
    };
  }

  return { shouldReply: false, replyText: "", matchedSource: "Ignored" };
}
