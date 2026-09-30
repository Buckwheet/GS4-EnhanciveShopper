import json, math, time, random

# Load real shop data
data = json.load(open("/home/rpgfilms/enhancive-alert/shop_items.json"))

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

NUGGET_SLOTS = {"nugget", "shoulders", "chest", "hands", "feet_on", "waist"}
SLOT_MAP = {"finger": "fingers", "ear": "single_ear"}

def normalize(a):
    for s in [" Bonus", " Ranks", " Base"]: a = a.replace(s, "")
    return a.strip()

def get_group(ability):
    a = normalize(ability)
    for name, group in SWAP_GROUPS.items():
        if a in group: return name
    return None

# Pre-parse all items once
ALL_ITEMS = []
for item in data["items"]:
    if not item.get("available"): continue
    enh_raw = item.get("enhancives_json", "[]")
    enhancives = json.loads(enh_raw) if isinstance(enh_raw, str) else enh_raw
    if not enhancives: continue
    raw_slot = item.get("worn") or "nugget"
    slot = SLOT_MAP.get(raw_slot, raw_slot)
    # Pre-compute group contributions
    gc = {}
    for enh in enhancives:
        group = get_group(enh["ability"])
        if group:
            eff = enh["boost"] // 2 if enh["ability"] == "Health Recovery" else enh["boost"]
            gc[group] = gc.get(group, 0) + eff
    if not gc: continue
    cost = item["cost"]
    if slot in NUGGET_SLOTS:
        tc = cost + 25_000_000
    elif not item.get("is_permanent"):
        tc = cost + 10_000_000
    else:
        tc = cost
    ALL_ITEMS.append({"id": item["id"], "slot": slot, "gc": gc, "tc": tc})

print(f"Pre-parsed {len(ALL_ITEMS)} candidate items")

# Generate random sets
POSSIBLE_GOALS = ["MC", "Weapons", "Recovery", "Lores", "MIU/AS", "Stat A", "Stat B", "Stat C"]
ALL_SLOTS = ["ankle", "back", "belt", "both_ears", "chest_slipped", "feet_slipped",
             "fingers", "legs_pulled", "legs_slipped", "neck", "pin", "shoulder_slung",
             "wrist", "single_ear", "head"]

def random_set():
    """Generate a random goal set with 3-6 goals and 8-15 open slots"""
    num_goals = random.randint(3, 6)
    goals = {}
    chosen = random.sample(POSSIBLE_GOALS, min(num_goals, len(POSSIBLE_GOALS)))
    for g in chosen:
        target = 40 if g.startswith("Stat") else 50
        current = random.randint(0, target - 5)
        # Possibly add a second lore goal
        if g == "Lores" and random.random() > 0.5:
            goals[f"{g}-1"] = {"group": g, "target": target, "current": random.randint(0, 20)}
            goals[f"{g}-2"] = {"group": g, "target": target, "current": random.randint(0, 10)}
        else:
            goals[g] = {"group": g, "target": target, "current": current}
    num_slots = random.randint(8, 15)
    slots = {}
    for s in random.sample(ALL_SLOTS, num_slots):
        slots[s] = 1
    return goals, slots

def solve_set(goals, open_slots, alpha=1.5):
    """Run the greedy algorithm for one set"""
    gaps = {g: max(0, info["target"] - info["current"]) for g, info in goals.items()}
    slot_rem = dict(open_slots)
    nug_used = 0
    used = set()
    picks = 0
    total_slots = sum(slot_rem.values())

    for _ in range(total_slots):
        best_val = 0
        best_id = None
        best_bd = None
        for c in ALL_ITEMS:
            if c["id"] in used: continue
            slot = c["slot"]
            if slot in NUGGET_SLOTS:
                if sum(slot_rem.values()) - nug_used <= 0: continue
            else:
                if slot_rem.get(slot, 0) <= 0: continue
            # Score
            alloc = {}
            for group, contrib in c["gc"].items():
                gg = [(g, gaps[g]) for g in gaps if goals[g]["group"] == group and gaps[g] > 0]
                if not gg: continue
                gg.sort(key=lambda x: -x[1])
                alloc[gg[0][0]] = min(contrib, gg[0][1])
            if not alloc: continue
            total_s = sum(alloc.values())
            if total_s < 2: continue
            weighted = sum(v / gaps[g] for g, v in alloc.items() if gaps[g] > 0)
            val = weighted / math.log10(max(c["tc"], 1000))**alpha
            if val > best_val:
                best_val = val; best_id = c["id"]; best_bd = alloc
                best_slot = c["slot"]
        if best_id is None: break
        used.add(best_id)
        for g, v in best_bd.items():
            gaps[g] = max(0, gaps[g] - v)
        if best_slot in NUGGET_SLOTS:
            nug_used += 1
        else:
            slot_rem[best_slot] -= 1
        picks += 1
        if all(v == 0 for v in gaps.values()): break
    return picks

# Benchmark single set (Mejora-like)
goals_m = {
    "MC":       {"group": "MC",       "target": 50, "current": 16},
    "Weapons":  {"group": "Weapons",  "target": 50, "current": 25},
    "Recovery": {"group": "Recovery", "target": 50, "current": 28},
    "Lore-Rel": {"group": "Lores",    "target": 50, "current": 3},
    "Lore-Ble": {"group": "Lores",    "target": 50, "current": 0},
}
slots_m = {s: 1 for s in ["ankle","back","belt","both_ears","chest_slipped","feet_slipped",
           "fingers","legs_pulled","legs_slipped","neck","pin","shoulder_slung","wrist","single_ear"]}

t0 = time.time()
solve_set(goals_m, slots_m, 1.5)
t1 = time.time()
single_ms = (t1 - t0) * 1000
print(f"\nSingle set (Mejora): {single_ms:.0f}ms")

# Benchmark 1000 random sets
random.seed(42)
sets = [random_set() for _ in range(1000)]

t0 = time.time()
for goals, slots in sets:
    solve_set(goals, slots, 1.5)
t1 = time.time()
total_s = t1 - t0
avg_ms = total_s * 1000 / 1000

print(f"\n1000 sets: {total_s:.1f}s total, {avg_ms:.0f}ms avg per set")
print(f"Extrapolated:")
print(f"  300 users × 3 chars = 900 sets: {total_s * 0.9:.1f}s")
print(f"  1000 sets: {total_s:.1f}s")
print(f"  CF Worker 50ms CPU limit: {'IMPOSSIBLE' if avg_ms > 50 else 'OK'}")
print(f"  CF Worker 30s limit: {'FAIL' if total_s > 30 else 'OK'} for all 1000")
print(f"  GH Action 6hr limit: {'OK' if total_s < 21600 else 'FAIL'}")
