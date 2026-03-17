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

def normalize(a):
    for s in [" Bonus", " Ranks", " Base"]: a = a.replace(s, "")
    return a.strip()

def get_group(ability):
    a = normalize(ability)
    for name, group in SWAP_GROUPS.items():
        if a in group: return name
    return None

GOALS = {
    "MC":        {"group": "MC",       "target": 50, "current": 16},
    "Weapons":   {"group": "Weapons",  "target": 50, "current": 25},
    "Recovery":  {"group": "Recovery", "target": 50, "current": 28},
    "Lore-Rel":  {"group": "Lores",    "target": 50, "current": 3},
    "Lore-Ble":  {"group": "Lores",    "target": 50, "current": 0},
}

def compute_gaps():
    return {g: max(0, i["target"] - i["current"]) for g, i in GOALS.items()}

def score_item(enhancives, gaps):
    group_contribs = {}
    for enh in enhancives:
        group = get_group(enh["ability"])
        if group:
            eff = enh["boost"] // 2 if enh["ability"] == "Health Recovery" else enh["boost"]
            group_contribs[group] = group_contribs.get(group, 0) + eff
    allocated = {}
    for group, contrib in group_contribs.items():
        group_goals = [(g, gaps[g]) for g in gaps if GOALS[g]["group"] == group and gaps[g] > 0]
        if not group_goals: continue
        if len(group_goals) == 1:
            g, gap = group_goals[0]
            allocated[g] = min(contrib, gap)
        else:
            group_goals.sort(key=lambda x: -x[1])
            g, gap = group_goals[0]
            allocated[g] = min(contrib, gap)
    return sum(allocated.values()), allocated

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
ALL = []
for item in data["items"]:
    if not item.get("available"): continue
    if item.get("shop", "").lower() == "yakushi": continue
    if item["name"] in BLOODSTONE_NAMES: continue
    enh_raw = item.get("enhancives_json", "[]")
    enhancives = json.loads(enh_raw) if isinstance(enh_raw, str) else enh_raw
    if not enhancives: continue
    ALL.append({
        "id": item["id"], "name": item["name"], "town": item["town"],
        "shop": item["shop"], "cost": item["cost"],
        "slot": item.get("worn") or "nugget", "enhancives": enhancives,
    })

def true_cost(item):
    return item["cost"] + (NUGGET_COST if item["slot"] in NUGGET_SLOTS else 0)

def run(log_base, stop_pct=1.0):
    gaps = compute_gaps()
    og = sum(gaps.values())
    slot_rem = dict(OPEN_SLOTS)
    nug_used = 0
    used = set()
    total_cost = 0
    picks = []
    
    for r in range(sum(slot_rem.values())):
        # Check stop threshold
        filled_pct = (og - sum(gaps.values())) / og
        if filled_pct >= stop_pct:
            break
        
        best = None
        best_val = 0
        for c in ALL:
            if c["id"] in used: continue
            slot = c["slot"]
            if slot in NUGGET_SLOTS:
                if sum(slot_rem.values()) - nug_used <= 0: continue
            else:
                if slot_rem.get(slot, 0) <= 0: continue
            s, bd = score_item(c["enhancives"], gaps)
            if s < 2: continue
            weighted = sum(v / gaps[g] for g, v in bd.items() if gaps[g] > 0)
            ic = true_cost(c)
            val = weighted / (math.log(max(ic, 1000)) / math.log(log_base))
            if val > best_val:
                best = c; best_val = val
        
        if not best: break
        used.add(best["id"])
        ic = true_cost(best)
        total_cost += ic
        _, bd = score_item(best["enhancives"], gaps)
        for g, v in bd.items():
            gaps[g] = max(0, gaps[g] - v)
        slot = best["slot"]
        if slot in NUGGET_SLOTS:
            nug_used += 1
            sn = f"nug({slot[:3]})"
        else:
            slot_rem[slot] -= 1
            sn = slot
        picks.append({"name": best["name"], "ic": ic, "bd": bd, "sn": sn, "score": sum(bd.values())})
        if all(v == 0 for v in gaps.values()): break
    
    uf = sum(gaps.values())
    pct = (og - uf) / og * 100
    sl = sum(slot_rem.values()) - nug_used
    return picks, total_cost, gaps, pct, sl

# First show how log base affects the penalty on different price points
print("=" * 90)
print("LOG BASE COMPARISON — PENALTY VALUES AT DIFFERENT PRICE POINTS")
print("=" * 90)
print(f"  {'Price':>15} | {'log8':>8} | {'log10':>8} | {'log12':>8} | {'log8 vs log10':>14} | {'log12 vs log10':>14}")
print(f"  {'-'*15}-+-{'-'*8}-+-{'-'*8}-+-{'-'*8}-+-{'-'*14}-+-{'-'*14}")
for price in [50_000, 250_000, 1_000_000, 5_000_000, 25_000_000, 50_000_000, 100_000_000, 500_000_000]:
    l8 = math.log(price) / math.log(8)
    l10 = math.log10(price)
    l12 = math.log(price) / math.log(12)
    print(f"  {price:>15,} | {l8:>8.2f} | {l10:>8.2f} | {l12:>8.2f} | {l8/l10:>13.2f}x | {l12/l10:>13.2f}x")

# Run all three
for base, label in [(8, "LOG8 (cash flush — weaker cost penalty)"), 
                     (10, "LOG10 (balanced — default)"),
                     (12, "LOG12 (cash adverse — stronger cost penalty)")]:
    picks, cost, gaps, pct, sl = run(base)
    nugs = sum(1 for p in picks if "nug" in p["sn"])
    print(f"\n{'='*90}")
    print(f"  {label}")
    print(f"  {len(picks)} items | {cost:,} silver | {pct:.0f}% filled | {sl} slots left | {nugs} nuggets")
    print(f"{'='*90}")
    for i, p in enumerate(picks):
        bd_s = ", ".join(f"{g}:+{v}" for g, v in p["bd"].items())
        print(f"  {i+1:2}. [{p['score']:2}] {p['name'][:50]:<50} {p['ic']:>12,} {p['sn']:<10} {bd_s}")
    print(f"\n  Total: {cost:,} | Gaps: {gaps}")

# Also run log10 with 95% stop
picks, cost, gaps, pct, sl = run(10, stop_pct=0.95)
nugs = sum(1 for p in picks if "nug" in p["sn"])
print(f"\n{'='*90}")
print(f"  LOG10 + 95% STOP THRESHOLD")
print(f"  {len(picks)} items | {cost:,} silver | {pct:.0f}% filled | {sl} slots left | {nugs} nuggets")
print(f"{'='*90}")
for i, p in enumerate(picks):
    bd_s = ", ".join(f"{g}:+{v}" for g, v in p["bd"].items())
    print(f"  {i+1:2}. [{p['score']:2}] {p['name'][:50]:<50} {p['ic']:>12,} {p['sn']:<10} {bd_s}")
print(f"\n  Total: {cost:,} | Gaps: {gaps}")
