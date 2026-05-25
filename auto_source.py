import json
import datetime
import os

# Paths to data files
SUBJECT_BANK_PATH = 'src/data/subject-bank.json'
ANTI_REPETITION_PATH = 'src/data/anti-repetition.json'
HISTORY_PATH = 'src/data/history.json'

def load_json(path):
    if not os.path.exists(path):
        return {} if 'anti' in path else []
    with open(path, 'r') as f:
        return json.load(f)

def save_json(path, data):
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

def calculate_scores():
    subjects = load_json(SUBJECT_BANK_PATH)
    rules_data = load_json(ANTI_REPETITION_PATH)
    history = load_json(HISTORY_PATH)
    
    rules = rules_data.get('rules', {})
    now = datetime.datetime.now()

    scored_ideas = []
    
    # Track used attributes from history
    used_pilars = {} # pilar -> last_date
    used_ctas = {}   # cta -> last_date
    used_topics = {} # topic -> last_date
    
    for entry in history:
        date = datetime.datetime.fromisoformat(entry['date'].replace('Z', ''))
        
        p = entry.get('pilar')
        if p and (p not in used_pilars or date > used_pilars[p]):
            used_pilars[p] = date
            
        c = entry.get('cta')
        if c and (c not in used_ctas or date > used_ctas[c]):
            used_ctas[c] = date
            
        t = entry.get('topic')
        if t and (t not in used_topics or date > used_topics[t]):
            used_topics[t] = date

    for idea in subjects:
        score = 0
        
        # 1. Anti-Repetition Rules (Cooldown check)
        # Pilar same: cooldown 4 days
        last_pilar_date = used_pilars.get(idea['pilar'])
        if last_pilar_date:
            days_passed = (now - last_pilar_date).days
            if days_passed < rules.get('pilar_cooldown_days', 4):
                continue # Skip if in cooldown
                
        # CTA same: cooldown 2 days
        last_cta_date = used_ctas.get(idea['cta'])
        if last_cta_date:
            days_passed = (now - last_cta_date).days
            if days_passed < rules.get('cta_cooldown_days', 2):
                continue # Skip if in cooldown
                
        # Topic same: cooldown 30 days
        last_topic_date = used_topics.get(idea['topic'])
        if last_topic_date:
            days_passed = (now - last_topic_date).days
            if days_passed < rules.get('topic_cooldown_days', 30):
                continue # Skip if in cooldown

        # 2. Scoring Logic
        # +30 jika relevan dengan konten sebelumnya (Keyword matching simple)
        if history:
            last_entry = history[-1]
            # Simple keyword overlap check for relevance
            last_keywords = set(last_entry['text'].lower().split())
            current_keywords = set(idea['text'].lower().split())
            if last_keywords.intersection(current_keywords):
                score += 30
                
        # +20 jika tingkat kesulitan rendah
        if idea.get('difficulty') == 'Low':
            score += 20
            
        # +10 jika sumber unik/original
        if idea.get('is_unique'):
            score += 10
            
        # +20 jika CTA jarang digunakan
        # Check how many times it was used in history
        cta_use_count = sum(1 for e in history if e['cta'] == idea['cta'])
        if cta_use_count == 0:
            score += 20
        elif cta_use_count < 3:
            score += 10 # Slightly less if used a bit

        idea_with_score = idea.copy()
        idea_with_score['score'] = score
        scored_ideas.append(idea_with_score)

    # Sort by score descending
    scored_ideas.sort(key=lambda x: x['score'], reverse=True)
    return scored_ideas[:5]

def produce_content(selected_idea):
    history = load_json(HISTORY_PATH)
    now = datetime.datetime.now().isoformat() + "Z"
    
    new_entry = {
        "id": selected_idea['id'],
        "text": selected_idea['text'],
        "pilar": selected_idea['pilar'],
        "cta": selected_idea['cta'],
        "topic": selected_idea['topic'],
        "date": now
    }
    
    history.append(new_entry)
    save_json(HISTORY_PATH, history)
    print(f"\nSuccessfully produced content: {selected_idea['text']}")
    print("History updated automatically.")

if __name__ == "__main__":
    best_ideas = calculate_scores()
    print("--- 5 BEST IDEAS FOR TODAY ---")
    for i, idea in enumerate(best_ideas):
        print(f"{i+1}. [{idea['score']} pts] {idea['text']} ({idea['pilar']} | CTA: {idea['cta']})")
    
    if best_ideas:
        # For the script simulation, we'll choose the top one
        # In a real system, the user would pick one.
        print("\nProducing top idea automatically...")
        produce_content(best_ideas[0])
    else:
        print("No ideas available (all in cooldown).")
