import json

# ============================================================
# GREEDY GAP-FILL SHOPPING LIST BUILDER
# 
# Engine note: This is the "greedy heuristic" from the knapsack analysis.
# Algorithm:
#   1. Start with current gaps
#   2. Score all items against CURRENT gaps (not original gaps)
#   3. Pick best item, "buy" it, reduce gaps
#   4. Re-score remaining items against UPDATED gaps
#   5. Repeat until gaps filled or no useful items remain
#
# This handles the key insight: after buying a +22 MC item,
# the MC gap shrinks from 34 to 12, so the NEXT MC item is
# scored lower (capped at 12 useful, not its full value).
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
    """Score item against CURRENT gaps (not original)"""
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

# Current gaps
gaps = {"MC": 34, "Weapons": 25, "Recovery": 22, "Lores": 47}

# Load shop
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

# Greedy selection
shopping_list = []
remaining_gaps = dict(gaps)
used_ids = set()
total_cost = 0
NUGGET_COST = 25_000_000

print("=" * 90)
print("GREEDY GAP-FILL SHOPPING LIST")
print(f"Starting gaps: {remaining_gaps}")
print("=" * 90)

for round_num in range(12):  # max 12 items (open slots)
    # Re-score all candidates against current gaps
    best = None
    best_score = 0
    best_breakdown = {}
    
    for c in candidates:
        if c["id"] in used_ids:
            continue
        score, breakdown = score_item(c["enhancives"], remaining_gaps)
        if score > best_score or (score == best_score and best and c["cost"] < best["cost"]):
            best = c
            best_score = score
            best_breakdown = breakdown
    
    if best is None or best_score == 0:
        break
    
    # "Buy" this item
    used_ids.add(best["id"])
    item_cost = best["cost"]
    if best["slot"] == "nugget":
        item_cost += NUGGET_COST
    total_cost += item_cost
    
    # Update gaps
    for group, contrib in best_breakdown.items():
        remaining_gaps[group] = max(0, remaining_gaps[group] - contrib)
    
    shopping_list.append({**best, "score": best_score, "breakdown": best_breakdown, "total_cost": item_cost})
    
    bd = ", ".join(f"{g}:+{v}" for g, v in best_breakdown.items())
    nugget_note = " (+25M nugget)" if best["slot"] == "nugget" else ""
    print(f"\n  Pick #{round_num+1}: {best['name']}")
    print(f"    {best['town']} / {best['shop']} | Cost: {best['cost']:,}{nugget_note}")
    print(f"    Score: {best_score} | Gap fill: {bd}")
    print(f"    Remaining gaps: {remaining_gaps}")
    
    # Check if all gaps filled
    if all(v == 0 for v in remaining_gaps.values()):
        print("\n  *** ALL GAPS FILLED ***")
        break

print()
print("=" * 90)
print("SHOPPING LIST SUMMARY")
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
    print(f"  {i+1}. {item['name']} ({item['town']}/{item['shop']}) - {item['total_cost']:,} - {bd}")
