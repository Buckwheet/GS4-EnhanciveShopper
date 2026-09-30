import json, math

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

# KEY INSIGHT: Swap groups with multiple goals require ALLOCATION.
# Each item's group contribution is assigned to ONE goal within that group.
# The scoring function must handle this.
#
# For groups with a single goal (MC, Weapons, Recovery), it's simple summing.
# For groups with multiple goals (Lores x2), each item's lore points go to one goal.
#
# Greedy approach: when picking an item, assign its group contribution to
# whichever goal in that group has the largest remaining gap.

# Goals: note Lores has TWO separate goals
GOALS = {
    "MC":        {"group": "MC",       "target": 50, "current": 16},
    "Weapons":   {"group": "Weapons",  "target": 50, "current": 25},
    "Recovery":  {"group": "Recovery", "target": 50, "current": 28},
    "Lore-Religion":  {"group": "Lores", "target": 50, "current": 3},  # the existing 3 goes here
    "Lore-Blessings": {"group": "Lores", "target": 50, "current": 0},
}

def compute_gaps(goals):
    return {g: max(0, info["target"] - info["current"]) for g, info in goals.items()}

def score_item(enhancives, gaps):
    """Score item, allocating group contributions to the goal with the largest gap."""
    # First, sum contributions by group
    group_contribs = {}
    for enh in enhancives:
        group = get_group(enh["ability"])
        if group:
            effective = enh["boost"] // 2 if enh["ability"] == "Health Recovery" else enh["boost"]
            group_contribs[group] = group_contribs.get(group, 0) + effective
    
    # Now allocate each group's contribution to goals
    allocated = {}
    for group, contrib in group_contribs.items():
        # Find all goals in this group that still have gaps
        group_goals = [(g, gaps[g]) for g in gaps if GOALS[g]["group"] == group and gaps[g] > 0]
        if not group_goals:
            continue
        
        # For single-goal groups: simple
        if len(group_goals) == 1:
            g, gap = group_goals[0]
            allocated[g] = min(contrib, gap)
        else:
            # Multi-goal group (e.g., Lores x2): assign ALL to the largest gap
            # This is greedy — assign the whole item's lore to one goal
            group_goals.sort(key=lambda x: -x[1])  # largest gap first
            g, gap = group_goals[0]
            allocated[g] = min(contrib, gap)
    
    score = sum(allocated.values())
    return score, allocated

NUGGET_SLOTS = {"nugget", "shoulders", "chest", "hands", "feet_on", "waist"}
NUGGET_COST = 25_000_000
BLOODSTONE_NAMES = {"an oval bloodstone pendant", "an oval bloodstone ring", "an oval bloodstone barrette",
                    "an oval bloodstone bracelet", "an oval bloodstone earring"}

OPEN_SLOTS = {
    "neck": 1, "head": 1, "pin": 2, "wrist": 1, "single_ear": 2,
    "fingers": 1, "ankle": 1, "back": 1, "belt": 1, "both_ears": 1,
    "chest_slipped": 1, "feet_slipped": 1, "legs_pulled": 1,
    "legs_slipped": 1, "shoulder_slung": 1,
}

data = json.load(open("/home/rpgfilms/enhancive-alert/shop_items.json"))
candidates = []
for item in data["items"]:
    if not item.get("available"): continue
    if item.get("shop", "").lower() == "yakushi": continue
    if item["name"] in BLOODSTONE_NAMES: continue
    enh_raw = item.get("enhancives_json", "[]")
    enhancives = json.loads(enh_raw) if isinstance(enh_raw, str) else enh_raw
    if not enhancives: continue
    candidates.append({
        "id": item["id"], "name": item["name"], "town": item["town"],
        "shop": item["shop"], "cost": item["cost"],
        "slot": item.get("worn") or "nugget", "enhancives": enhancives,
    })

def needs_nugget(slot):
    return slot in NUGGET_SLOTS

def true_cost(item):
    return item["cost"] + (NUGGET_COST if needs_nugget(item["slot"]) else 0)

gaps = compute_gaps(GOALS)
slot_remaining = dict(OPEN_SLOTS)
total_open = sum(slot_remaining.values())
nugget_slots_used = 0
used = set()
total_cost = 0
picks = []

print("=" * 90)
print("STRATEGY 5 v5: CORRECTED LORE GOALS (Religion + Blessings = 2 separate goals)")
print(f"Starting gaps: {gaps}")
print(f"Total gap: {sum(gaps.values())} | Total open slots: {total_open}")
print("=" * 90)

for r in range(total_open):
    best = None
    best_val = 0
    for c in candidates:
        if c["id"] in used: continue
        slot = c["slot"]
        if needs_nugget(slot):
            avail = sum(slot_remaining.values()) - nugget_slots_used
            if avail <= 0: continue
        else:
            if slot_remaining.get(slot, 0) <= 0: continue
        
        s, bd = score_item(c["enhancives"], gaps)
        if s < 2: continue
        weighted = sum(v / gaps[g] for g, v in bd.items() if gaps[g] > 0)
        ic = true_cost(c)
        val = weighted / math.log10(max(ic, 1000))
        if val > best_val:
            best = c; best_val = val
    
    if not best: break

    used.add(best["id"])
    ic = true_cost(best)
    total_cost += ic
    _, bd = score_item(best["enhancives"], gaps)
    sc = sum(bd.values())
    for g, v in bd.items():
        gaps[g] = max(0, gaps[g] - v)
    
    slot = best["slot"]
    if needs_nugget(slot):
        nugget_slots_used += 1
        slot_note = f"nugget (was {slot})"
    else:
        slot_remaining[slot] -= 1
        slot_note = slot
    
    bd_s = ", ".join(f"{g}:+{v}" for g, v in bd.items())
    nug = " (+25M nug)" if needs_nugget(slot) else ""
    slots_left = sum(slot_remaining.values()) - nugget_slots_used
    print(f"\n  #{r+1} [{sc}] {best['name']}")
    print(f"     {best['town']}/{best['shop']} | {best['cost']:,}{nug} = {ic:,} | Slot: {slot_note}")
    print(f"     Fill: {bd_s}")
    print(f"     Gaps: {gaps} | Slots left: {slots_left}")
    if all(v == 0 for v in gaps.values()):
        print("\n  *** ALL GAPS FILLED ***"); break

og = sum(compute_gaps(GOALS).values())
uf = sum(gaps.values())
slots_left = sum(slot_remaining.values()) - nugget_slots_used
print(f"\nSummary: {len(picks) or r+1} items | {total_cost:,} silver | {(og-uf)/og*100:.0f}% filled | Gaps: {gaps} | Slots left: {slots_left}")
