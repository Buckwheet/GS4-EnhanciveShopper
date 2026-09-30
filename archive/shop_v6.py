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

# Slots that need nugget for a caster (held/armor items)
NUGGET_SLOTS = {"nugget", "shoulders", "chest", "hands", "feet_on", "waist"}
NUGGET_COST = 25_000_000
SWATCH_COST = 25_000_000  # converts item to different slot type
PELL_COST = 10_000_000    # makes non-permanent item permanent

BLOODSTONE_NAMES = {"an oval bloodstone pendant", "an oval bloodstone ring", "an oval bloodstone barrette",
                    "an oval bloodstone bracelet", "an oval bloodstone earring"}
OPEN_SLOTS = {
    "neck": 1, "head": 1, "pin": 2, "wrist": 1, "single_ear": 2,
    "fingers": 1, "ankle": 1, "back": 1, "belt": 1, "both_ears": 1,
    "chest_slipped": 1, "feet_slipped": 1, "legs_pulled": 1,
    "legs_slipped": 1, "shoulder_slung": 1,
}

# Map shop slot names to our slot names
SLOT_MAP = {"finger": "fingers", "ear": "single_ear"}

data = json.load(open("/home/rpgfilms/enhancive-alert/shop_items.json"))
ALL = []
for item in data["items"]:
    if not item.get("available"): continue
    if item.get("shop", "").lower() == "yakushi": continue
    if item["name"] in BLOODSTONE_NAMES: continue
    enh_raw = item.get("enhancives_json", "[]")
    enhancives = json.loads(enh_raw) if isinstance(enh_raw, str) else enh_raw
    if not enhancives: continue
    raw_slot = item.get("worn") or "nugget"
    slot = SLOT_MAP.get(raw_slot, raw_slot)
    ALL.append({
        "id": item["id"], "name": item["name"], "town": item["town"],
        "shop": item["shop"], "cost": item["cost"],
        "slot": slot, "enhancives": enhancives,
        "is_permanent": bool(item.get("is_permanent")),
    })

def true_cost(item):
    """
    Total cost to equip an item:
    - Base item cost
    - +25M nugget if it's a held/armor item (caster can't use in-hand)
      Nugget also makes it permanent, so no pell needed
    - +10M pell if it's a wearable but NOT permanent
    - Swatch not modeled yet (would be +25M to change slot type)
    """
    cost = item["cost"]
    if item["slot"] in NUGGET_SLOTS:
        cost += NUGGET_COST  # nugget includes permanence
    elif not item["is_permanent"]:
        cost += PELL_COST    # wearable but not permanent, needs pell
    return cost

def run(alpha, label):
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
            val = weighted / math.log10(max(ic, 1000))**alpha
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
        is_nug = slot in NUGGET_SLOTS
        if is_nug:
            nug_used += 1
        else:
            slot_rem[slot] -= 1

        # Cost breakdown
        base = best["cost"]
        extras = []
        if is_nug:
            extras.append("nug+25M")
        elif not best["is_permanent"]:
            extras.append("pell+10M")
        extra_str = f" ({', '.join(extras)})" if extras else " (perm)"
        
        bd_s = ", ".join(f"{g}:+{v}" for g, v in bd.items())
        sl = sum(slot_rem.values()) - nug_used
        picks.append({"name": best["name"], "ic": ic, "base": base, "bd": bd,
                       "slot": slot if not is_nug else "nugget", "extra": extra_str,
                       "score": sum(bd.values())})
        if all(v == 0 for v in gaps.values()): break

    uf = sum(gaps.values())
    pct = (og - uf) / og * 100
    sl = sum(slot_rem.values()) - nug_used
    nugs = sum(1 for p in picks if p["slot"] == "nugget")
    pells = sum(1 for p in picks if "pell" in p["extra"])
    
    print(f"\n{'='*100}")
    print(f"  {label}")
    print(f"  {len(picks)} items | {total_cost:,} silver | {pct:.0f}% filled | {sl} slots left | {nugs} nuggets | {pells} pells")
    print(f"{'='*100}")
    print(f"  {'#':>2}  {'Score':>5}  {'Item':<48} {'Base Cost':>12} {'Extras':<14} {'Total':>12}  {'Slot':<8}  Fill")
    print(f"  {'—'*2}  {'—'*5}  {'—'*48} {'—'*12} {'—'*14} {'—'*12}  {'—'*8}  {'—'*30}")
    for i, p in enumerate(picks):
        bd_s = ", ".join(f"{g}:+{v}" for g, v in p["bd"].items())
        print(f"  {i+1:2}  [{p['score']:>3}]  {p['name'][:48]:<48} {p['base']:>12,} {p['extra']:<14} {p['ic']:>12,}  {p['slot']:<8}  {bd_s}")
    print(f"\n  Total: {total_cost:,} | Gaps: {gaps}")

print("#" * 100)
print("# WITH PELL COST (+10M for non-permanent wearables) AND NUGGET PERMANENCE")
print("# Nugget = +25M (includes permanence). Pell = +10M (wearable non-perm only).")
print("#" * 100)

run(1.0, "log10^1.0 — Cash Flush")
run(1.5, "log10^1.5 — Balanced")
run(2.0, "log10^2.0 — Cash Adverse")
