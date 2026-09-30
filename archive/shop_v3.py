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

# Items that need nugget: weapons, runestaffs, shields, ranged weapons (bows/crossbows)
# For a caster like Mejora, these are all "held" items she won't use in-hand
NUGGET_SLOTS = {"nugget", "shoulders"}  # shields are shoulders, weapons are nugget already

GAPS = {"MC": 34, "Weapons": 25, "Recovery": 22, "Lores": 47}
NUGGET_COST = 25_000_000
BLOODSTONE_NAMES = {"an oval bloodstone pendant", "an oval bloodstone ring", "an oval bloodstone barrette",
                    "an oval bloodstone bracelet", "an oval bloodstone earring"}

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

def true_cost(item):
    return item["cost"] + (NUGGET_COST if item["slot"] in NUGGET_SLOTS else 0)

remaining = dict(GAPS)
used = set()
total_cost = 0
picks = []

print("=" * 90)
print("STRATEGY 5 RE-RUN: BALANCED + COST PENALTY (log10)")
print("Shields & ranged weapons now treated as nuggets (+25M)")
print(f"Starting gaps: {remaining}")
print("=" * 90)

for r in range(16):
    best = None
    best_val = 0
    for c in candidates:
        if c["id"] in used: continue
        s, bd = score_item(c["enhancives"], remaining)
        if s < 2: continue
        weighted = sum(v / remaining[g] for g, v in bd.items() if remaining[g] > 0)
        ic = true_cost(c)
        val = weighted / math.log10(max(ic, 1000))
        if val > best_val:
            best = c; best_val = val
    if not best: break

    used.add(best["id"])
    ic = true_cost(best)
    total_cost += ic
    _, bd = score_item(best["enhancives"], remaining)
    sc = sum(bd.values())
    for g, v in bd.items():
        remaining[g] = max(0, remaining[g] - v)
    picks.append({"item": best, "score": sc, "bd": bd, "ic": ic})

    bd_s = ", ".join(f"{g}:+{v}" for g, v in bd.items())
    nug = " (+25M nug)" if best["slot"] in NUGGET_SLOTS else ""
    print(f"\n  #{r+1} [{sc}] {best['name']}")
    print(f"     {best['town']}/{best['shop']} | {best['cost']:,}{nug} = {ic:,} | Slot: {best['slot']}")
    print(f"     Fill: {bd_s}")
    print(f"     Gaps: {remaining}")
    if all(v == 0 for v in remaining.values()):
        print("\n  *** ALL GAPS FILLED ***"); break

uf = sum(remaining.values()); og = sum(GAPS.values())
print(f"\nSummary: {len(picks)} items | {total_cost:,} silver | {(og-uf)/og*100:.0f}% filled | Gaps: {remaining}")
