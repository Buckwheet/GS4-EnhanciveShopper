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

# Slot availability for Mejora's hunting set
# These are the OPEN slots with their remaining capacity
SLOT_CAPACITY = {
    "ankle": 1, "back": 1, "belt": 1, "both_ears": 1,
    "chest_slipped": 1, "feet_slipped": 1, "fingers": 1,
    "legs_pulled": 1, "legs_slipped": 1, "neck": 1,
    "pin": 1, "shoulder_slung": 1,
    # Free replacements (over-cap Wisdom items + empty earring)
    "wrist": 1, "single_ear": 2,  # topaz bracer + earcuff + empty earring
    # pin already has 1 open above; dreamstone pin is replaceable = +1 more
}
# Actually let me just track total open slots = 16 and use nugget for anything
# that doesn't fit a wearable slot

# Slots that become nuggets for a caster:
# - nugget (weapons/runestaffs already)
# - shoulders (shields, bows, crossbows — held items)
# - chest (armor slot, locked for Mejora)
# - hands (locked), feet_on (locked), waist (locked), etc.
NUGGET_SLOTS = {"nugget", "shoulders", "chest", "hands", "feet_on", "waist"}

# Slot limits: how many of each wearable slot Mejora has OPEN
# (including free replacements)
OPEN_SLOTS = {
    "neck": 1,
    "head": 1,       # crown is replaceable (over-cap Wisdom)
    "pin": 2,        # 1 open + dreamstone pin replaceable
    "wrist": 1,      # topaz bracer replaceable
    "single_ear": 2, # earcuff replaceable + empty earring
    "fingers": 1,    # 1 open
    "ankle": 1,
    "back": 1,
    "belt": 1,
    "both_ears": 1,
    "chest_slipped": 1,
    "feet_slipped": 1,
    "legs_pulled": 1,
    "legs_slipped": 1,
    "shoulder_slung": 1,
    "arms": 0,       # occupied, not free
    "legs_attached": 0,  # occupied, not free
    "front": 0,      # apron, not free (Logic at cap)
    "hair": 0,       # barrette, not free
    "elsewhere": 0,  # tattoo, not free
    "locus": 0,      # both occupied, not free
}

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

def needs_nugget(slot):
    return slot in NUGGET_SLOTS

def true_cost(item):
    return item["cost"] + (NUGGET_COST if needs_nugget(item["slot"]) else 0)

def can_equip(item, slot_remaining):
    """Check if item can be equipped in its native slot, or needs nugget."""
    slot = item["slot"]
    if needs_nugget(slot):
        return True  # always can nugget (goes into any open slot)
    return slot_remaining.get(slot, 0) > 0

def consume_slot(item, slot_remaining):
    """Consume a slot. Nugget items consume from the general pool."""
    slot = item["slot"]
    if needs_nugget(slot):
        # Nugget goes into any open slot — consume the one with most availability
        # For simplicity, consume from a general "nugget_slots_used" counter
        return True
    if slot_remaining.get(slot, 0) > 0:
        slot_remaining[slot] -= 1
        return True
    return False

remaining = dict(GAPS)
slot_remaining = dict(OPEN_SLOTS)
total_open = sum(v for v in slot_remaining.values())
nugget_slots_used = 0
used = set()
total_cost = 0
picks = []

print("=" * 90)
print("STRATEGY 5 v4: BALANCED + LOG10 COST + SLOT AWARENESS")
print("Shields/ranged/chest/armor = nuggets. Slot limits enforced per type.")
print(f"Starting gaps: {remaining}")
print(f"Total open slots: {total_open}")
print("=" * 90)

for r in range(total_open):
    best = None
    best_val = 0
    for c in candidates:
        if c["id"] in used: continue
        
        # Check slot availability
        slot = c["slot"]
        if needs_nugget(slot):
            # Nugget items need an open slot somewhere
            available_general = sum(v for v in slot_remaining.values()) - nugget_slots_used
            if available_general <= 0: continue
        else:
            if slot_remaining.get(slot, 0) <= 0: continue
        
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
    
    slot = best["slot"]
    if needs_nugget(slot):
        nugget_slots_used += 1
        slot_note = f"nugget (was {slot})"
    else:
        slot_remaining[slot] -= 1
        slot_note = slot
    
    picks.append({"item": best, "score": sc, "bd": bd, "ic": ic, "slot_note": slot_note})

    bd_s = ", ".join(f"{g}:+{v}" for g, v in bd.items())
    nug = " (+25M nug)" if needs_nugget(slot) else ""
    slots_left = sum(v for v in slot_remaining.values()) - nugget_slots_used
    print(f"\n  #{r+1} [{sc}] {best['name']}")
    print(f"     {best['town']}/{best['shop']} | {best['cost']:,}{nug} = {ic:,} | Slot: {slot_note}")
    print(f"     Fill: {bd_s}")
    print(f"     Gaps: {remaining} | Slots left: {slots_left}")
    if all(v == 0 for v in remaining.values()):
        print("\n  *** ALL GAPS FILLED ***"); break

uf = sum(remaining.values()); og = sum(GAPS.values())
slots_left = sum(v for v in slot_remaining.values()) - nugget_slots_used
print(f"\nSummary: {len(picks)} items | {total_cost:,} silver | {(og-uf)/og*100:.0f}% filled | Slots left: {slots_left}")
