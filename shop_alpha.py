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
    "MC":       {"group": "MC",       "target": 50, "current": 16},
    "Weapons":  {"group": "Weapons",  "target": 50, "current": 25},
    "Recovery": {"group": "Recovery", "target": 50, "current": 28},
    "Lore-Rel": {"group": "Lores",    "target": 50, "current": 3},
    "Lore-Ble": {"group": "Lores",    "target": 50, "current": 0},
}

def compute_gaps():
    return {g: max(0, i["target"] - i["current"]) for g, i in GOALS.items()}

def score_item(enhancives, gaps):
    gc = {}
    for enh in enhancives:
        group = get_group(enh["ability"])
        if group:
            eff = enh["boost"] // 2 if enh["ability"] == "Health Recovery" else enh["boost"]
            gc[group] = gc.get(group, 0) + eff
    alloc = {}
    for group, contrib in gc.items():
        gg = [(g, gaps[g]) for g in gaps if GOALS[g]["group"] == group and gaps[g] > 0]
        if not gg: continue
        if len(gg) == 1:
            alloc[gg[0][0]] = min(contrib, gg[0][1])
        else:
            gg.sort(key=lambda x: -x[1])
            alloc[gg[0][0]] = min(contrib, gg[0][1])
    return sum(alloc.values()), alloc

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

def run(penalty_fn, label):
    gaps = compute_gaps()
    og = sum(gaps.values())
    slot_rem = dict(OPEN_SLOTS)
    nug_used = 0
    used = set()
    total_cost = 0
    picks = []

    for r in range(sum(slot_rem.values())):
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
            val = weighted / penalty_fn(ic)
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
            sn = f"nug"
        else:
            slot_rem[slot] -= 1
            sn = slot
        picks.append({"name": best["name"], "ic": ic, "bd": bd, "sn": sn, "score": sum(bd.values())})
        if all(v == 0 for v in gaps.values()): break

    uf = sum(gaps.values())
    pct = (og - uf) / og * 100
    sl = sum(slot_rem.values()) - nug_used
    nugs = sum(1 for p in picks if p["sn"] == "nug")
    
    print(f"\n{'='*90}")
    print(f"  {label}")
    print(f"  {len(picks)} items | {total_cost:,} silver | {pct:.0f}% filled | {sl} slots left | {nugs} nuggets")
    print(f"{'='*90}")
    for i, p in enumerate(picks):
        bd_s = ", ".join(f"{g}:+{v}" for g, v in p["bd"].items())
        print(f"  {i+1:2}. [{p['score']:2}] {p['name'][:48]:<48} {p['ic']:>12,} {p['sn']:<6} {bd_s}")
    print(f"\n  Total: {total_cost:,} | Gaps: {gaps}")

# ============================================================
# PENALTY TABLE
# ============================================================
print("=" * 90)
print("PENALTY VALUES AT DIFFERENT PRICE POINTS")
print("=" * 90)
prices = [50_000, 1_000_000, 5_000_000, 25_000_000, 85_000_000, 500_000_000]
header = f"  {'Price':>12} |"
for label in ["cost^0.3", "cost^0.5", "cost^0.7", "log^1.0", "log^1.5", "log^2.0"]:
    header += f" {label:>9} |"
print(header)
print("  " + "-" * (len(header) - 2))
for p in prices:
    l = math.log10(max(p, 1000))
    row = f"  {p:>12,} |"
    row += f" {p**0.3:>9.1f} |"
    row += f" {p**0.5:>9.0f} |"
    row += f" {p**0.7:>9.0f} |"
    row += f" {l**1.0:>9.2f} |"
    row += f" {l**1.5:>9.2f} |"
    row += f" {l**2.0:>9.2f} |"
    print(row)

# Show ratio between cheapest and most expensive
print(f"\n  Ratio 500M/50K:")
for label, fn in [("cost^0.3", lambda p: p**0.3), ("cost^0.5", lambda p: p**0.5), ("cost^0.7", lambda p: p**0.7),
                   ("log^1.0", lambda p: math.log10(max(p,1000))**1.0), 
                   ("log^1.5", lambda p: math.log10(max(p,1000))**1.5),
                   ("log^2.0", lambda p: math.log10(max(p,1000))**2.0)]:
    ratio = fn(500_000_000) / fn(50_000)
    print(f"    {label}: {ratio:.1f}x")

# ============================================================
# OPTION 1: cost^alpha (no log)
# ============================================================
print("\n" + "#" * 90)
print("# OPTION 1: proportional_fill / cost^alpha")
print("#" * 90)

run(lambda ic: max(ic, 1000)**0.3, "cost^0.3 (cash flush)")
run(lambda ic: max(ic, 1000)**0.5, "cost^0.5 (balanced)")
run(lambda ic: max(ic, 1000)**0.7, "cost^0.7 (cash adverse)")

# ============================================================
# OPTION 2: log10(cost)^alpha
# ============================================================
print("\n" + "#" * 90)
print("# OPTION 2: proportional_fill / log10(cost)^alpha")
print("#" * 90)

run(lambda ic: math.log10(max(ic, 1000))**1.0, "log10^1.0 (cash flush — same as before)")
run(lambda ic: math.log10(max(ic, 1000))**1.5, "log10^1.5 (balanced)")
run(lambda ic: math.log10(max(ic, 1000))**2.0, "log10^2.0 (cash adverse)")
