import { useState, useEffect, useMemo, useRef } from "react";
import { 
  Smartphone, 
  Send, 
  Settings, 
  Database, 
  Users, 
  BarChart3, 
  ToggleLeft, 
  ToggleRight, 
  Plus, 
  Trash2, 
  Eye, 
  Wifi, 
  MessageSquare, 
  ShieldAlert, 
  RefreshCw, 
  Clock, 
  Check, 
  HelpCircle, 
  CheckCircle, 
  FileSpreadsheet, 
  SmartphoneNfc,
  Hash, 
  VolumeX, 
  AlertCircle,
  QrCode,
  Share2,
  Lock,
  Menu,
  X,
  Sparkles,
  Info,
  Bot,
  Cpu,
  ShieldCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  AutoRule, 
  ContactsConfig, 
  SpreadsheetRow, 
  WhatsAutoSettings, 
  processIncomingMessage 
} from "./lib/whatsauto-engine";

export default function App() {
  // Application Data States
  const [rules, setRules] = useState<AutoRule[]>([]);
  const [contacts, setContacts] = useState<ContactsConfig>({
    selectedOption: "Everyone",
    whitelist: [],
    blacklist: [],
    groups: []
  });
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetRow[]>([]);
  const [settings, setSettings] = useState<WhatsAutoSettings>({
    isAutoReplyActive: true,
    apps: { whatsapp: true, telegram: true, instagram: false },
    defaultReply: "Maaf, pesan Anda tidak dikenali.",
    welcomeMessage: "Halo! Terima kasih telah menghubungi kami.",
    cooldownMinutes: 2,
    replyDelayMs: 300,
    activeHours: { type: "Always", start: "08:00", end: "18:00" },
    isGeminiActive: true,
    geminiMode: "fallback",
    geminiRecipientOption: "Everyone",
    geminiProfile: {
      ownerName: "Rian Kusuma",
      businessNiche: "Kuliner Martabak Manis Nusantara (Coklat Premium, Keju Lumer, Ketan Kelapa)",
      obstacleStatus: "Sedang melayani pembuat adonan di kitchen cabang utama",
      speakingStyle: "Sangat ramah, memakai sebutan 'Kakak', santai gaul kekinian khas anak muda Indonesia",
      promoInfo: "Beli martabak manis varian premium malam ini gratis minuman segar es teh sereh!",
      marketingGoal: "Ajak pesan instan via link WA/Gofood atau minta kesediaan menunggu maksimal 5 menit"
    }
  });
  const [history, setHistory] = useState<any[]>([]);
  
  // Loop prevention last reply times reference map
  const lastReplyTimes = useRef<Record<string, number>>({});
  
  // UI & Loading States
  const [activeTab, setActiveTab] = useState<"simulator" | "rules" | "contacts" | "spreadsheets" | "channels" | "analytics" | "gemini">("simulator");
  const [loading, setLoading] = useState(true);
  const [processingReply, setProcessingReply] = useState(false);
  const [showNotification, setShowNotification] = useState<string | null>(null);
  
  // Rule Editor Forms
  const [newRuleKeyword, setNewRuleKeyword] = useState("");
  const [newRuleReply, setNewRuleReply] = useState("");
  const [newRuleMatchType, setNewRuleMatchType] = useState<"exact" | "contains" | "regex">("exact");
  const [newRuleDelay, setNewRuleDelay] = useState(0);
  const [newRuleInteractiveType, setNewRuleInteractiveType] = useState<"none" | "menu" | "buttons">("none");
  const [newRuleOptions, setNewRuleOptions] = useState<string>("");
  
  // Offline database logs search & filter
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [logFilterStatus, setLogFilterStatus] = useState("ALL");

  // Contact whitelist/blacklist addition states
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactExtra, setNewContactExtra] = useState(""); // Label for whitelist, Reason for blacklist
  const [contactMode, setContactMode] = useState<"whitelist" | "blacklist">("whitelist");

  // Spreadsheet Row edit form
  const [newSheetKeyword, setNewSheetKeyword] = useState("");
  const [newSheetReply, setNewSheetReply] = useState("");

  // Live Simulator States
  const [selectedSimPlatform, setSelectedSimPlatform] = useState<string>("whatsapp");
  const [selectedSimSender, setSelectedSimSender] = useState<string>("Rian Kusuma");
  const [selectedSimPhone, setSelectedSimPhone] = useState<string>("+628129998811");
  const [simIsFirstMsg, setSimIsFirstMsg] = useState<boolean>(true);
  const [simTextInput, setSimTextInput] = useState("");
  const [simChatMessages, setSimChatMessages] = useState<Array<{ id: string; sender: string; text: string; time: string; isBot: boolean }>>([
    { id: "1", sender: "System", text: "Phone simulation is ready. Type below to test your rules!", time: "09:00", isBot: true }
  ]);
  const [debugLogs, setDebugLogs] = useState<Array<{ text: string; type: "info" | "success" | "warning" | "error" }>>([
    { text: "WhatsAuto Engine initialized.", type: "info" }
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Trigger brief alert notify
  const triggerAlert = (msg: string) => {
    setShowNotification(msg);
    setTimeout(() => {
      setShowNotification(null);
    }, 3000);
  };

  // Fetch all databases from server
  const loadDatabase = async () => {
    try {
      const res = await fetch("/api/whatsauto/data");
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
        setContacts(data.contacts || { selectedOption: "Everyone", whitelist: [], blacklist: [], groups: [] });
        setSpreadsheets(data.spreadsheets || []);
        const loadedSettings = data.settings || {};
        setSettings({
          isAutoReplyActive: true,
          apps: { whatsapp: true, telegram: true, instagram: false },
          defaultReply: "",
          welcomeMessage: "",
          cooldownMinutes: 2,
          replyDelayMs: 300,
          activeHours: { type: "Always" },
          isGeminiActive: true,
          geminiMode: "fallback",
          geminiRecipientOption: "Everyone",
          geminiProfile: {
            ownerName: "Rian Kusuma",
            businessNiche: "Kuliner Martabak Manis Nusantara (Coklat Premium, Keju Lumer, Ketan Kelapa)",
            obstacleStatus: "Sedang melayani pembuat adonan di kitchen cabang utama",
            speakingStyle: "Sangat ramah, memakai sebutan 'Kakak', santai gaul kekinian khas anak muda Indonesia",
            promoInfo: "Beli martabak manis varian premium malam ini gratis minuman segar es teh sereh!",
            marketingGoal: "Ajak pesan instan via link WA/Gofood atau minta kesediaan menunggu maksimal 5 menit"
          },
          ...loadedSettings
        });
        setHistory(data.history || []);
      }
    } catch (e) {
      console.error("Failed to load WhatsAuto Database:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatabase();
  }, []);

  // Sync scroll on chat client
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [simChatMessages]);

  const addDebugLog = (text: string, type: "info" | "success" | "warning" | "error" = "info") => {
    setDebugLogs(prev => [...prev.slice(-30), { text, type }]);
  };

  // Save changes to Server helper
  const saveStateToServer = async (target: "rules" | "contacts" | "spreadsheets" | "settings", updatedData: any) => {
    try {
      const res = await fetch(`/api/whatsauto/${target}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [target]: updatedData })
      });
      if (res.ok) {
        addDebugLog(`Saved ${target} update to disk successfully.`, "success");
      } else {
        addDebugLog(`Failed to save ${target} change to backend.`, "error");
      }
    } catch (error) {
      addDebugLog(`Network error while saving ${target}`, "error");
    }
  };

  // Handle auto-reply toggling
  const toggleGlobalAutoReply = async () => {
    const updated = { ...settings, isAutoReplyActive: !settings.isAutoReplyActive };
    setSettings(updated);
    await saveStateToServer("settings", updated);
    addDebugLog(`Global Auto Reply set to ${updated.isAutoReplyActive ? "ACTIVE" : "INACTIVE"}.`, "warning");
    triggerAlert(`Auto Reply ${updated.isAutoReplyActive ? "Enabled" : "Disabled"}`);
  };

  // Save Settings
  const saveAllSettings = async (updatedSettings: WhatsAutoSettings) => {
    setSettings(updatedSettings);
    await saveStateToServer("settings", updatedSettings);
    triggerAlert("Settings saved!");
  };

  // CRUD for Rules
  const handleAddRule = async () => {
    if (!newRuleKeyword || !newRuleReply) {
      triggerAlert("Please enter both dynamic keyword and replied text!");
      return;
    }
    
    // Parse options if interactive
    let interactiveObj = null;
    if (newRuleInteractiveType !== "none" && newRuleOptions) {
      interactiveObj = {
        type: newRuleInteractiveType as "menu" | "buttons",
        options: newRuleOptions.split(",").map(o => o.trim()).filter(Boolean)
      };
    }

    const newRule: AutoRule = {
      id: `rule_${Date.now()}`,
      keyword: newRuleKeyword,
      matchType: newRuleMatchType,
      replyText: newRuleReply,
      isActive: true,
      delayMs: newRuleDelay,
      interactive: interactiveObj
    };

    const updatedRules = [...rules, newRule];
    setRules(updatedRules);
    await saveStateToServer("rules", updatedRules);

    // Reset Form
    setNewRuleKeyword("");
    setNewRuleReply("");
    setNewRuleMatchType("exact");
    setNewRuleDelay(0);
    setNewRuleInteractiveType("none");
    setNewRuleOptions("");
    triggerAlert("Rule added successfully!");
    addDebugLog(`Added new auto reply rule for keyword [${newRule.keyword}]`, "success");
  };

  const handleToggleRule = async (id: string) => {
    const updatedRules = rules.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r);
    setRules(updatedRules);
    await saveStateToServer("rules", updatedRules);
    addDebugLog(`Toggled status of rule ${id}`, "info");
  };

  const handleDeleteRule = async (id: string) => {
    const updatedRules = rules.filter(r => r.id !== id);
    setRules(updatedRules);
    await saveStateToServer("rules", updatedRules);
    triggerAlert("Rule deleted");
    addDebugLog(`Deleted rule ${id}`, "warning");
  };

  // CRUD Whitelist/Blacklist
  const handleAddContact = async () => {
    if (!newContactName || !newContactPhone) {
      triggerAlert("Complete name and phone columns first!");
      return;
    }

    const updatedContacts = { ...contacts };
    const entry = {
      id: `c_${Date.now()}`,
      name: newContactName,
      phone: newContactPhone,
    };

    if (contactMode === "whitelist") {
      updatedContacts.whitelist.push({ ...entry, label: newContactExtra || "Client" });
      addDebugLog(`Whitelisted user [${newContactName}]`, "info");
    } else {
      updatedContacts.blacklist.push({ ...entry, reason: newContactExtra || "Blocked spammer" });
      addDebugLog(`Blacklisted user [${newContactName}]`, "warning");
    }

    setContacts(updatedContacts);
    await saveStateToServer("contacts", updatedContacts);

    setNewContactName("");
    setNewContactPhone("");
    setNewContactExtra("");
    triggerAlert("Contact record added");
  };

  const handleDeleteContact = async (id: string, listType: "whitelist" | "blacklist") => {
    const updatedContacts = { ...contacts };
    if (listType === "whitelist") {
      updatedContacts.whitelist = updatedContacts.whitelist.filter(w => w.id !== id);
    } else {
      updatedContacts.blacklist = updatedContacts.blacklist.filter(b => b.id !== id);
    }
    setContacts(updatedContacts);
    await saveStateToServer("contacts", updatedContacts);
    triggerAlert("Contact record deleted");
  };

  const handleContactsOptionChange = async (option: "Everyone" | "Only Whitelist" | "Exclude Blacklist" | "My Contacts Only") => {
    const updatedContacts = { ...contacts, selectedOption: option };
    setContacts(updatedContacts);
    await saveStateToServer("contacts", updatedContacts);
    addDebugLog(`Auto Reply Contact restriction set to: ${option}`, "warning");
  };

  // CRUD Spreadsheet Row Linkage
  const handleAddSpreadsheetRow = async () => {
    if (!newSheetKeyword || !newSheetReply) {
      triggerAlert("Provide matched search key and value text!");
      return;
    }

    const newRow: SpreadsheetRow = {
      row: spreadsheets.length + 1,
      keyword: newSheetKeyword,
      reply: newSheetReply,
      status: "Synced"
    };

    const updated = [...spreadsheets, newRow];
    setSpreadsheets(updated);
    await saveStateToServer("spreadsheets", updated);

    setNewSheetKeyword("");
    setNewSheetReply("");
    triggerAlert("Linked spreadsheet row added!");
    addDebugLog(`Synced spreadsheet keyword row [${newRow.keyword}]`, "success");
  };

  const handleDeleteSpreadsheetRow = async (rowNum: number) => {
    const updated = spreadsheets.filter(s => s.row !== rowNum).map((s, idx) => ({ ...s, row: idx + 1 }));
    setSpreadsheets(updated);
    await saveStateToServer("spreadsheets", updated);
    triggerAlert("Spreadsheet row deleted");
  };

  const handleClearHistory = async () => {
    try {
      const res = await fetch("/api/whatsauto/clear-logs", { method: "POST" });
      if (res.ok) {
        setHistory([]);
        addDebugLog("Transaction history cleared.", "warning");
        triggerAlert("Historical logs reset complete.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Mobile Messenger Send Button Logic
  const handleSimSend = async () => {
    if (!simTextInput.trim()) return;

    const userMsgText = simTextInput;
    const userSender = selectedSimSender;
    const userPhone = selectedSimPhone;
    const userPlatform = selectedSimPlatform;
    const currentTimeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Append Customer message
    const userMsgObj = {
      id: `sim_${Date.now()}`,
      sender: userSender,
      text: userMsgText,
      time: currentTimeString,
      isBot: false
    };

    setSimChatMessages(prev => [...prev, userMsgObj]);
    setSimTextInput("");
    setProcessingReply(true);
    addDebugLog(`Incoming chat from ${userSender}: "${userMsgText}" on channel [${userPlatform}]`, "info");

    const startTime = performance.now();
    const lockKey = `${userPlatform}_${userPhone}`;
    const lastTime = lastReplyTimes.current[lockKey] || 0;
    const nowTime = Date.now();

    // Loop Prevention & Cache Throttling Check (20 seconds cooldown)
    if (nowTime - lastTime < 20000) {
      setTimeout(async () => {
        setProcessingReply(false);
        addDebugLog(`Throttling triggered! ${userSender} messages cooldowned (less than 20s difference). Skipping auto-reply to prevent duplicate loops.`, "warning");
        triggerAlert("Loops prevention active!");

        // Save trace in database logs as skipped loop
        try {
          const logRes = await fetch("/api/whatsauto/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              logEntry: {
                sender: userSender,
                platform: userPlatform,
                incomingText: userMsgText,
                replyText: "",
                matchType: "Ignored",
                status: "SKIPPED",
                responseTimeMs: Math.round(performance.now() - startTime),
                errorMessage: "Loop Prevention Cache Throttling: 20 seconds restriction"
              }
            })
          });
          if (logRes.ok) {
            const savedLog = await logRes.json();
            setHistory(prev => [...prev, savedLog.entry]);
          }
        } catch (e) {
          console.error("Failed to save throttled log", e);
        }
      }, 500);
      return;
    }

    // Set last reply timestamp
    lastReplyTimes.current[lockKey] = nowTime;

    // Contact filter check (global blacklisted list)
    const isBlacklisted = contacts.blacklist.some(
      (b) => b.phone.trim() === userPhone.trim() || b.name.toLowerCase() === userSender.toLowerCase()
    );
    if (isBlacklisted) {
      setTimeout(async () => {
        setProcessingReply(false);
        addDebugLog(`Message ignored: ${userSender} is in your auto-reply Blacklist database.`, "warning");
        try {
          const logRes = await fetch("/api/whatsauto/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              logEntry: {
                sender: userSender,
                platform: userPlatform,
                incomingText: userMsgText,
                replyText: "[IGNORED: Sender blacklisted]",
                matchType: "Ignored",
                status: "SKIPPED",
                responseTimeMs: Math.round(performance.now() - startTime),
                errorMessage: "Sender is blacklisted in contacts rules"
              }
            })
          });
          if (logRes.ok) {
            const savedLog = await logRes.json();
            setHistory(prev => [...prev, savedLog.entry]);
          }
        } catch (e0) {
          console.error(e0);
        }
      }, 500);
      return;
    }

    // Contact filter check (global whitelist only restriction)
    const isWhitelisted = contacts.whitelist.some(
      (w) => w.phone.trim() === userPhone.trim() || w.name.toLowerCase() === userSender.toLowerCase()
    );
    if (contacts.selectedOption === "Only Whitelist" && !isWhitelisted) {
      setTimeout(async () => {
        setProcessingReply(false);
        addDebugLog(`Message ignored: ${userSender} is not in Whitelist and 'Only Whitelist' filter is active.`, "warning");
        try {
          const logRes = await fetch("/api/whatsauto/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              logEntry: {
                sender: userSender,
                platform: userPlatform,
                incomingText: userMsgText,
                replyText: "[IGNORED: Only Whitelist enabled]",
                matchType: "Ignored",
                status: "SKIPPED",
                responseTimeMs: Math.round(performance.now() - startTime),
                errorMessage: "Whitelist constraint failed"
              }
            })
          });
          if (logRes.ok) {
            const savedLog = await logRes.json();
            setHistory(prev => [...prev, savedLog.entry]);
          }
        } catch (e0) {
          console.error(e0);
        }
      }, 500);
      return;
    }

    // Evaluate standard matching engine response
    const result = processIncomingMessage({
      sender: userSender,
      phone: userPhone,
      text: userMsgText,
      platform: userPlatform,
      isFirstMessage: simIsFirstMsg,
      rules,
      contacts,
      spreadsheets,
      settings
    });

    if (simIsFirstMsg) {
      setSimIsFirstMsg(false);
    }

    // Determine if we should delegate to Gemini AI
    let useGemini = false;
    let geminiErrorMsg = "";

    if (settings.isGeminiActive) {
      // Recipient check for Gemini
      let geminiRecipientAllowed = true;
      if (settings.geminiRecipientOption === "Only Whitelist" && !isWhitelisted) {
        geminiRecipientAllowed = false;
        geminiErrorMsg = "Gemini recipient is Whitelist Only but sender is regular";
      }

      if (geminiRecipientAllowed) {
        if (settings.geminiMode === "always") {
          useGemini = true;
        } else if (settings.geminiMode === "fallback") {
          // Fallback only if no rules match or match is fallback default
          if (!result.shouldReply || result.matchedSource === "DefaultReply") {
            useGemini = true;
          }
        }
      } else {
        addDebugLog(`Gemini Filter bypassed: ${geminiErrorMsg}. Standard rules engine fallback active.`, "warning");
      }
    }

    const delayTime = result.ruleId ? (rules.find((r) => r.id === result.ruleId)?.delayMs || settings.replyDelayMs) : settings.replyDelayMs;

    // Proceed to reply dispatch
    setTimeout(async () => {
      let botReplyText = "";
      let finalMatchType = result.matchedSource;
      let replyStatus: "SUCCESS" | "FAILED" | "SKIPPED" = "SUCCESS";
      let errorLogged = "";

      if (useGemini) {
        addDebugLog(`Querying Gemini AI on-server pipeline... (${settings.geminiProfile.ownerName} context / speaking style: ${settings.geminiProfile.speakingStyle})`, "info");
        try {
          const response = await fetch("/api/whatsauto/gemini", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: userMsgText,
              sender: userSender,
              profile: settings.geminiProfile
            })
          });

          if (!response.ok) {
            const errorObj = await response.json();
            throw new Error(errorObj.error || "Server responded with an error");
          }

          const responseData = await response.json();
          botReplyText = responseData.replyText;
          finalMatchType = "Gemini AI";
          addDebugLog("Gemini AI replied naturally (Anti-AI Slop active)!", "success");
        } catch (geminiError: any) {
          replyStatus = "FAILED";
          errorLogged = geminiError.message || "Failed to make Gemini API call.";
          addDebugLog(`Gemini AI Error: ${errorLogged}. Falling back to default reply.`, "error");
          // Fallback message
          botReplyText = result.shouldReply ? result.replyText : settings.defaultReply;
          finalMatchType = result.shouldReply ? result.matchedSource : "DefaultReply";
        }
      } else {
        // Use regular rule matching result
        if (result.shouldReply) {
          botReplyText = result.replyText;
        } else {
          // Bypassed or Ignored
          setProcessingReply(false);
          addDebugLog("Standard rules engine decided not to reply.", "warning");
          return;
        }
      }

      setProcessingReply(false);

      // Append Bot Reply to Simulator Window
      setSimChatMessages(prev => [...prev, {
        id: `bot_${Date.now()}`,
        sender: useGemini && replyStatus === "SUCCESS" ? `${settings.geminiProfile.ownerName} via Gemini AI` : "WhatsAuto Assistant",
        text: botReplyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isBot: true
      }]);

      addDebugLog(`Engine Reply (${finalMatchType}): "${botReplyText.slice(0, 60)}${botReplyText.length > 60 ? "..." : ""}"`, "success");

      // Save complete log statistics to History DB sync
      const responseTimeMs = Math.round(performance.now() - startTime);
      try {
        const logRes = await fetch("/api/whatsauto/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            logEntry: {
              sender: userSender,
              platform: userPlatform,
              incomingText: userMsgText,
              replyText: botReplyText,
              matchType: finalMatchType,
              status: replyStatus,
              responseTimeMs,
              errorMessage: errorLogged || null
            }
          })
        });
        if (logRes.ok) {
          const savedLog = await logRes.json();
          setHistory(prev => [...prev, savedLog.entry]);
        }
      } catch (err) {
        console.error("Failed to append transaction log:", err);
      }
    }, useGemini ? Math.max(delayTime, 400) : delayTime); // Make sure Gemini has at least a short natural reading delay
  };

  // Filtered Offline Logs Database representation
  const filteredHistory = useMemo(() => {
    return [...history].reverse().filter((entry) => {
      const query = logSearchQuery.trim().toLowerCase();
      const keywordMatch =
        !query ||
        (entry.sender && entry.sender.toLowerCase().includes(query)) ||
        (entry.incomingText && entry.incomingText.toLowerCase().includes(query)) ||
        (entry.replyText && entry.replyText.toLowerCase().includes(query)) ||
        (entry.errorMessage && entry.errorMessage.toLowerCase().includes(query));

      const statusSelection = entry.status || "SUCCESS";
      const statusMatch =
        logFilterStatus === "ALL" || statusSelection.toUpperCase() === logFilterStatus.toUpperCase();

      return keywordMatch && statusMatch;
    });
  }, [history, logSearchQuery, logFilterStatus]);

  // Chart computations (SVG)
  const analyticsData = useMemo(() => {
    // Total messages
    const total = history.length;
    
    // Count platform stats
    const platforms: Record<string, number> = { whatsapp: 0, telegram: 0, instagram: 0, messenger: 0 };
    const matchTypes: Record<string, number> = { Rule: 0, Spreadsheet: 0, WelcomeMessage: 0, DefaultReply: 0, Ignored: 0 };

    history.forEach((h) => {
      const plat = h.platform?.toLowerCase() || "whatsapp";
      platforms[plat] = (platforms[plat] || 0) + 1;
      
      const source = h.matchType || "Rule";
      matchTypes[source] = (matchTypes[source] || 0) + 1;
    });

    return { total, platforms, matchTypes };
  }, [history]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="animate-spin text-teal-600" size={40} />
          <p className="text-sm font-bold uppercase tracking-widest text-gray-500">Retrieving WhatsAuto Engine Status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-teal-500 selection:text-white">
      {/* Visual Toast Notification Notification */}
      <AnimatePresence>
        {showNotification && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 16, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 border border-teal-400/30 text-xs tracking-widest uppercase font-mono"
          >
            <CheckCircle size={16} />
            {showNotification}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-h-screen flex-col lg:flex-row">
        
        {/* Left Sidebar Navigation */}
        <aside className="w-full lg:w-72 bg-slate-950 border-r border-slate-800 p-6 flex flex-col justify-between shrink-0">
          <div>
            {/* Brand Logo & Switcher */}
            <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-6">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-tr from-teal-500 to-emerald-400 p-2.5 rounded-xl text-slate-950 shadow-lg shadow-teal-500/10">
                  <SmartphoneNfc size={22} className="stroke-[2.5]" />
                </div>
                <div>
                  <h1 className="text-lg font-black tracking-tight flex items-center gap-1.5 font-mono text-white">
                    WHATSAUTO <span className="bg-teal-400 text-teal-950 text-[9px] font-mono px-1 py-0.5 rounded font-black">DUPLICATE</span>
                  </h1>
                  <span className="text-[10px] font-mono text-slate-400 block tracking-wide">Enterprise Suite v4.52</span>
                </div>
              </div>
            </div>

            {/* Global Auto Reply Toggle Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 transition-all hover:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Auto Reply Status</span>
                <span className={`w-2 h-2 rounded-full ${settings.isAutoReplyActive ? 'bg-teal-400 animate-pulse' : 'bg-slate-600'}`} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">{settings.isAutoReplyActive ? "SYSTEM ACTIVE" : "STOPPED / MANUAL"}</span>
                <button 
                  onClick={toggleGlobalAutoReply}
                  className="cursor-pointer focus:outline-none transition-transform active:scale-95"
                >
                  {settings.isAutoReplyActive ? (
                    <ToggleRight className="text-teal-400 w-11 h-11 transition-all" />
                  ) : (
                    <ToggleLeft className="text-slate-600 w-11 h-11 transition-all" />
                  )}
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="space-y-1.5">
              {[
                { id: "simulator", label: "Simulator & Live Console", icon: Smartphone },
                { id: "gemini", label: "Gemini Smart Auto-Reply", icon: Bot },
                { id: "rules", label: "Auto Reply Rules (Custom)", icon: MessageSquare },
                { id: "spreadsheets", label: "Spreadsheets Direct Sync", icon: FileSpreadsheet },
                { id: "contacts", label: "Contacts Sync & Blocklist", icon: Users },
                { id: "channels", label: "Channels Integration", icon: Settings },
                { id: "analytics", label: "Analytics & Reports", icon: BarChart3 }
              ].map((tab) => {
                const SelectedIcon = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full text-left py-3 px-4 rounded-xl flex items-center gap-3 font-mono text-xs transition-all tracking-wide border cursor-pointer ${
                      isSelected 
                        ? "bg-teal-500/10 text-teal-400 border-teal-500/20 font-bold" 
                        : "text-slate-400 border-transparent hover:bg-slate-900 hover:text-white"
                    }`}
                  >
                    <SelectedIcon size={16} className={isSelected ? "text-teal-400" : "text-slate-400"} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* User/Environment footer info */}
          <div className="mt-8 pt-6 border-t border-slate-800 space-y-3 font-mono text-[10px] text-slate-500">
            <div className="flex justify-between">
              <span>ACTIVE CHANNELS:</span>
              <span className="text-slate-300 font-bold">
                {Object.values(settings.apps).filter(Boolean).length} Active
              </span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>LOCAL TIME:</span>
              <span className="text-slate-300">2026-05-25</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>ADMIN:</span>
              <span className="text-slate-400 hover:text-white truncate max-w-[120px]">irvan.indralaksana</span>
            </div>
          </div>
        </aside>

        {/* Core Workspace Frame */}
        <main className="flex-1 bg-slate-900 flex flex-col min-h-0">
          
          {/* Header Dashboard Metrics */}
          <header className="bg-slate-950/60 backdrop-blur-md px-8 py-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">Interactive Cloud Workspace</span>
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight capitalize font-sans">
                {activeTab === "simulator" && "📱 Live Sandbox & Message Parser"}
                {activeTab === "rules" && "⚙️ Master Trigger Configurator"}
                {activeTab === "spreadsheets" && "📄 Direct Spreadsheet Auto Sync"}
                {activeTab === "contacts" && "👥 Whitelist & Blacklist Controls"}
                {activeTab === "channels" && "🛠️ Messenger Integration Setup"}
                {activeTab === "analytics" && "📊 Analytics & System Activity Records"}
              </h2>
            </div>
            
            {/* Quick action buttons */}
            <div className="flex items-center gap-3">
              <button 
                onClick={loadDatabase}
                className="bg-slate-905 border border-slate-800 text-slate-300 px-3.5 py-2 rounded-xl text-xs font-mono hover:bg-slate-800 hover:text-white transition-all flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw size={13} />
                Fetch Server DB
              </button>
            </div>
          </header>

          {/* Primary Contents Grid */}
          <div className="flex-1 p-8 overflow-y-auto">
            
            <AnimatePresence mode="wait">
              
              {/* TAB 1: SIMULATOR */}
              {activeTab === "simulator" && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 xl:grid-cols-12 gap-8"
                >
                  
                  {/* Selector rules & parameters for simulator */}
                  <div className="xl:col-span-7 space-y-6">
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                      <h3 className="text-sm font-bold text-white mb-4 border-b border-slate-800 pb-3 flex items-center gap-2 font-mono">
                        <Settings size={16} className="text-teal-400" />
                        1. SIMULATOR CONTEXT PARAMETERS
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                        <div>
                          <label className="text-slate-400 block mb-1.5 uppercase tracking-wider text-[10px]">Select Target Platform</label>
                          <select 
                            value={selectedSimPlatform}
                            onChange={(e) => setSelectedSimPlatform(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-100 uppercase"
                          >
                            <option value="whatsapp">WhatsApp Standard</option>
                            <option value="wabusiness">WhatsApp Business</option>
                            <option value="telegram">Telegram Messenger</option>
                            <option value="instagram">Instagram Direct Message</option>
                            <option value="messenger">Facebook Messenger</option>
                            <option value="signal">Signal Direct</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="text-slate-400 block mb-1.5 uppercase tracking-wider text-[10px]">Sender Name (Mock Contact)</label>
                          <select 
                            value={selectedSimSender}
                            onChange={(e) => {
                              setSelectedSimSender(e.target.value);
                              const phoneMap: Record<string, string> = {
                                "Rian Kusuma": "+628129998811",
                                "Budi Santoso (VIP)": "+628123456789",
                                "Spam Bot (Blocklist)": "+628111999222",
                                "Unknown Client": "+62815121319"
                              };
                              setSelectedSimPhone(phoneMap[e.target.value] || "+628224564881");
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-100"
                          >
                            <option value="Rian Kusuma">Rian Kusuma (Regular Client)</option>
                            <option value="Budi Santoso (VIP)">Budi Santoso (Whitelisted VIP)</option>
                            <option value="Spam Bot (Blocklist)">Spam Bot (Blacklisted Numbers)</option>
                            <option value="Unknown Client">Unknown Foreign Client</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-slate-400 block mb-1.5 uppercase tracking-wider text-[10px]">Virtual Phone Number</label>
                          <input 
                            type="text" 
                            value={selectedSimPhone} 
                            disabled
                            className="w-full bg-slate-950 border border-slate-800 text-slate-500 rounded-lg p-2.5"
                          />
                        </div>

                        <div>
                          <label className="text-slate-400 block mb-1.5 uppercase tracking-wider text-[10px]">Simulate First Conversation Message?</label>
                          <div className="flex gap-4 p-2.5">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input 
                                type="radio" 
                                checked={simIsFirstMsg} 
                                onChange={() => setSimIsFirstMsg(true)}
                                className="accent-teal-500"
                              />
                              Yes (Trigger Welcome text)
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input 
                                type="radio" 
                                checked={!simIsFirstMsg} 
                                onChange={() => setSimIsFirstMsg(false)}
                                className="accent-teal-500"
                              />
                              No (Skip Welcome test)
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Live Processing Action Debug Logs */}
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                      <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
                          <Database size={16} className="text-teal-400" />
                          2. SYSTEM ENGINE PARSING CONSOLE LOGS
                        </h3>
                        <button 
                          onClick={() => setDebugLogs([{ text: "Console trace logs reset.", type: "info" }])}
                          className="text-[10px] text-slate-400 hover:text-white uppercase font-mono bg-slate-900 border border-slate-850 px-2.5 py-1 rounded"
                        >
                          Clear
                        </button>
                      </div>

                      <div className="bg-slate-900 rounded-xl p-4 h-[240px] overflow-y-auto font-mono text-xs space-y-2 border border-slate-850 custom-scrollbar">
                        {debugLogs.map((log, i) => (
                          <div key={i} className="flex gap-2 leading-relaxed">
                            <span className="text-[10px] text-slate-500 select-none">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                            <span className={`
                              ${log.type === "success" ? "text-emerald-400 font-semibold" : ""}
                              ${log.type === "warning" ? "text-amber-400" : ""}
                              ${log.type === "error" ? "text-rose-400 font-black" : ""}
                              ${log.type === "info" ? "text-sky-300" : ""}
                            `}>
                              {log.type === "success" && "✔ "}
                              {log.type === "warning" && "⚠ "}
                              {log.type === "error" && "✖ "}
                              {log.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right hand Mock Smartphone Simulator */}
                  <div className="xl:col-span-5 flex justify-center">
                    <div className="w-full max-w-[360px] bg-slate-950 rounded-[40px] p-4 border-[6px] border-slate-850 shadow-2xl relative overflow-hidden flex flex-col h-[600px] border-b-[12px]">
                      
                      {/* Speaker & Sensor bar */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-950 rounded-b-2xl z-20 flex items-center justify-center">
                        <div className="w-12 h-1 bg-slate-800 rounded-full mb-1" />
                      </div>

                      {/* Phone Background Screen */}
                      <div className="flex-1 bg-slate-900 rounded-[28px] overflow-hidden flex flex-col relative pt-6 text-[11px]">
                        
                        {/* Mock App Header */}
                        <div className="bg-teal-700 p-3 flex items-center justify-between text-white relative shadow-md select-none shrink-0">
                          <div className="flex items-center gap-2 pl-2">
                            <div className="w-7 h-7 rounded-full bg-teal-500 flex items-center justify-center font-bold text-xs uppercase shadow">
                              {selectedSimSender[0]}
                            </div>
                            <div>
                              <div className="font-bold text-xs truncate max-w-[120px]">{selectedSimSender}</div>
                              <div className="text-[9px] text-teal-100 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block animate-pulse" />
                                Online on {selectedSimPlatform.toUpperCase()}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 pr-2 opacity-80">
                            <Wifi size={14} />
                            <span className="font-mono font-bold text-[10px]">100%</span>
                          </div>
                        </div>

                        {/* Chats Window */}
                        <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-slate-950/40 relative flex flex-col custom-scrollbar">
                          {simChatMessages.map((msg) => (
                            <div 
                              key={msg.id}
                              className={`flex flex-col max-w-[80%] ${msg.isBot ? "self-start items-start" : "self-end items-end"}`}
                            >
                              <div className={`p-2.5 rounded-2xl whitespace-pre-wrap ${
                                msg.isBot 
                                  ? "bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700" 
                                  : "bg-teal-600 text-white rounded-tr-none"
                              }`}>
                                {msg.text}
                              </div>
                              <span className="text-[9px] text-slate-500 mt-1 uppercase tracking-wide">
                                {msg.sender} • {msg.time}
                              </span>
                            </div>
                          ))}
                          
                          {processingReply && (
                            <div className="self-start flex items-center gap-2 bg-slate-800 border border-slate-700 p-2.5 rounded-2xl rounded-tl-none text-slate-300">
                              <RefreshCw size={11} className="animate-spin text-teal-400" />
                              <span>WhatsAuto replying...</span>
                            </div>
                          )}
                          <div ref={chatEndRef} />
                        </div>

                        {/* Quick Interactive Hints panel */}
                        <div className="bg-slate-950/80 p-2 border-t border-slate-850 flex gap-1.5 overflow-x-auto whitespace-nowrap shrink-0 max-w-full custom-scrollbar">
                          {["Halo", "1", "2", "3", "harga", "alamat", "promo-99"].map((preset, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSimTextInput(preset)}
                              className="bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-teal-500 px-2.5 py-1 rounded-full text-[9px] font-mono cursor-pointer"
                            >
                              {preset}
                            </button>
                          ))}
                        </div>

                        {/* Interactive message bar input */}
                        <div className="p-2 border-t border-slate-850 bg-slate-955 flex items-center gap-1.5 shrink-0">
                          <input 
                            type="text"
                            value={simTextInput}
                            onChange={(e) => setSimTextInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSimSend()}
                            placeholder="Type a message to test trigger..."
                            className="flex-1 bg-slate-900 text-slate-100 p-2.5 border border-slate-800 focus:outline-none focus:border-teal-500 rounded-full text-xs"
                          />
                          <button
                            onClick={handleSimSend}
                            className="bg-teal-600 hover:gradient-to-tr hover:bg-teal-500 cursor-pointer p-2.5 rounded-full text-white shadow active:scale-95 transition-all"
                          >
                            <Send size={14} className="stroke-[2.5]" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 2: AUTO REPLY RULES */}
              {activeTab === "rules" && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  
                  {/* Rule addition dialog */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2 font-mono">
                      <Plus size={16} className="text-teal-400" />
                      REGISTER A NEW AUTO REPLY TRIGGER
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                      {/* Keyword field */}
                      <div className="md:col-span-4 space-y-2">
                        <label className="text-xs font-mono text-slate-400 block uppercase tracking-wider">Incoming Keyword Pattern</label>
                        <input 
                          type="text"
                          value={newRuleKeyword}
                          onChange={(e) => setNewRuleKeyword(e.target.value)}
                          placeholder="e.g. Price, Halo, 1, ^order-[0-9]+"
                          className="w-full bg-slate-900 border border-slate-850 hover:border-slate-750 focus:border-teal-400 focus:outline-none rounded-xl p-3 text-sm text-slate-100 placeholder:opacity-40"
                        />
                      </div>

                      {/* Match type selection */}
                      <div className="md:col-span-4 space-y-2">
                        <label className="text-xs font-mono text-slate-400 block uppercase tracking-wider">Match Logic Strategy</label>
                        <select
                          value={newRuleMatchType}
                          onChange={(e) => setNewRuleMatchType(e.target.value as any)}
                          className="w-full bg-slate-900 border border-slate-850 focus:border-teal-400 focus:outline-none rounded-xl p-3 text-sm text-slate-100"
                        >
                          <option value="exact">Exact Match (Strict matching)</option>
                          <option value="contains">Contains Search String (Includes target)</option>
                          <option value="regex">Advanced RegEx (Regex patterns matching)</option>
                        </select>
                      </div>

                      {/* Cool delay logic */}
                      <div className="md:col-span-4 space-y-2">
                        <label className="text-xs font-mono text-slate-400 block uppercase tracking-wider">Simulated Delay Timing (ms)</label>
                        <input 
                          type="number"
                          step="100"
                          min="0"
                          value={newRuleDelay}
                          onChange={(e) => setNewRuleDelay(parseInt(e.target.value) || 0)}
                          placeholder="0 ms (Instant Reply)"
                          className="w-full bg-slate-900 border border-slate-850 focus:border-teal-400 focus:outline-none rounded-xl p-3 text-sm text-slate-100"
                        />
                      </div>

                      {/* Reply Text */}
                      <div className="md:col-span-12 space-y-2">
                        <div className="flex justify-between">
                          <label className="text-xs font-mono text-slate-400 block uppercase tracking-wider">Automated Reply Message Text</label>
                          <span className="text-[10px] text-teal-400 font-mono">Supports placeholders: &#123;sender&#125;, &#123;time&#125;, &#123;received_msg&#125;</span>
                        </div>
                        <textarea 
                          value={newRuleReply}
                          onChange={(e) => setNewRuleReply(e.target.value)}
                          rows={3}
                          placeholder="Welcome {sender}! Your incoming message was '{received_msg}' received at {time}."
                          className="w-full bg-slate-900 border border-slate-850 focus:border-teal-400 focus:outline-none rounded-xl p-3 text-sm text-slate-100 placeholder:opacity-40"
                        />
                      </div>

                      {/* Interactive templates menu */}
                      <div className="md:col-span-6 space-y-2">
                        <label className="text-xs font-mono text-slate-400 block uppercase tracking-wider">Append Interactive Object</label>
                        <select
                          value={newRuleInteractiveType}
                          onChange={(e) => setNewRuleInteractiveType(e.target.value as any)}
                          className="w-full bg-slate-900 border border-slate-850 focus:border-teal-400 focus:outline-none rounded-xl p-3 text-sm text-slate-100"
                        >
                          <option value="none">None (Plain Text reply)</option>
                          <option value="menu">Menu Suggestions list (User options list)</option>
                          <option value="buttons">Quick Reply Buttons (Simulate Quick Buttons)</option>
                        </select>
                      </div>

                      {/* Option choices */}
                      {newRuleInteractiveType !== "none" && (
                        <div className="md:col-span-6 space-y-2">
                          <label className="text-xs font-mono text-slate-400 block uppercase tracking-wider">Button Options (Comma Separated)</label>
                          <input 
                            type="text"
                            value={newRuleOptions}
                            onChange={(e) => setNewRuleOptions(e.target.value)}
                            placeholder="Option A, Option B, Talk to Executive"
                            className="w-full bg-slate-900 border border-slate-850 focus:border-teal-400 focus:outline-none rounded-xl p-3 text-sm text-slate-100"
                          />
                        </div>
                      )}

                      {/* Actions */}
                      <div className="md:col-span-12 flex justify-end">
                        <button
                          onClick={handleAddRule}
                          className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-6 py-3 rounded-xl text-xs font-mono tracking-wider uppercase shadow active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <Plus size={16} />
                          Inject Auto-Reply Rule
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Rules Lists display */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
                        <Eye size={16} className="text-teal-400" />
                        CURRENT ACTIVE AUTO-REPLY RULES ({rules.length})
                      </h3>
                      <p className="text-xs text-slate-400 font-mono italic">Engine evaluates rules sequentionally top-down</p>
                    </div>

                    <div className="space-y-4">
                      {rules.map((rule) => (
                        <div 
                          key={rule.id} 
                          className={`border rounded-xl p-5 transition-all bg-slate-900 ${
                            rule.isActive ? "border-slate-800" : "border-slate-850 opacity-50"
                          }`}
                        >
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-3 border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px] px-2 py-0.5 rounded font-black">
                                {rule.matchType.toUpperCase()}
                              </span>
                              <span className="text-sm font-extrabold text-teal-400 font-mono bg-teal-950/40 border border-teal-800/20 px-2.5 py-0.5 rounded">
                                Trigger: {rule.keyword}
                              </span>
                              {rule.delayMs > 0 && (
                                <span className="text-[10px] text-amber-400 font-mono bg-amber-950/20 px-2 py-0.5 rounded">
                                  ⌛ {rule.delayMs}ms Delay
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleToggleRule(rule.id)}
                                className={`text-[10px] font-mono px-3 py-1 rounded cursor-pointer uppercase ${
                                  rule.isActive 
                                    ? "bg-emerald-950/50 border border-emerald-800/40 text-emerald-400" 
                                    : "bg-slate-850 border border-slate-800 text-slate-500"
                                }`}
                              >
                                {rule.isActive ? "Active / Active" : "Paused / Off"}
                              </button>
                              
                              <button
                                onClick={() => handleDeleteRule(rule.id)}
                                className="text-slate-500 hover:text-rose-400 px-1 py-1 transition-colors cursor-pointer"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>

                          <p className="text-slate-200 text-xs font-mono leading-relaxed whitespace-pre-wrap mb-3 italic">
                            "{rule.replyText}"
                          </p>

                          {rule.interactive && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9px] font-mono text-slate-400 uppercase mr-1.5">{rule.interactive.type} response options:</span>
                              {rule.interactive.options.map((opt: string, k: number) => (
                                <span key={k} className="bg-slate-950 border border-slate-800 px-2 py-1 text-[9px] font-mono rounded text-slate-300">
                                  {opt}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 3: SPREADSHEETS */}
              {activeTab === "spreadsheets" && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  
                  {/* Informational intro card */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-5">
                    <div className="bg-teal-500/10 text-teal-400 p-4 rounded-full">
                      <FileSpreadsheet size={36} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white mb-1">Direct Google Sheets Synchronizer</h3>
                      <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                        Simulates WhatsAuto's highly acclaimed online sheet synchronization. The auto-responder will query this live matrix when no local rules match. Updates made on these rows act as a continuous REST database.
                      </p>
                    </div>
                  </div>

                  {/* Addition fields */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-white mb-4 border-b border-slate-800 pb-3 flex items-center gap-2 font-mono">
                      <Plus size={16} className="text-teal-400" />
                      ADD ROW SYNC NODE
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                      <div className="md:col-span-4 space-y-2">
                        <label className="text-xs font-mono text-slate-400 block uppercase tracking-wider">Search Keyword Word</label>
                        <input 
                          type="text"
                          value={newSheetKeyword}
                          onChange={(e) => setNewSheetKeyword(e.target.value)}
                          placeholder="e.g. alamat, promo, website"
                          className="w-full bg-slate-900 border border-slate-850 focus:border-teal-400 focus:outline-none rounded-xl p-3 text-sm text-slate-100"
                        />
                      </div>

                      <div className="md:col-span-8 space-y-2">
                        <label className="text-xs font-mono text-slate-400 block uppercase tracking-wider">Spreadsheet Response Cell Value</label>
                        <input 
                          type="text"
                          value={newSheetReply}
                          onChange={(e) => setNewSheetReply(e.target.value)}
                          placeholder="Our main landing page is https://whatsauto.ai with free documentation."
                          className="w-full bg-slate-900 border border-slate-850 focus:border-teal-400 focus:outline-none rounded-xl p-3 text-sm text-slate-100"
                        />
                      </div>

                      <div className="md:col-span-12 flex justify-end">
                        <button
                          onClick={handleAddSpreadsheetRow}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl text-xs font-mono tracking-wider uppercase shadow hover:shadow-indigo-500/15 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <Plus size={16} />
                          Write Row to Sheet
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Spreadsheet Grid Mockup */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 overflow-hidden">
                    <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2 font-mono">
                      <Database size={16} className="text-teal-400" />
                      LIVE MATRIX GRID - SPREADSHEET DATABASE
                    </h3>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider select-none bg-slate-900">
                            <th className="py-3 px-4 w-12 text-center select-none bg-slate-950">A</th>
                            <th className="py-3 px-4">B</th>
                            <th className="py-3 px-4 text-center">C</th>
                            <th className="py-3 px-4 text-center">D</th>
                          </tr>
                          <tr className="border-b border-slate-800 text-slate-400">
                            <th className="py-2.5 px-4 text-center border-r border-slate-850 bg-slate-900"># Row</th>
                            <th className="py-2.5 px-3 border-r border-slate-850 bg-slate-900">Cell: Keyword Match</th>
                            <th className="py-2.5 px-3 border-r border-slate-850 bg-slate-900">Cell: Mapped Outgoing Response Text</th>
                            <th className="py-2.5 px-3 bg-slate-900 text-center w-32">Operations</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {spreadsheets.map((sheet) => (
                            <tr key={sheet.row} className="hover:bg-slate-900/60 select-all transition-colors">
                              <td className="py-3.5 px-4 text-center bg-slate-900/30 font-bold text-slate-500 border-r border-slate-850">{sheet.row}</td>
                              <td className="py-3.5 px-3 text-emerald-400 font-bold border-r border-slate-850"> {sheet.keyword}</td>
                              <td className="py-3.5 px-3 text-slate-200 border-r border-slate-850 italic">"{sheet.reply}"</td>
                              <td className="py-3.5 px-3 text-center">
                                <button
                                  onClick={() => handleDeleteSpreadsheetRow(sheet.row)}
                                  className="text-slate-500 hover:text-rose-400 p-2 border border-transparent rounded transition-colors cursor-pointer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 4: CONTACTS AND GUARD */}
              {activeTab === "contacts" && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  
                  {/* Radio buttons contacts options */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-white mb-4 border-b border-slate-800 pb-3 flex items-center gap-2 font-mono">
                      <Users size={16} className="text-teal-400" />
                      WHO SHOULD SYSTEM AUTO-REPLY TO?
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {[
                        { id: "Everyone", label: "Everyone", desc: "Reply to all incoming numbers" },
                        { id: "Only Whitelist", label: "Only Whitelist", desc: "Allow whitelist numbers only" },
                        { id: "Exclude Blacklist", label: "Everyone Except Blocked", desc: "Allow all minus blacklist" },
                        { id: "My Contacts Only", label: "My Contacts", desc: "Contacts list integration" }
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleContactsOptionChange(item.id as any)}
                          className={`p-4 rounded-xl border text-left font-mono text-xs cursor-pointer transition-all ${
                            contacts.selectedOption === item.id
                              ? "bg-teal-500/10 border-teal-500/40 text-teal-400"
                              : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white"
                          }`}
                        >
                          <div className="font-bold flex items-center justify-between mb-1.5 uppercase">
                            {item.label}
                            {contacts.selectedOption === item.id && <span className="h-2 w-2 rounded-full bg-teal-400 shrink-0" />}
                          </div>
                          <span className="text-[10px] text-slate-500 lowercase first-letter:uppercase block leading-normal">{item.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Add record to Lists */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                    <div className="flex gap-4 border-b border-slate-800 pb-4 mb-4 select-none">
                      <button 
                        onClick={() => { setContactMode("whitelist"); setNewContactExtra(""); }}
                        className={`text-xs font-mono py-1 px-3 rounded uppercase cursor-pointer ${contactMode === "whitelist" ? "bg-teal-600 text-white font-bold" : "text-slate-400 hover:text-white"}`}
                      >
                        Add to Whitelist (Safe)
                      </button>
                      <button 
                        onClick={() => { setContactMode("blacklist"); setNewContactExtra(""); }}
                        className={`text-xs font-mono py-1 px-3 rounded uppercase cursor-pointer ${contactMode === "blacklist" ? "bg-rose-600 text-white font-bold" : "text-slate-400 hover:text-white"}`}
                      >
                        Add to Blacklist (Spammers)
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input 
                        type="text"
                        value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                        placeholder="Contact Name (e.g. John Doe)"
                        className="bg-slate-900 border border-slate-850 rounded-xl p-3 text-xs text-slate-100 placeholder:opacity-40"
                      />
                      <input 
                        type="text"
                        value={newContactPhone}
                        onChange={(e) => setNewContactPhone(e.target.value)}
                        placeholder="Phone Number (e.g. +6281234567)"
                        className="bg-slate-900 border border-slate-850 rounded-xl p-3 text-xs text-slate-100 placeholder:opacity-40"
                      />
                      <input 
                        type="text"
                        value={newContactExtra}
                        onChange={(e) => setNewContactExtra(e.target.value)}
                        placeholder={`${contactMode === "whitelist" ? "VIP Label tag" : "Reason why blocked"}`}
                        className="bg-slate-900 border border-slate-850 rounded-xl p-3 text-xs text-slate-100 placeholder:opacity-40"
                      />
                    </div>

                    <div className="flex justify-end mt-4">
                      <button
                        onClick={handleAddContact}
                        className={`px-5 py-2.5 rounded-xl text-xs font-mono font-bold tracking-wider uppercase active:scale-95 transition-all cursor-pointer ${
                          contactMode === "whitelist" 
                            ? "bg-teal-500 text-slate-950 hover:bg-teal-450" 
                            : "bg-rose-600 text-ellipsis text-white hover:bg-rose-500"
                        }`}
                      >
                        Inject {contactMode === "whitelist" ? "Whitelist" : "Blocklist"} Record
                      </button>
                    </div>
                  </div>

                  {/* Dual Grid White list and block list */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Whitelist */}
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                      <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-teal-400 mb-4 flex justify-between items-center">
                        🛡 WHitelisted CONTACTS ({contacts.whitelist.length})
                        <span className="text-[10px] text-slate-500 font-normal normal-case">Exceptions allowed</span>
                      </h3>
                      
                      <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                        {contacts.whitelist.map((w) => (
                          <div key={w.id} className="bg-slate-900 border border-slate-850 rounded-xl p-3.5 flex items-center justify-between">
                            <div>
                              <div className="text-xs font-bold text-white">{w.name}</div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">{w.phone}</div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="bg-teal-950 border border-teal-800 text-teal-400 text-[9px] font-mono px-2 py-0.5 rounded uppercase">
                                {w.label}
                              </span>
                              <button
                                onClick={() => handleDeleteContact(w.id, "whitelist")}
                                className="text-slate-500 hover:text-rose-400 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Blacklist */}
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                      <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-rose-450 mb-4 flex justify-between items-center">
                        🚫 BLACKLIST BLOCK-PULSE ({contacts.blacklist.length})
                        <span className="text-[10px] text-slate-500 font-normal normal-case">System rejects these numbers</span>
                      </h3>
                      
                      <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                        {contacts.blacklist.map((b) => (
                          <div key={b.id} className="bg-slate-900 border border-slate-850 rounded-xl p-3.5 flex items-center justify-between">
                            <div>
                              <div className="text-xs font-bold text-rose-300">{b.name}</div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">{b.phone}</div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="bg-rose-950/40 border border-rose-900/30 text-rose-400 text-[9px] font-mono px-2 py-0.5 rounded uppercase">
                                {b.reason}
                              </span>
                              <button
                                onClick={() => handleDeleteContact(b.id, "blacklist")}
                                className="text-slate-500 hover:text-rose-400 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB: GEMINI SMART AUTO-REPLY */}
              {activeTab === "gemini" && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  {/* Headline Title */}
                  <div className="bg-gradient-to-r from-teal-950/40 via-slate-950 to-teal-900/30 border border-teal-500/10 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-teal-400 text-teal-950 text-[10px] font-mono px-2 py-0.5 rounded font-black tracking-wider uppercase">Auto-Pilot</span>
                        <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5 font-mono">
                          <Bot className="text-teal-400 animate-pulse" size={20} />
                          GEMINI AI SMART CHATBOT ENGINE
                        </h2>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed font-mono">
                        Generate instant, polite, and completely human-like responses ("Anti-AI Slop") integrated to your chat channels.
                      </p>
                    </div>

                    <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-3.5 rounded-xl shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] text-zinc-500 block font-mono">ACTIVATE GEMINI ENGINE</span>
                        <span className="text-xs font-bold text-white font-mono">{settings.isGeminiActive ? "AI ACTIVE" : "AI DISABLED"}</span>
                      </div>
                      <button 
                        onClick={() => {
                          const updated = { ...settings, isGeminiActive: !settings.isGeminiActive };
                          setSettings(updated);
                          saveAllSettings(updated);
                          addDebugLog(`Gemini engine set: ${!settings.isGeminiActive ? 'ACTIVE' : 'DEACTIVATED'}`, "warning");
                        }}
                        className="cursor-pointer font-bold select-none focus:outline-none"
                      >
                        {settings.isGeminiActive ? (
                          <ToggleRight className="text-teal-400 w-11 h-11" />
                        ) : (
                          <ToggleLeft className="text-slate-600 w-11 h-11" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Settings grid */}
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    {/* Left Settings inputs */}
                    <div className="xl:col-span-8 space-y-6">
                      
                      {/* Personality Fields Card */}
                      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-5">
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-teal-400 border-b border-slate-800 pb-3 flex items-center gap-2">
                          <Cpu size={14} />
                          A. PERSONALITY PROFILE & BUSINESS ATTRIBUTES
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                          {/* Owner Name */}
                          <div className="space-y-1.5">
                            <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Owner / Sender Name (Nama Pemilik HP)</label>
                            <input 
                              type="text"
                              value={settings.geminiProfile?.ownerName || ""}
                              onChange={(e) => {
                                const updated = {
                                  ...settings,
                                  geminiProfile: { ...settings.geminiProfile, ownerName: e.target.value }
                                };
                                setSettings(updated);
                              }}
                              onBlur={() => saveAllSettings(settings)}
                              placeholder="e.g. Bagas Adi"
                              className="w-full bg-slate-900 border border-slate-850 rounded-xl p-3 text-slate-105 placeholder:opacity-35 focus:border-teal-400 focus:outline-none"
                            />
                            <span className="text-[9px] text-slate-500 block leading-normal">Allows Gemini to sign off or pretend to be this human naturally.</span>
                          </div>

                          {/* Business Niche */}
                          <div className="space-y-1.5">
                            <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Business Niche / Role (Peran / Bidang Usaha)</label>
                            <input 
                              type="text"
                              value={settings.geminiProfile?.businessNiche || ""}
                              onChange={(e) => {
                                const updated = {
                                  ...settings,
                                  geminiProfile: { ...settings.geminiProfile, businessNiche: e.target.value }
                                };
                                setSettings(updated);
                              }}
                              onBlur={() => saveAllSettings(settings)}
                              placeholder="e.g. Toko Kue Bolu Kukus Legit Sidoarjo"
                              className="w-full bg-slate-900 border border-slate-850 rounded-xl p-3 text-slate-105 placeholder:opacity-35 focus:border-teal-400 focus:outline-none"
                            />
                            <span className="text-[9px] text-slate-500 block leading-normal">Crucial for giving correct context about what you sell/offer.</span>
                          </div>

                          {/* Obstacle Status */}
                          <div className="space-y-1.5">
                            <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Availability / Obstacle (Status Hambatan/Kesibukan)</label>
                            <input 
                              type="text"
                              value={settings.geminiProfile?.obstacleStatus || ""}
                              onChange={(e) => {
                                const updated = {
                                  ...settings,
                                  geminiProfile: { ...settings.geminiProfile, obstacleStatus: e.target.value }
                                };
                                setSettings(updated);
                              }}
                              onBlur={() => saveAllSettings(settings)}
                              placeholder="e.g. Sedang sibuk baking pesanan di dapur cabang utama"
                              className="w-full bg-slate-900 border border-slate-850 rounded-xl p-3 text-slate-105 placeholder:opacity-35 focus:border-teal-400 focus:outline-none"
                            />
                            <span className="text-[9px] text-slate-500 block leading-normal">Explains why user is using auto-reply or why response takes secondary time.</span>
                          </div>

                          {/* Speaking style */}
                          <div className="space-y-1.5">
                            <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Speaking Style tone (Gaya Bicara)</label>
                            <input 
                              type="text"
                              value={settings.geminiProfile?.speakingStyle || ""}
                              onChange={(e) => {
                                const updated = {
                                  ...settings,
                                  geminiProfile: { ...settings.geminiProfile, speakingStyle: e.target.value }
                                };
                                setSettings(updated);
                              }}
                              onBlur={() => saveAllSettings(settings)}
                              placeholder="e.g. Santai gaul bumbu sedikit slang, menyapa dengan Kakak"
                              className="w-full bg-slate-900 border border-slate-850 rounded-xl p-3 text-slate-105 placeholder:opacity-35 focus:border-teal-400 focus:outline-none"
                            />
                            <span className="text-[9px] text-slate-500 block leading-normal">Ensures personality feels authentic and perfectly human-like.</span>
                          </div>
                        </div>

                        {/* Promo info */}
                        <div className="space-y-1.5 font-mono text-xs font-medium">
                          <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Promotional Campaigns / Services Details (Produk/Layanan Promosi)</label>
                          <textarea 
                            value={settings.geminiProfile?.promoInfo || ""}
                            onChange={(e) => {
                              const updated = {
                                ...settings,
                                  geminiProfile: { ...settings.geminiProfile, promoInfo: e.target.value }
                              };
                              setSettings(updated);
                            }}
                            onBlur={() => saveAllSettings(settings)}
                            placeholder="e.g. Promo khusus bulan ini beli 2 box gratis 1 mini pack dengan voucher BOLULEGIT"
                            rows={2}
                            className="w-full bg-slate-900 border border-slate-850 rounded-xl p-3 text-slate-101 placeholder:opacity-35 focus:border-teal-400 focus:outline-none font-sans"
                          />
                          <span className="text-[9px] text-slate-500 block leading-normal">Mentioned dynamically in context when customer asks about prices, discounts or options.</span>
                        </div>

                        {/* Marketing Goal CTA */}
                        <div className="space-y-1.5 font-mono text-xs font-medium font-bold">
                          <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Marketing Goal / Call To Action (Tujuan Marketing & CTA)</label>
                          <textarea 
                            value={settings.geminiProfile?.marketingGoal || ""}
                            onChange={(e) => {
                              const updated = {
                                ...settings,
                                  geminiProfile: { ...settings.geminiProfile, marketingGoal: e.target.value }
                              };
                              setSettings(updated);
                            }}
                            onBlur={() => saveAllSettings(settings)}
                            placeholder="e.g. Minta pembeli untuk tinggalkan nomor order atau arahkan klik bolu.com/order"
                            rows={2}
                            className="w-full bg-slate-900 border border-slate-850 rounded-xl p-3 text-slate-101 placeholder:opacity-35 focus:border-teal-400 focus:outline-none font-sans"
                          />
                          <span className="text-[9px] text-slate-500 block leading-normal">Gemini uses this destination to direct conversations to drive conversions of your product!</span>
                        </div>

                        <div className="flex justify-end pt-2">
                          <button 
                            onClick={() => {
                              saveAllSettings(settings);
                              addDebugLog(`Gemini character attributes saved successfully!`, "success");
                              triggerAlert("Custom configuration saved!");
                            }}
                            className="bg-teal-500 hover:bg-teal-400 cursor-pointer active:scale-95 text-slate-950 font-mono text-xs font-bold uppercase tracking-widest px-6 py-3 rounded-xl transition-all"
                          >
                            Save Profile Properties
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right Parameters panel */}
                    <div className="xl:col-span-4 space-y-6 font-mono text-xs">
                      
                      {/* Operational modes */}
                      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-5">
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-teal-400 border-b border-slate-800 pb-3 flex items-center gap-2">
                          <Settings size={14} />
                          B. OPERATIONAL CONTROLS
                        </h3>

                        {/* Gemini Mode Toggle */}
                        <div className="space-y-2">
                          <label className="text-slate-400 uppercase tracking-wider text-[10px] block font-bold">GEMINI MODE STRATEGY</label>
                          <div className="space-y-2">
                            {[
                              { id: "fallback", label: "Smart Fallback Mode", desc: "Replies with Gemini AI only if no exact/contains keyword rule or spreadsheet rule matches (highly recommended)" },
                              { id: "always", label: "Always Gemini AI Auto-Reply", desc: "Passes everything to Gemini AI first. Skips traditional exact match rules" }
                            ].map((opt) => (
                              <button
                                key={opt.id}
                                onClick={() => {
                                  const updated = { ...settings, geminiMode: opt.id as any };
                                  setSettings(updated);
                                  saveAllSettings(updated);
                                }}
                                className={`w-full text-left p-3 rounded-xl border text-[11px] cursor-pointer transition-all ${
                                  settings.geminiMode === opt.id 
                                    ? "bg-teal-500/10 border-teal-500/30 text-teal-400 font-bold"
                                    : "bg-slate-900 border-slate-850 text-slate-400 hover:text-white"
                                }`}
                              >
                                <div className="uppercase mb-0.5">{opt.label}</div>
                                <div className="text-[9px] opacity-60 leading-normal normal-case">{opt.desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Recipient Option */}
                        <div className="space-y-2">
                          <label className="text-slate-400 uppercase tracking-wider text-[10px] block font-bold font-mono">RECIPIENT FILTER OPTION</label>
                          <select 
                            value={settings.geminiRecipientOption || "Everyone"}
                            onChange={(e) => {
                              const updated = { ...settings, geminiRecipientOption: e.target.value as any };
                              setSettings(updated);
                              saveAllSettings(updated);
                            }}
                            className="w-full bg-slate-900 border border-slate-850 font-mono text-xs rounded-xl p-3 text-slate-100 focus:outline-none"
                          >
                            <option value="Everyone">Everyone (All Incoming Messages)</option>
                            <option value="Only Whitelist">Only Whitelist Contacts (VIP Filter)</option>
                            <option value="Exclude Blacklist">Everyone Except Blacklisted Senders</option>
                          </select>
                          <span className="text-[9px] text-slate-500 block leading-normal">Limits AI usage to prevent API key quota exhaustion.</span>
                        </div>

                        {/* Loops prevention disclosure */}
                        <div className="bg-slate-900/40 border border-slate-850/60 rounded-xl p-4 space-y-2.5 font-mono text-[10px] text-slate-400 leading-relaxed">
                          <div className="text-teal-400 uppercase font-bold flex items-center gap-1.5 border-b border-slate-850 pb-1.5">
                            <ShieldCheck size={12} />
                            Loop prevention active (20s)
                          </div>
                          <div>
                            To prevent infinite chat loops (where two automated bots keep reply-spamming each other back and forth), WhatsAuto integrates a 20-second cache throttling window.
                          </div>
                          <div className="text-rose-400 italic">
                            Subsequent chat lines from the same sender within 20s of an active reply are logged as "SKIPPED".
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 5: INTEGRATION CHANNELS & SETTINGS */}
              {activeTab === "channels" && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 xl:grid-cols-12 gap-6"
                >
                  
                  {/* Channels activation matrices */}
                  <div className="xl:col-span-6 space-y-6">
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                      <h3 className="text-sm font-bold text-white mb-4 border-b border-slate-800 pb-3 flex items-center gap-2 font-mono">
                        <SmartphoneNfc size={16} className="text-teal-400" />
                        A. SUPPORTED CHATTING APPLICATIONS
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed mb-6 font-mono">
                        Select which platform WhatsAuto auto-listening socket intercepts and routes text from. Active channels automatically trigger automated rules.
                      </p>

                      <div className="space-y-3 font-mono text-xs">
                        {[
                          { id: "whatsapp", label: "WhatsApp Standard App", color: "from-green-500 to-emerald-400" },
                          { id: "wabusiness", label: "WhatsApp Business Edition", color: "from-teal-500 to-green-400" },
                          { id: "telegram", label: "Telegram Messenger Socket", color: "from-sky-500 to-blue-400" },
                          { id: "instagram", label: "Instagram direct dm API", color: "from-purple-500 to-pink-500" },
                          { id: "messenger", label: "Facebook Messenger webhook", color: "from-blue-600 to-sky-500" },
                          { id: "signal", label: "Signal Secure Message pipeline", color: "from-blue-400 to-indigo-500" },
                          { id: "viber", label: "Viber Automation interface", color: "from-violet-500 to-purple-500" }
                        ].map((app) => {
                          const isActive = settings.apps && settings.apps[app.id] === true;
                          return (
                            <div 
                              key={app.id}
                              className={`p-3.5 rounded-xl border flex items-center justify-between transition-colors cursor-pointer ${
                                isActive ? "bg-slate-900 border-teal-500/20" : "bg-slate-950 border-slate-850 opacity-60 hover:opacity-100"
                              }`}
                              onClick={() => {
                                const updated = { ...settings, apps: { ...settings.apps, [app.id]: !isActive } };
                                saveAllSettings(updated);
                                addDebugLog(`App connection set: ${app.id.toUpperCase()} = ${!isActive}`, "warning");
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`h-2.5 w-2.5 rounded-full bg-gradient-to-tr ${app.color} shadow-lg shadow-teal-500/10`} />
                                <span className="font-bold text-slate-200">{app.label.toUpperCase()}</span>
                              </div>
                              <button className="focus:outline-none focus:ring-0">
                                {isActive ? (
                                  <ToggleRight className="text-teal-400 w-9 h-9" />
                                ) : (
                                  <ToggleLeft className="text-slate-600 w-9 h-9" />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Fallback & schedules */}
                  <div className="xl:col-span-6 space-y-6">
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                      <h3 className="text-sm font-bold text-white mb-6 border-b border-slate-800 pb-3 flex items-center gap-2 font-mono">
                        <Clock size={16} className="text-teal-400" />
                        B. SYSTEM SCHEDULING & GENERAL CONSTANTS
                      </h3>

                      <div className="space-y-5 text-xs font-mono">
                        {/* Welcome text */}
                        <div className="space-y-2">
                          <label className="text-slate-400 block uppercase tracking-wider text-[10px]">Welcome Message Template (First-Timers Only)</label>
                          <textarea 
                            value={settings.welcomeMessage}
                            onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value })}
                            onBlur={() => saveAllSettings(settings)}
                            rows={2}
                            className="w-full bg-slate-900 border border-slate-850 focus:border-teal-400 focus:outline-none rounded-xl p-3 text-slate-100 font-sans"
                          />
                        </div>

                        {/* Def reply text */}
                        <div className="space-y-2">
                          <label className="text-slate-400 block uppercase tracking-wider text-[10px]">Fallback Default Reply (If no triggers match)</label>
                          <textarea 
                            value={settings.defaultReply}
                            onChange={(e) => setSettings({ ...settings, defaultReply: e.target.value })}
                            onBlur={() => saveAllSettings(settings)}
                            rows={2}
                            className="w-full bg-slate-900 border border-slate-850 focus:border-teal-400 focus:outline-none rounded-xl p-3 text-slate-100 font-sans"
                          />
                        </div>

                        {/* delay ms settings */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-slate-400 block uppercase tracking-wider text-[10px]">Global Delay ms</label>
                            <input 
                              type="number"
                              value={settings.replyDelayMs}
                              onChange={(e) => setSettings({ ...settings, replyDelayMs: parseInt(e.target.value) || 0 })}
                              onBlur={() => saveAllSettings(settings)}
                              className="w-full bg-slate-900 border border-slate-850 focus:border-teal-400 focus:outline-none rounded-xl p-3 text-slate-100 font-bold"
                            />
                            <span className="text-[10px] text-slate-500 leading-normal block">Predefined simulated timing</span>
                          </div>

                          <div className="space-y-2">
                            <label className="text-slate-400 block uppercase tracking-wider text-[10px]">Active Hours Mode</label>
                            <select
                              value={settings.activeHours?.type || "Always"}
                              onChange={(e) => {
                                const type = e.target.value as any;
                                setSettings({ ...settings, activeHours: { ...settings.activeHours, type } });
                              }}
                              onBlur={() => saveAllSettings(settings)}
                              className="w-full bg-slate-900 border border-slate-850 focus:border-teal-400 focus:outline-none rounded-xl p-3 text-slate-100"
                            >
                              <option value="Always">Active 24 Hours Always</option>
                              <option value="Custom">Custom Business Hours</option>
                            </select>
                            <span className="text-[10px] text-slate-500 leading-normal block">Temporal operational scale</span>
                          </div>
                        </div>

                        {settings.activeHours?.type === "Custom" && (
                          <div className="grid grid-cols-2 gap-4 animate-fadeIn">
                            <div className="space-y-1">
                              <label className="text-slate-500 text-[9px] uppercase tracking-wider block">Operational Start Time</label>
                              <input 
                                type="time"
                                value={settings.activeHours.start || "08:00"}
                                onChange={(e) => setSettings({
                                  ...settings,
                                  activeHours: { ...settings.activeHours, start: e.target.value }
                                })}
                                onBlur={() => saveAllSettings(settings)}
                                className="w-full bg-slate-900 border border-slate-850 text-slate-100 p-2.5 rounded-lg text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-slate-500 text-[9px] uppercase tracking-wider block">Operational End Time</label>
                              <input 
                                type="time"
                                value={settings.activeHours.end || "18:00"}
                                onChange={(e) => setSettings({
                                  ...settings,
                                  activeHours: { ...settings.activeHours, end: e.target.value }
                                })}
                                onBlur={() => saveAllSettings(settings)}
                                className="w-full bg-slate-900 border border-slate-850 text-slate-100 p-2.5 rounded-lg text-xs"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 6: ANALYTICS */}
              {activeTab === "analytics" && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  
                  {/* Metric panels */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1">Incoming Intercepts</span>
                      <div className="text-3xl font-black text-slate-100 font-mono tracking-tight">{analyticsData.total}</div>
                      <span className="text-[9px] text-teal-400 font-mono mt-1 block">✔ Handled by match rules</span>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1">Direct Rules Rules Hits</span>
                      <div className="text-3xl font-black text-emerald-400 font-mono tracking-tight">
                        {analyticsData.matchTypes["Rule"] || 0}
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono mt-1 block">Hits from Custom Replies</span>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1">Sheet Sync Lookup hits</span>
                      <div className="text-3xl font-black text-sky-450 font-mono tracking-tight">
                        {analyticsData.matchTypes["Spreadsheet"] || 0}
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono mt-1 block">Hits from Google Excel</span>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1">Blacklisted block rate</span>
                      <div className="text-3xl font-black text-rose-500 font-mono tracking-tight">
                        {analyticsData.matchTypes["Ignored"] || 0}
                      </div>
                      <span className="text-[9px] text-slate-405 font-mono mt-1 block">Blocked loops</span>
                    </div>
                  </div>

                  {/* SVG Custom Charts row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                      <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 mb-6">Hits Distribution by channel</h3>
                      
                      {/* Responsive SVG Bar Chart */}
                      <div className="w-full h-[200px] flex items-end justify-around border-b border-l border-slate-800 pb-3 pl-3 font-mono text-[9px]">
                        {[
                          { key: "whatsapp", label: "WA" },
                          { key: "telegram", label: "TG" },
                          { key: "instagram", label: "IG" },
                          { key: "messenger", label: "MS" }
                        ].map((plat) => {
                          const count = analyticsData.platforms[plat.key] || 0;
                          const heightPct = analyticsData.total > 0 ? (count / analyticsData.total) * 100 : 0;
                          return (
                            <div key={plat.key} className="flex flex-col items-center gap-2 group w-12">
                              <span className="text-teal-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">{count}</span>
                              <div 
                                style={{ height: `${Math.max(5, heightPct)}%` }} 
                                className="w-full bg-gradient-to-t from-teal-600 to-emerald-400 rounded-t transition-all duration-500 min-h-[4px]"
                              />
                              <span className="text-slate-500 font-bold uppercase">{plat.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                      <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 mb-6">Reason Match-Type Ratio</h3>
                      
                      {/* Interactive visual lists acting as chart */}
                      <div className="space-y-4 font-mono text-xs">
                        {Object.entries(analyticsData.matchTypes).map(([key, value]) => {
                          const numVal = value as number;
                          const pct = analyticsData.total > 0 ? (numVal / analyticsData.total) * 100 : 0;
                          return (
                            <div key={key} className="space-y-1.5">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="uppercase text-slate-300 font-bold">{key}</span>
                                <span className="text-slate-400 font-normal">{numVal} messages ({Math.round(pct)}%)</span>
                              </div>
                              <div className="w-full h-2 bg-slate-900 overflow-hidden rounded">
                                <div 
                                  style={{ width: `${pct}%` }}
                                  className={`h-full bg-teal-500`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Detailed Interactive Log Transaction History */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
                          <Database size={16} className="text-teal-400 animate-pulse" />
                          OFFLINE LOGS DATABASE (ROOM DB TRACE HISTORY) ({filteredHistory.length})
                        </h3>
                        <p className="text-[10px] text-slate-500 font-mono mt-1">Interception logs, response latency, exceptions, and loops cache throttling history.</p>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3.5 w-full md:w-auto">
                        {/* Search input */}
                        <input 
                          type="text" 
                          value={logSearchQuery}
                          onChange={(e) => setLogSearchQuery(e.target.value)}
                          placeholder="Search sender, msg..."
                          className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 font-mono text-[11px] text-slate-200 placeholder:opacity-30 w-full md:w-44 focus:border-teal-400 focus:outline-none"
                        />
                        
                        {/* Status selector */}
                        <select
                          value={logFilterStatus}
                          onChange={(e) => setLogFilterStatus(e.target.value)}
                          className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 font-mono text-[11px] text-slate-200 focus:outline-none"
                        >
                          <option value="ALL">All Statuses</option>
                          <option value="SUCCESS">SUCCESS (Active)</option>
                          <option value="FAILED">FAILED (Errors)</option>
                          <option value="SKIPPED">SKIPPED (Blocked/Ignored)</option>
                        </select>

                        <button
                          onClick={handleClearHistory}
                          className="text-[10px] font-mono border border-rose-950 bg-rose-950/20 text-rose-400 hover:text-white hover:bg-rose-900 px-3.5 py-2 rounded-xl uppercase active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                        >
                          Clear DB
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full font-mono text-[11px] text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider select-none bg-slate-900/60 font-black">
                            <th className="py-3 px-4 whitespace-nowrap text-center">Timestamp</th>
                            <th className="py-3 px-3">Sender</th>
                            <th className="py-3 px-2 text-center">Channel</th>
                            <th className="py-3 px-3">Received Message</th>
                            <th className="py-3 px-3">Auto-Response Reply</th>
                            <th className="py-3 px-3 text-center">Status</th>
                            <th className="py-3 px-3 text-center">Latency</th>
                            <th className="py-3 px-3">Engine Match / System Error Info</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {filteredHistory.map((entry) => {
                            const currentStatus = entry.status || "SUCCESS";
                            const responseTimeVal = entry.responseTimeMs !== undefined ? entry.responseTimeMs : 150;
                            return (
                              <tr key={entry.id} className="hover:bg-slate-900/40 select-all transition-colors leading-relaxed">
                                <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap text-center text-[10px]">
                                  {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString([], { hour12: false }) : new Date().toLocaleTimeString([], { hour12: false })}
                                </td>
                                <td className="py-3.5 px-3 text-slate-200 font-bold">{entry.sender}</td>
                                <td className="py-3.5 px-2 text-center">
                                  <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[9px] uppercase text-zinc-300 font-medium">
                                    {entry.platform}
                                  </span>
                                </td>
                                <td className="py-3.5 px-3 text-teal-400">"{entry.incomingText}"</td>
                                <td className="py-3.5 px-3 text-slate-300 max-w-xs truncate italic">
                                  {entry.replyText ? `"${entry.replyText}"` : <span className="text-slate-500 text-[10px] lowercase italic">[no reply dispatched]</span>}
                                </td>
                                <td className="py-3.5 px-3 text-center">
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                    currentStatus === "SUCCESS" ? "bg-emerald-950/90 text-emerald-400 border border-emerald-800/40" :
                                    currentStatus === "FAILED" ? "bg-rose-950/90 text-rose-400 border border-rose-900/40" :
                                    "bg-amber-950/80 text-amber-400 border border-amber-900/30"
                                  }`}>
                                    {currentStatus}
                                  </span>
                                </td>
                                <td className="py-3.5 px-3 text-center text-slate-400 font-medium">
                                  {responseTimeVal} ms
                                </td>
                                <td className="py-3.5 px-3">
                                  <div className="flex flex-col gap-0.5">
                                    <span className={`text-[10px] font-semibold ${
                                      entry.matchType === "Gemini AI" ? "text-violet-400" :
                                      entry.matchType === "Rule" ? "text-emerald-400" :
                                      entry.matchType === "Spreadsheet" ? "text-sky-400" :
                                      "text-slate-500"
                                    }`}>
                                      {entry.matchType} Match
                                    </span>
                                    {entry.errorMessage && (
                                      <span className="text-[10px] text-rose-450 italic mt-0.5 max-w-sm">
                                        ⚠ {entry.errorMessage}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {filteredHistory.length === 0 && (
                            <tr>
                              <td colSpan={8} className="py-10 text-center text-slate-500">
                                {history.length === 0 
                                  ? "No logs recorded in offline Room DB. Send messages inside the simulator panel to trigger Auto-Replies."
                                  : "No matches found corresponding to your filter criteria."}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
