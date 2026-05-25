export interface Idea {
  id: string;
  text: string;
  pilar: string;
  difficulty: "Low" | "Medium" | "High";
  cta: string;
  topic: string;
  is_unique: boolean;
  score?: number;
}

export interface HistoryEntry {
  id: string;
  text: string;
  pilar: string;
  cta: string;
  topic: string;
  date: string;
}

export interface Rules {
  pilar_cooldown_days: number;
  cta_cooldown_days: number;
  topic_cooldown_days: number;
}

export function calculateBestIdeas(
  subjects: Idea[],
  history: HistoryEntry[],
  rules: Rules
): Idea[] {
  const now = new Date();
  const scoredIdeas: Idea[] = [];

  // Track last used dates
  const lastUsedPilar: Record<string, Date> = {};
  const lastUsedCTA: Record<string, Date> = {};
  const lastUsedTopic: Record<string, Date> = {};

  history.forEach((entry) => {
    const date = new Date(entry.date);
    if (!lastUsedPilar[entry.pilar] || date > lastUsedPilar[entry.pilar]) {
      lastUsedPilar[entry.pilar] = date;
    }
    if (!lastUsedCTA[entry.cta] || date > lastUsedCTA[entry.cta]) {
      lastUsedCTA[entry.cta] = date;
    }
    if (!lastUsedTopic[entry.topic] || date > lastUsedTopic[entry.topic]) {
      lastUsedTopic[entry.topic] = date;
    }
  });

  subjects.forEach((idea) => {
    let score = 0;

    // 1. Anti-Repetition Rules
    const pilarLast = lastUsedPilar[idea.pilar];
    if (pilarLast) {
      const diff = (now.getTime() - pilarLast.getTime()) / (1000 * 60 * 60 * 24);
      if (diff < rules.pilar_cooldown_days) return;
    }

    const ctaLast = lastUsedCTA[idea.cta];
    if (ctaLast) {
      const diff = (now.getTime() - ctaLast.getTime()) / (1000 * 60 * 60 * 24);
      if (diff < rules.cta_cooldown_days) return;
    }

    const topicLast = lastUsedTopic[idea.topic];
    if (topicLast) {
      const diff = (now.getTime() - topicLast.getTime()) / (1000 * 60 * 60 * 24);
      if (diff < rules.topic_cooldown_days) return;
    }

    // 2. Scoring Logic
    // +30 relevance to previous (keyword overlap)
    if (history.length > 0) {
      const last = history[history.length - 1];
      const lastWords = new Set(last.text.toLowerCase().split(" "));
      const currentWords = idea.text.toLowerCase().split(" ");
      if (currentWords.some((w) => lastWords.has(w))) {
        score += 30;
      }
    }

    // +20 low difficulty
    if (idea.difficulty === "Low") {
      score += 20;
    }

    // +10 unique source
    if (idea.is_unique) {
      score += 10;
    }

    // +20 if CTA rarely used
    const ctaUses = history.filter((h) => h.cta === idea.cta).length;
    if (ctaUses === 0) {
      score += 20;
    } else if (ctaUses < 3) {
      score += 10;
    }

    scoredIdeas.push({ ...idea, score });
  });

  return scoredIdeas.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5);
}
