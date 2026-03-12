# Item Worn Location Change (Swatch) Data

Source: https://gswiki.play.net/Item_worn_location_change

## Overview
Location swatches allow changing the worn location of unscripted, wearable items. Sold at Duskruin's The Annex shop.

## Restrictions
- Armaments ineligible (except greaves)
- DB items, EZ Scripted items, items with Flourishes ineligible
- Arm/leg greaves can only swap between Arms (14) and Legs (15)
- Containers must be empty at redemption
- Container capacities will not increase (only decrease or be removed)
- Show descriptions will be removed

## Slot Change Table

| # | Location | Base Noun | Wood | Metal | Container | Capacity | Max Items | Our Slot Name |
|---|----------|-----------|------|-------|-----------|----------|-----------|---------------|
| 1 | Pin | pin | pin | pin | - | - | - | pin |
| 2 | Back | cape | - | - | backpack | 100 | any | back |
| 3 | Waist | belt | belt | belt | belt | 1 | 1 | waist |
| 4 | Head | headband | crown | crown | hat | 1 | 1 | head |
| 5 | Shoulder | sash | - | pauldron | satchel | 40 | any | shoulder_slung |
| 6 | Shoulders | shawl | - | pauldrons | cloak | 100 | any | shoulders_draped |
| 7 | Legs | pants | - | - | pants | 2 | 2 | legs_attached |
| 8 | Torso | doublet | - | - | doublet | 1 | 1 | chest |
| 9 | Wrist | bracelet | bracelet | bracelet | - | - | - | wrist |
| 10 | Finger | ring | ring | ring | - | - | - | fingers |
| 11 | Feet | shoes | - | - | shoes | 1 | 1 | feet_on |
| 12 | Neck | necklace | necklace | necklace | neck pouch | 1 | 1 | neck |
| 13 | Belt | buckle | buckle | buckle | belt pack | 20 | any | belt |
| 14 | Arms | armbands | armbands | armbands | arm wraps | 2 | 1 | arms |
| 15 | Legs | leg wraps | leg braces | leg braces | thigh-sheath | 3 | 1 | legs_pulled |
| 16 | Ear | earring | earring | earring | - | - | - | single_ear |
| 17 | Ears | earrings | earrings | earrings | - | - | - | both_ears |
| 18 | Ankle | anklet | anklet | anklet | ankle pouch | 1 | 1 | ankle |
| 19 | Front | tabard | pectoral | pectoral | tabard | 4 | 4 | front |
| 20 | Hands | gloves | handflowers | handflowers | gloves | 1 | 1 | hands |
| 21 | Feet | socks | - | - | socks | 1 | 1 | feet_slipped |
| 22 | Hair | hairtie | barrette | barrette | - | - | - | hair |
| 23 | Undershirt | undershirt | - | - | - | - | - | chest_slipped |
| 24 | Leggings | leggings | - | - | - | - | - | legs_pulled |

## Implementation Notes

### Slots NOT Available for Swatch
These slots from our system are NOT in the swatch table:
- `locus` (elsewhere) - Cannot be changed with swatch

### Pricing Strategy
Similar to nugget (+25M option), we could:
1. Add checkbox: "Include swatch cost (+25M)" when suggesting items over slot limit
2. Show items that could be swatched to an available slot
3. Display with label like "+SWATCH" similar to "+NUGGET"

### Logic for Suggestions
When a slot is full:
1. Check if item can be swatched to another slot (must be in swatch table)
2. If target slot has availability, suggest with swatch cost
3. Display: "Item Name - 5M silvers +SWATCH (pin → back)"

### Database Schema Addition (Optional)
Could add to shop_items table:
```sql
ALTER TABLE shop_items ADD COLUMN swatch_eligible BOOLEAN DEFAULT 0;
```

Or calculate on-the-fly based on slot being in the swatch table.

### UI Implementation
1. Add "Include Swatch Cost" checkbox (like nugget)
2. When filtering, if slot full:
   - Check if item's slot is in swatch table
   - Find alternative slots with availability
   - Add swatch cost to total
   - Show badge "+SWATCH (original → new)"

---

## JavaScript Constant for Implementation

```javascript
// Location swatch slot change data
// Source: https://gswiki.play.net/Item_worn_location_change
const SWATCH_SLOTS = {
  'pin': { num: 1, baseNoun: 'pin', wood: 'pin', metal: 'pin', container: null },
  'back': { num: 2, baseNoun: 'cape', wood: null, metal: null, container: 'backpack' },
  'waist': { num: 3, baseNoun: 'belt', wood: 'belt', metal: 'belt', container: 'belt' },
  'head': { num: 4, baseNoun: 'headband', wood: 'crown', metal: 'crown', container: 'hat' },
  'shoulder_slung': { num: 5, baseNoun: 'sash', wood: null, metal: 'pauldron', container: 'satchel' },
  'shoulders_draped': { num: 6, baseNoun: 'shawl', wood: null, metal: 'pauldrons', container: 'cloak' },
  'legs_attached': { num: 7, baseNoun: 'pants', wood: null, metal: null, container: 'pants' },
  'chest': { num: 8, baseNoun: 'doublet', wood: null, metal: null, container: 'doublet' },
  'wrist': { num: 9, baseNoun: 'bracelet', wood: 'bracelet', metal: 'bracelet', container: null },
  'fingers': { num: 10, baseNoun: 'ring', wood: 'ring', metal: 'ring', container: null },
  'feet_on': { num: 11, baseNoun: 'shoes', wood: null, metal: null, container: 'shoes' },
  'neck': { num: 12, baseNoun: 'necklace', wood: 'necklace', metal: 'necklace', container: 'neck pouch' },
  'belt': { num: 13, baseNoun: 'buckle', wood: 'buckle', metal: 'buckle', container: 'belt pack' },
  'arms': { num: 14, baseNoun: 'armbands', wood: 'armbands', metal: 'armbands', container: 'arm wraps' },
  'legs_pulled': { num: 15, baseNoun: 'leg wraps', wood: 'leg braces', metal: 'leg braces', container: 'thigh-sheath' },
  'single_ear': { num: 16, baseNoun: 'earring', wood: 'earring', metal: 'earring', container: null },
  'both_ears': { num: 17, baseNoun: 'earrings', wood: 'earrings', metal: 'earrings', container: null },
  'ankle': { num: 18, baseNoun: 'anklet', wood: 'anklet', metal: 'anklet', container: 'ankle pouch' },
  'front': { num: 19, baseNoun: 'tabard', wood: 'pectoral', metal: 'pectoral', container: 'tabard' },
  'hands': { num: 20, baseNoun: 'gloves', wood: 'handflowers', metal: 'handflowers', container: 'gloves' },
  'feet_slipped': { num: 21, baseNoun: 'socks', wood: null, metal: null, container: 'socks' },
  'hair': { num: 22, baseNoun: 'hairtie', wood: 'barrette', metal: 'barrette', container: null },
  'chest_slipped': { num: 23, baseNoun: 'undershirt', wood: null, metal: null, container: null },
  'legs_pulled': { num: 24, baseNoun: 'leggings', wood: null, metal: null, container: null }
}

// Check if a slot can be swatched
function isSwatchEligible(slot) {
  return slot in SWATCH_SLOTS && slot !== 'locus'
}

// Get all possible swatch target slots for an item
function getSwatchTargets(currentSlot) {
  if (!isSwatchEligible(currentSlot)) return []
  
  // Special case: greaves can only swap between arms and legs_pulled
  if (currentSlot === 'arms') return ['legs_pulled']
  if (currentSlot === 'legs_pulled') return ['arms']
  
  // All other slots can swap to any other swatch-eligible slot
  return Object.keys(SWATCH_SLOTS).filter(s => s !== currentSlot && s !== 'locus')
}
```
