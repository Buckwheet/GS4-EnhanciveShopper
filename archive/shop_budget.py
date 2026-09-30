import json

# ============================================================
# BUDGET-AWARE GREEDY SHOPPING
# 
# Engine note: Instead of pure score, rank by EFFICIENCY:
#   efficiency = useful_score / total_cost_in_millions
# This finds the best bang-for-buck path.
# 
# Also: after the efficient path, show what's left and
# what the cheapest way to close remaining gaps would be.
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

gaps = {"MC": 34, "Weapons": 25, "Recovery": 22, "Lores": 47}
NUGGET_COST = 25_000_000

data = json.load(open("/home/rpgfilms/enhancive-alert/shop_items.json"))
candidates = []
for item in data["items"]:
    if not item.get("available"):
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

shopping_list = []
remaining_gaps = dict(gaps)
used_ids = set()
total_cost = 0

print("=" * 90)
print("BUDGET-EFFICIENT GAP-FILL SHOPPING LIST")
print(f"Starting gaps: {remaining_gaps}")
print("=" * 90)

for round_num in range(12):
    best = None
    best_eff = 0
    best_score = 0
    best_breakdown = {}
    
    for c in candidates:
        if c["id"] in used_ids:
            continue
        score, breakdown = score_item(c["enhancives"], remaining_gaps)
        if score == 0:
            continue
        item_cost = c["cost"] + (NUGGET_COST if c["slot"] == "nugget" else 0)
        eff = score / (item_cost / 1_000_000)
        # Prefer efficiency, but require minimum score of 3 to avoid buying junk
        if score >= 3 and (eff > best_eff or (eff == best_eff and score > best_score)):
            best = c
            best_eff = eff
            best_score = score
            best_breakdown = breakdown
    
    if best is None:
        break
    
    used_ids.add(best["id"])
    item_cost = best["cost"] + (NUGGET_COST if best["slot"] == "nugget" else 0)
    total_cost += item_cost
    
    for group, contrib in best_breakdown.items():
        remaining_gaps[group] = max(0, remaining_gaps[group] - contrib)
    
    shopping_list.append({**best, "score": best_score, "breakdown": best_breakdown, 
                          "total_cost": item_cost, "efficiency": best_eff})
    
    bd = ", ".join(f"{g}:+{v}" for g, v in best_breakdown.items())
    nugget_note = " (+25M nugget)" if best["slot"] == "nugget" else ""
    print(f"\n  Pick #{round_num+1}: {best['name']}")
    print(f"    {best['town']} / {best['shop']} | Cost: {best['cost']:,}{nugget_note} = {item_cost:,}")
    print(f"    Score: {best_score} | Eff: {best_eff:.1f}/M | Gap fill: {bd}")
    print(f"    Remaining gaps: {remaining_gaps}")
    
    if all(v == 0 for v in remaining_gaps.values()):
        print("\n  *** ALL GAPS FILLED ***")
        break

print()
print("=" * 90)
print("BUDGET SHOPPING LIST SUMMARY")
print("=" * 90)
print(f"  Items: {len(shopping_list)}")
print(f"  Total cost: {total_cost:,} silver")
print(f"  Remaining gaps: {remaining_gaps}")
unfilled = sum(remaining_gaps.values())
original = sum(gaps.values())
print(f"  Gap filled: {original - unfilled}/{original} ({(original-unfilled)/original*100:.0f}%)")
print()
for i, item in enumerate(shopping_list):
    bd = ", ".join(f"{g}:+{v}" for g, v in item["breakdown"].items())
    print(f"  {i+1}. {item['name']} - {item['total_cost']:,} - eff:{item['efficiency']:.1f}/M - {bd}")
