import json

# ============================================================
# SWAP GROUP DEFINITIONS
# Engine note: These become constants in src/constants.ts
# Function: getSwapGroup(abilityName) -> group name or null
# ============================================================
SWAP_GROUPS = {
    "Stat A": {"Strength", "Wisdom", "Aura"},
    "Stat B": {"Constitution", "Dexterity", "Agility", "Discipline"},
    "Stat C": {"Logic", "Intuition", "Influence"},
    "Weapons": {"Edged Weapons", "Blunt Weapons", "Ranged Weapons", "Thrown Weapons",
                "Polearm Weapons", "Two-Handed Weapons", "Brawling", "Spell Aiming"},
    "MC": {"Elemental Mana Control", "Spirit Mana Control", "Mental Mana Control"},
    "Lores": {"Elemental Lore - Air", "Elemental Lore - Earth", "Elemental Lore - Fire",
              "Elemental Lore - Water", "Spiritual Lore - Blessings", "Spiritual Lore - Religion",
              "Spiritual Lore - Summoning", "Sorcerous Lore - Demonology", "Sorcerous Lore - Necromancy",
              "Mental Lore - Manipulation", "Mental Lore - Telepathy", "Mental Lore - Transference",
              "Mental Lore - Transformation"},
    "Recovery": {"Mana Recovery", "Stamina Recovery", "Health Recovery"},
    "MIU/AS": {"Magic Item Use", "Arcane Symbols"},
}

def normalize(ability):
    """
    Engine note: This is the critical normalization function.
    Shop items store abilities as "Spirit Mana Control Bonus", "Spell Aiming Ranks", etc.
    We strip Bonus/Ranks/Base suffixes to get the canonical ability name for group lookup.
    """
    a = ability
    for suffix in [" Bonus", " Ranks", " Base"]:
        a = a.replace(suffix, "")
    return a.strip()

def get_group(ability):
    """Engine note: Returns (group_name, effective_boost_multiplier) or (None, 1)"""
    a = normalize(ability)
    for name, group in SWAP_GROUPS.items():
        if a in group:
            return name
    return None

# ============================================================
# MEJORA'S GOALS AND CURRENT STATE
# Engine note: Goals come from set_goals table.
# Current totals computed by summing inventory enhancives per swap group.
# ============================================================
GOALS = {
    "Stat A":    {"target": 40, "current": 45, "gap": 0,  "label": "Wisdom"},
    "Stat B":    {"target": 40, "current": 40, "gap": 0,  "label": "Discipline"},
    "Stat C":    {"target": 40, "current": 40, "gap": 0,  "label": "Logic"},
    "MC":        {"target": 50, "current": 16, "gap": 34, "label": "Mana Controls"},
    "Weapons":   {"target": 50, "current": 25, "gap": 25, "label": "Spell Aiming/Weapons"},
    "Recovery":  {"target": 50, "current": 28, "gap": 22, "label": "Recovery"},
    "Lores":     {"target": 50, "current": 3,  "gap": 47, "label": "Lores"},
}

# Slots Mejora has open (no item, can equip directly)
# Engine note: These come from comparing inventory slots against SLOT_LIMITS
OPEN_SLOTS = {"ankle", "back", "belt", "both_ears", "chest_slipped", "feet_slipped",
              "fingers", "legs_pulled", "legs_slipped", "neck", "pin", "shoulder_slung"}

# ============================================================
# SCORING FUNCTION
# Engine note: This is the core of calculateGroupContribution()
# For each shop item, sum all enhancive boosts that fall into a goal's swap group.
# Then score = sum of min(contribution, remaining_gap) across all goals.
# This prevents over-counting past the cap.
# ============================================================
def score_item(enhancives):
    """
    Returns (total_useful_score, per_goal_breakdown)
    
    Engine note for code:
      for each enhancive on item:
        group = getSwapGroup(normalize(enhancive.ability))
        if group and group in userGoals:
          contribution[group] += effective_boost
      score = sum(min(contribution[g], goals[g].gap) for g in contribution)
    """
    contributions = {}
    for enh in enhancives:
        ability = enh["ability"]
        boost = enh["boost"]
        group = get_group(ability)
        if group and group in GOALS and GOALS[group]["gap"] > 0:
            # Health Recovery counts at half value for Recovery group
            effective = boost // 2 if ability == "Health Recovery" else boost
            contributions[group] = contributions.get(group, 0) + effective
    
    # Cap contribution at remaining gap (no credit for over-filling)
    score = 0
    capped = {}
    for group, contrib in contributions.items():
        useful = min(contrib, GOALS[group]["gap"])
        score += useful
        capped[group] = useful
    
    return score, capped

# ============================================================
# LOAD AND SCORE ALL SHOP ITEMS
# ============================================================
data = json.load(open("/home/rpgfilms/enhancive-alert/shop_items.json"))

scored = []
for item in data["items"]:
    if not item.get("available"):
        continue
    enh_raw = item.get("enhancives_json", "[]")
    enhancives = json.loads(enh_raw) if isinstance(enh_raw, str) else enh_raw
    if not enhancives:
        continue
    
    score, breakdown = score_item(enhancives)
    if score == 0:
        continue
    
    # Engine note: slot filtering happens here
    # For open-slot-only recommendations, check if item's slot is in OPEN_SLOTS
    slot = item.get("worn") or "nugget"  # items without worn slot need nugget
    
    scored.append({
        "name": item["name"],
        "town": item["town"],
        "shop": item["shop"],
        "cost": item["cost"],
        "slot": slot,
        "score": score,
        "breakdown": breakdown,
        "enhancives": enhancives,
        "is_open_slot": slot in OPEN_SLOTS or slot == "nugget",
    })

# Sort by score descending, then cost ascending
scored.sort(key=lambda x: (-x["score"], x["cost"]))

# ============================================================
# RESULTS: TOP ITEMS FOR OPEN SLOTS (pure gain, no cascade risk)
# ============================================================
print("=" * 90)
print("TOP 25 ITEMS BY GAP-FILL SCORE (available, any slot)")
print("Gaps: MC=34, Weapons=25, Recovery=22, Lores=47")
print("=" * 90)
for i, item in enumerate(scored[:25]):
    bd = ", ".join(f"{GOALS[g]['label']}:+{v}" for g, v in item["breakdown"].items())
    cost_str = f"{item['cost']:>12,}"
    print(f"\n  #{i+1} [score={item['score']}] {item['name']}")
    print(f"     {item['town']} / {item['shop']} | Cost: {cost_str} | Slot: {item['slot']}")
    print(f"     Gap fill: {bd}")
    enh_str = ", ".join(f"{e['ability']}+{e['boost']}" for e in item["enhancives"])
    print(f"     Raw: {enh_str}")

# ============================================================
# RESULTS: BEST ITEMS THAT FIT OPEN SLOTS (nugget = any slot)
# ============================================================
print()
print("=" * 90)
print("TOP 25 NUGGET-ABLE ITEMS (can go in any open slot)")
print("=" * 90)
nuggetable = [x for x in scored if x["slot"] == "nugget"]
for i, item in enumerate(nuggetable[:25]):
    bd = ", ".join(f"{GOALS[g]['label']}:+{v}" for g, v in item["breakdown"].items())
    cost_str = f"{item['cost']:>12,}"
    print(f"\n  #{i+1} [score={item['score']}] {item['name']}")
    print(f"     {item['town']} / {item['shop']} | Cost: {cost_str}")
    print(f"     Gap fill: {bd}")
    enh_str = ", ".join(f"{e['ability']}+{e['boost']}" for e in item["enhancives"])
    print(f"     Raw: {enh_str}")

# ============================================================
# EFFICIENCY: Score per silver (best bang for buck)
# ============================================================
print()
print("=" * 90)
print("TOP 25 BY EFFICIENCY (score per million silver)")
print("=" * 90)
efficient = [x for x in scored if x["cost"] > 0]
efficient.sort(key=lambda x: -x["score"] / x["cost"])
for i, item in enumerate(efficient[:25]):
    eff = item["score"] / (item["cost"] / 1_000_000)
    bd = ", ".join(f"{GOALS[g]['label']}:+{v}" for g, v in item["breakdown"].items())
    cost_str = f"{item['cost']:>12,}"
    print(f"\n  #{i+1} [score={item['score']}, eff={eff:.1f}/M] {item['name']}")
    print(f"     {item['town']} / {item['shop']} | Cost: {cost_str} | Slot: {item['slot']}")
    print(f"     Gap fill: {bd}")
