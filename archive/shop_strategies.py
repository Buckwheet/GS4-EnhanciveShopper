import json

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
    a = ability
    for suffix in [" Bonus", " Ranks", " Base"]:
        a = a.replace(suffix, "")
    return a.strip()

def get_group(ability):
    a = normalize(ability)
    for name, group in SWAP_GROUPS.items():
        if a in group:
            return name
    return None

def score_item(enhancives, gaps):
    contributions = {}
    for enh in enhancives:
        group = get_group(enh["ability"])
        if group and group in gaps and gaps[group] > 0:
            effective = enh["boost"] // 2 if enh["ability"] == "Health Recovery" else enh["boost"]
            contributions[group] = contributions.get(group, 0) + effective
    score = 0
    capped = {}
    for group, contrib in contributions.items():
        useful = min(contrib, gaps[group])
        score += useful
        capped[group] = useful
    return score, capped

GAPS = {"MC": 34, "Weapons": 25, "Recovery": 22, "Lores": 47}
TOTAL_GAP = sum(GAPS.values())  # 128
MAX_SLOTS = 16
NUGGET_COST = 25_000_000

# Bloodstone family filter — user already owns one
BLOODSTONE_NAMES = {"an oval bloodstone pendant", "an oval bloodstone ring", "an oval bloodstone barrette",
                    "an oval bloodstone bracelet", "an oval bloodstone earring"}

data = json.load(open("/home/rpgfilms/enhancive-alert/shop_items.json"))
ALL_CANDIDATES = []
for item in data["items"]:
    if not item.get("available"):
        continue
    if item.get("shop", "").lower() == "yakushi":
        continue
    if item["name"] in BLOODSTONE_NAMES:
        continue
    enh_raw = item.get("enhancives_json", "[]")
    enhancives = json.loads(enh_raw) if isinstance(enh_raw, str) else enh_raw
    if not enhancives:
        continue
    ALL_CANDIDATES.append({
        "id": item["id"],
        "name": item["name"],
        "town": item["town"],
        "shop": item["shop"],
        "cost": item["cost"],
        "slot": item.get("worn") or "nugget",
        "enhancives": enhancives,
    })

def true_cost(item):
    return item["cost"] + (NUGGET_COST if item["slot"] == "nugget" else 0)

def run_strategy(name, pick_fn, max_slots=MAX_SLOTS):
    """Run a greedy strategy with a custom pick function."""
    remaining = dict(GAPS)
    used = set()
    total_cost = 0
    picks = []
    
    for r in range(max_slots):
        best = pick_fn(ALL_CANDIDATES, used, remaining)
        if not best:
            break
        
        used.add(best["id"])
        ic = true_cost(best)
        total_cost += ic
        _, bd = score_item(best["enhancives"], remaining)
        for g, v in bd.items():
            remaining[g] = max(0, remaining[g] - v)
        sc = sum(bd.values())
        picks.append({"item": best, "score": sc, "bd": bd, "ic": ic})
        
        if all(v == 0 for v in remaining.values()):
            break
    
    unfilled = sum(remaining.values())
    pct = (TOTAL_GAP - unfilled) / TOTAL_GAP * 100
    
    print(f"\n{'='*90}")
    print(f"  {name}")
    print(f"  {len(picks)} items | {total_cost:,} silver | {pct:.0f}% filled | Remaining: {remaining}")
    print(f"{'='*90}")
    for i, p in enumerate(picks):
        bd_s = ", ".join(f"{g}:+{v}" for g, v in p["bd"].items())
        nug = " +nug" if p["item"]["slot"] == "nugget" else ""
        print(f"  {i+1:2}. [{p['score']:2}] {p['item']['name'][:55]:<55} {p['ic']:>12,}{nug}  {bd_s}")
    print(f"\n  Total: {total_cost:,} | Gaps: {remaining} | Fill: {pct:.0f}%")
    return picks, remaining, total_cost

# ============================================================
# STRATEGY 1: HYBRID — cheap wins first, then max score
# ============================================================
def pick_hybrid(candidates, used, gaps):
    EFF_THRESHOLD = 30  # points per million silver
    
    # Phase 1: try to find efficient item
    best_eff_item = None
    best_eff = 0
    best_eff_score = 0
    for c in candidates:
        if c["id"] in used: continue
        s, _ = score_item(c["enhancives"], gaps)
        if s < 3: continue
        ic = true_cost(c)
        eff = s / (ic / 1_000_000)
        if eff >= EFF_THRESHOLD and (eff > best_eff or (eff == best_eff and s > best_eff_score)):
            best_eff_item = c; best_eff = eff; best_eff_score = s
    
    if best_eff_item:
        return best_eff_item
    
    # Phase 2: no efficient items left, switch to max score
    best = None
    best_score = 0
    for c in candidates:
        if c["id"] in used: continue
        s, _ = score_item(c["enhancives"], gaps)
        if s > best_score or (s == best_score and best and c["cost"] < best["cost"]):
            best = c; best_score = s
    return best if best_score > 0 else None

# ============================================================
# STRATEGY 2: MULTI-GOAL PRIORITY — prefer items hitting 2+ gaps
# ============================================================
def pick_multigoal(candidates, used, gaps):
    best = None
    best_key = (-1, -1, 999999999999)  # (num_goals_hit, score, cost)
    for c in candidates:
        if c["id"] in used: continue
        s, bd = score_item(c["enhancives"], gaps)
        if s < 3: continue
        goals_hit = len(bd)
        key = (-goals_hit, -s, true_cost(c))
        if key < best_key:
            best = c; best_key = key
    return best

# ============================================================
# STRATEGY 3: LARGEST GAP FIRST — always target the biggest remaining gap
# ============================================================
def pick_largest_gap(candidates, used, gaps):
    # Find the group with the largest gap
    worst_group = max(gaps, key=lambda g: gaps[g])
    if gaps[worst_group] == 0:
        return None
    
    # Find item with best contribution to that specific group
    best = None
    best_contrib = 0
    best_cost = 999999999999
    for c in candidates:
        if c["id"] in used: continue
        s, bd = score_item(c["enhancives"], gaps)
        if s < 2: continue
        group_contrib = bd.get(worst_group, 0)
        # Primary: best contribution to worst gap. Secondary: total score. Tertiary: cheapest.
        if (group_contrib > best_contrib or 
            (group_contrib == best_contrib and s > (score_item(best["enhancives"], gaps)[0] if best else 0)) or
            (group_contrib == best_contrib and best and s == score_item(best["enhancives"], gaps)[0] and true_cost(c) < best_cost)):
            best = c; best_contrib = group_contrib; best_cost = true_cost(c)
    return best

# ============================================================
# STRATEGY 4: BALANCED FILL — score weighted by how much % of each gap is filled
# ============================================================
def pick_balanced(candidates, used, gaps):
    """Score = sum of (contribution / gap) for each group. This prioritizes
    items that make the biggest PROPORTIONAL dent in their gaps."""
    best = None
    best_weighted = 0
    best_cost = 999999999999
    for c in candidates:
        if c["id"] in used: continue
        s, bd = score_item(c["enhancives"], gaps)
        if s < 2: continue
        # Weighted score: how much % of each gap does this item fill?
        weighted = 0
        for g, v in bd.items():
            if gaps[g] > 0:
                weighted += v / gaps[g]  # e.g., filling 10/34 MC = 0.29
        ic = true_cost(c)
        if weighted > best_weighted or (weighted == best_weighted and ic < best_cost):
            best = c; best_weighted = weighted; best_cost = ic
    return best

# ============================================================
# STRATEGY 5: BALANCED FILL + COST PENALTY
# Same as balanced but divides by log(cost) to penalize expensive items
# ============================================================
import math
def pick_balanced_cost(candidates, used, gaps):
    best = None
    best_val = 0
    for c in candidates:
        if c["id"] in used: continue
        s, bd = score_item(c["enhancives"], gaps)
        if s < 2: continue
        weighted = 0
        for g, v in bd.items():
            if gaps[g] > 0:
                weighted += v / gaps[g]
        ic = true_cost(c)
        # Divide by log10(cost) — a 1M item gets /6, a 100M item gets /8
        # This gently penalizes expensive items without ignoring them
        val = weighted / math.log10(max(ic, 1000))
        if val > best_val:
            best = c; best_val = val
    return best

# Run all strategies
print("\n" + "#" * 90)
print("# MEJORA SHOPPING SIMULATION — 5 STRATEGIES (no Yakushi, no bloodstone dupes)")
print(f"# Gaps: MC={GAPS['MC']}, Weapons={GAPS['Weapons']}, Recovery={GAPS['Recovery']}, Lores={GAPS['Lores']} (total={TOTAL_GAP})")
print(f"# Available slots: {MAX_SLOTS} (12 open + 4 free replacements)")
print("#" * 90)

run_strategy("STRATEGY 1: HYBRID (cheap wins @ 30/M threshold, then max score)", pick_hybrid)
run_strategy("STRATEGY 2: MULTI-GOAL PRIORITY (prefer items hitting 2+ gaps)", pick_multigoal)
run_strategy("STRATEGY 3: LARGEST GAP FIRST (always target biggest remaining gap)", pick_largest_gap)
run_strategy("STRATEGY 4: BALANCED FILL (proportional gap reduction)", pick_balanced)
run_strategy("STRATEGY 5: BALANCED + COST PENALTY (proportional / log10(cost))", pick_balanced_cost)
