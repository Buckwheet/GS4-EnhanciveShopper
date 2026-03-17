import json

items = [
    {"name": "oval bloodstone barrette", "slot": "hair", "locked": False, "enh": [("Max Mana",50),("Max Health",100),("Max Stamina",25),("Mana Recovery",10),("Health Recovery",20),("Stamina Recovery",5)]},
    {"name": "black ora gauntlets", "slot": "hands", "locked": True, "enh": []},
    {"name": "scorched bronze stickpin", "slot": "pin", "locked": False, "enh": [("Aura",5),("Logic",5),("Max Mana",4),("Max Health",2)]},
    {"name": "lead-bound rat hide badge", "slot": "pin", "locked": False, "enh": [("Discipline",10)]},
    {"name": "delicate lily tattoo", "slot": "elsewhere", "locked": False, "enh": [("Discipline",8)]},
    {"name": "garnet-set ora bracer", "slot": "wrist", "locked": False, "enh": [("Discipline",6),("Spiritual Lore - Summoning",3)]},
    {"name": "chased platinum bracelet", "slot": "wrist", "locked": False, "enh": [("Discipline",6),("Elemental Mana Control",6)]},
    {"name": "ornate imflass arm greaves", "slot": "arms", "locked": False, "enh": [("Discipline",10),("Spirit Mana Control",10),("Mana Recovery",1)]},
    {"name": "enruned pink topaz bracer", "slot": "wrist", "locked": False, "enh": [("Wisdom",4)]},
    {"name": "rune-etched golden apron", "slot": "front", "locked": False, "enh": [("Logic",8),("Blunt Weapons",8)]},
    {"name": "round-cut firestone earring", "slot": "single_ear", "locked": False, "enh": []},
    {"name": "glaes pin", "slot": "pin", "locked": False, "enh": [("Logic",14),("Spell Aiming",4),("Max Health",22)]},
    {"name": "thick glaes leg greaves", "slot": "legs_attached", "locked": False, "enh": [("Spell Aiming",13)]},
    {"name": "flame-cut white starstone earcuff", "slot": "single_ear", "locked": False, "enh": [("Wisdom",4)]},
    {"name": "jade-inlaid white starstone crown", "slot": "head", "locked": False, "enh": [("Wisdom",6),("Arcane Symbols",2)]},
    {"name": "glyph-etched copper band", "slot": "fingers", "locked": False, "enh": [("Wisdom",4),("Arcane Symbols",2)]},
    {"name": "jade-inlaid pink dreamstone pin", "slot": "pin", "locked": False, "enh": [("Wisdom",5),("Physical Fitness",2)]},
    {"name": "gilded locus", "slot": "locus", "locked": False, "enh": [("Logic",6),("Wisdom",11),("Max Mana",8)]},
    {"name": "unknown locus", "slot": "locus", "locked": False, "enh": [("Logic",7),("Wisdom",6),("Mana Recovery",2)]},
]

# Swap groups
STAT_A = {"Strength", "Wisdom", "Aura"}
STAT_B = {"Constitution", "Dexterity", "Agility", "Discipline"}
STAT_C = {"Logic", "Intuition", "Influence"}
WEAPONS = {"Edged Weapons", "Blunt Weapons", "Ranged Weapons", "Thrown Weapons", "Polearm Weapons", "Two-Handed Weapons", "Brawling", "Spell Aiming"}
MC = {"Elemental Mana Control", "Spirit Mana Control", "Mental Mana Control"}
LORES = {"Elemental Lore - Air", "Elemental Lore - Earth", "Elemental Lore - Fire", "Elemental Lore - Water",
         "Spiritual Lore - Blessings", "Spiritual Lore - Religion", "Spiritual Lore - Summoning",
         "Sorcerous Lore - Demonology", "Sorcerous Lore - Necromancy",
         "Mental Lore - Manipulation", "Mental Lore - Telepathy", "Mental Lore - Transference", "Mental Lore - Transformation"}
RECOVERY = {"Mana Recovery", "Stamina Recovery", "Health Recovery"}
MIU_AS = {"Magic Item Use", "Arcane Symbols"}

def normalize(ability):
    a = ability
    for suffix in [" Bonus", " Ranks", " Base"]:
        a = a.replace(suffix, "")
    return a.strip()

def get_group(ability):
    a = normalize(ability)
    for name, group in [("Stat A", STAT_A), ("Stat B", STAT_B), ("Stat C", STAT_C),
                         ("Weapons", WEAPONS), ("MC", MC), ("Lores", LORES),
                         ("Recovery", RECOVERY), ("MIU/AS", MIU_AS)]:
        if a in group:
            return name
    return None

goals = {
    "Wisdom (Stat A)": {"group": "Stat A", "target": 40},
    "Discipline (Stat B)": {"group": "Stat B", "target": 40},
    "Logic (Stat C)": {"group": "Stat C", "target": 40},
    "Spirit MC (MC)": {"group": "MC", "target": 50},
    "Spell Aiming (Weapons)": {"group": "Weapons", "target": 50},
    "Mana Recovery (Recovery)": {"group": "Recovery", "target": 50},
    "Lores (Lores)": {"group": "Lores", "target": 50},
}

goal_totals = {g: 0 for g in goals}
item_contributions = {}

for item in items:
    contribs = {}
    for ability, boost in item["enh"]:
        grp = get_group(ability)
        if grp:
            for gname, ginfo in goals.items():
                if ginfo["group"] == grp:
                    effective = boost // 2 if ability == "Health Recovery" else boost
                    goal_totals[gname] += effective
                    contribs[gname] = contribs.get(gname, 0) + effective
    if contribs:
        item_contributions[item["name"]] = {"contribs": contribs, "slot": item["slot"], "locked": item["locked"]}

print("=" * 70)
print("MEJORA'S CURRENT GOAL STATUS")
print("=" * 70)
for gname, ginfo in goals.items():
    total = goal_totals[gname]
    target = ginfo["target"]
    gap = max(0, target - total)
    status = "CAPPED" if total >= target else f"NEED {gap}"
    over = f" (OVER by {total - target})" if total > target else ""
    print(f"  {gname}: {total}/{target} -- {status}{over}")

print()
print("=" * 70)
print("ITEM CONTRIBUTIONS BY GOAL (swap-group-aware)")
print("=" * 70)
for iname, data in item_contributions.items():
    lock = " [LOCKED]" if data["locked"] else ""
    print(f"\n  {iname} ({data['slot']}{lock}):")
    for gname, val in data["contribs"].items():
        print(f"    -> {gname}: +{val}")

# Apron analysis
print()
print("=" * 70)
print("APRON DEEP ANALYSIS")
print("=" * 70)
apron = next(i for i in items if "apron" in i["name"])
print(f"  Item: {apron['name']} ({apron['slot']})")
print(f"  Enhancives:")
for a, b in apron["enh"]:
    grp = get_group(a)
    print(f"    {a}: +{b}  (group: {grp or 'standalone'})")

print(f"\n  Currently contributes:")
print(f"    Logic (Stat C): +8  (total: {goal_totals['Logic (Stat C)']}/{goals['Logic (Stat C)']['target']})")
print(f"    Spell Aiming (Weapons): +8 via Blunt swap  (total: {goal_totals['Spell Aiming (Weapons)']}/{goals['Spell Aiming (Weapons)']['target']})")

print(f"\n  If REMOVED from front slot:")
logic_after = goal_totals["Logic (Stat C)"] - 8
weapons_after = goal_totals["Spell Aiming (Weapons)"] - 8
print(f"    Logic: {goal_totals['Logic (Stat C)']} -> {logic_after}  {'BREAKS TARGET' if logic_after < 40 else 'still OK'}")
print(f"    Weapons: {goal_totals['Spell Aiming (Weapons)']} -> {weapons_after}  (gap widens by 8)")

print(f"\n  Replacement must provide:")
if logic_after < 40:
    print(f"    >= {40 - logic_after} Stat C (Logic/Intuition/Influence) to maintain target")
print(f"    Ideally more Weapons/MC/Lores/Recovery to close gaps")
print(f"    OR keep apron and fill gaps via open slots instead")

print(f"\n  Open slots available: ankle, back, belt, both_ears, chest_slipped,")
print(f"    feet_slipped, fingers, legs_pulled, legs_slipped, neck, pin, shoulder_slung")
