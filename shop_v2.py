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

# Replaceable items: contribute only to over-cap goals or nothing
# Replacing these has ZERO negative impact on any goal
REPLACEABLE_ITEMS = [
    {"name": "enruned pink topaz bracer", "slot": "wrist", "loses": "Wisdom+4 (over cap)"},
    {"name": "jade-inlaid pink dreamstone pin", "slot": "pin", "loses": "Wisdom+5 (over cap)"},
    {"name": "flame-cut white starstone earcuff", "slot": "single_ear", "loses": "Wisdom+4 (over cap)"},
    {"name": "round-cut firestone earring", "slot": "single_ear", "loses": "nothing (no enhancives)"},
]

OPEN_SLOTS = ["ankle", "back", "belt", "both_ears", "chest_slipped", "feet_slipped",
              "fingers", "legs_pulled", "legs_slipped", "neck", "pin", "shoulder_slung"]

total_slots = len(OPEN_SLOTS) + len(REPLACEABLE_ITEMS)

gaps = {"MC": 34, "Weapons": 25, "Recovery": 22, "Lores": 47}
NUGGET_COST = 25_000_000

data = json.load(open("/home/rpgfilms/enhancive-alert/shop_items.json"))
candidates = []
for item in data["items"]:
    if not item.get("available"):
        continue
    if item.get("shop", "").lower() == "yakushi":
        continue
    enh_raw = item.get("enhancives_json", "[]")
    enhancives = json.loads(enh_raw) if isinstance(enh_raw, str) else enh_raw
    if not enhancives:
        continue
    candidates.append({
        "id": item["id"],
        "name": item["name"],
        "town": item["town"],
        "shop": item["shop"],
        "cost": item["cost"],
        "slot": item.get("worn") or "nugget",
        "enhancives": enhancives,
    })

# === STRATEGY A: MAX SCORE ===
print("=" * 90)
print(f"STRATEGY A — MAX SCORE (no Yakushi, {total_slots} slots: {len(OPEN_SLOTS)} open + {len(REPLACEABLE_ITEMS)} replaceable)")
print(f"Starting gaps: {gaps}")
print("=" * 90)

remaining = dict(gaps)
used = set()
total_cost = 0
picks = []

for r in range(total_slots):
    best = None
    best_score = 0
    best_bd = {}
    for c in candidates:
        if c["id"] in used:
            continue
        s, bd = score_item(c["enhancives"], remaining)
        if s > best_score or (s == best_score and best and c["cost"] < best["cost"]):
            best = c; best_score = s; best_bd = bd
    if not best or best_score == 0:
        break
    used.add(best["id"])
    ic = best["cost"] + (NUGGET_COST if best["slot"] == "nugget" else 0)
    total_cost += ic
    for g, v in best_bd.items():
        remaining[g] = max(0, remaining[g] - v)
    picks.append({**best, "score": best_score, "bd": best_bd, "ic": ic})
    bd_s = ", ".join(f"{g}:+{v}" for g, v in best_bd.items())
    nug = " (+25M nugget)" if best["slot"] == "nugget" else ""
    print(f"\n  #{r+1} [{best_score}] {best['name']}")
    print(f"     {best['town']}/{best['shop']} | {best['cost']:,}{nug} = {ic:,} | {bd_s}")
    print(f"     Gaps: {remaining}")
    if all(v == 0 for v in remaining.values()):
        print("\n  *** ALL GAPS FILLED ***"); break

print(f"\nSummary: {len(picks)} items, {total_cost:,} silver, gaps: {remaining}")
uf = sum(remaining.values()); og = sum(gaps.values())
print(f"Filled: {og-uf}/{og} ({(og-uf)/og*100:.0f}%)")

# === STRATEGY B: BUDGET EFFICIENT ===
print()
print("=" * 90)
print(f"STRATEGY B — BUDGET EFFICIENT (no Yakushi, {total_slots} slots)")
print(f"Starting gaps: {gaps}")
print("=" * 90)

remaining = dict(gaps)
used = set()
total_cost = 0
picks = []

for r in range(total_slots):
    best = None
    best_eff = 0
    best_score = 0
    best_bd = {}
    for c in candidates:
        if c["id"] in used:
            continue
        s, bd = score_item(c["enhancives"], remaining)
        if s < 3:
            continue
        ic = c["cost"] + (NUGGET_COST if c["slot"] == "nugget" else 0)
        eff = s / (ic / 1_000_000)
        if eff > best_eff or (eff == best_eff and s > best_score):
            best = c; best_eff = eff; best_score = s; best_bd = bd
    if not best:
        break
    used.add(best["id"])
    ic = best["cost"] + (NUGGET_COST if best["slot"] == "nugget" else 0)
    total_cost += ic
    for g, v in best_bd.items():
        remaining[g] = max(0, remaining[g] - v)
    picks.append({**best, "score": best_score, "bd": best_bd, "ic": ic, "eff": best_eff})
    bd_s = ", ".join(f"{g}:+{v}" for g, v in best_bd.items())
    nug = " (+25M nugget)" if best["slot"] == "nugget" else ""
    print(f"\n  #{r+1} [{best_score}, {best_eff:.1f}/M] {best['name']}")
    print(f"     {best['town']}/{best['shop']} | {best['cost']:,}{nug} = {ic:,} | {bd_s}")
    print(f"     Gaps: {remaining}")
    if all(v == 0 for v in remaining.values()):
        print("\n  *** ALL GAPS FILLED ***"); break

print(f"\nSummary: {len(picks)} items, {total_cost:,} silver, gaps: {remaining}")
uf = sum(remaining.values()); og = sum(gaps.values())
print(f"Filled: {og-uf}/{og} ({(og-uf)/og*100:.0f}%)")
