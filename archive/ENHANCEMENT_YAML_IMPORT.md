# Enhancement: YAML-based Bulk Import

## Status: ✅ IMPLEMENTED (Version b854e0b7-a1e9-4600-bed7-e264dc0e784b)

## Problem
Current bulk import parser has limitations:
- Can't handle duplicate item names (uses name as key)
- Skips tattoos (not in location list)
- Fragile text parsing (requires exact format)
- No permanence detection

## Solution: YAML Import with Item IDs

User provided Lich script (`enh_export.lic`) that generates YAML files with:
- Unique item IDs from `exist` attributes
- Clean item names (XML tags stripped)
- Charge info (timed/counter)
- Complete stat/skill/resource breakdown

### YAML Format Example
```yaml
---
character: Tijay
generated: '2026-03-13 11:37:43'
worn_items:
- name: a <a exist="185391909" noun="locus">gilded locus
  id:
  charge_info:
    type: timed
    expiry: 8/19/2029 19:15:37 CDT
```

## Implementation

### Detection
Bulk import now detects YAML format:
```typescript
if (enhanciveDetail.trim().startsWith('---') || enhanciveDetail.includes('worn_items:')) {
  await processYamlImport(enhanciveDetail)
  return
}
```

### Parser
Minimal YAML parser extracts:
- Item names (strips XML tags)
- Item IDs from `exist` attributes
- Noun for slot mapping

### Slot Mapping
Maps item nouns to slots:
```typescript
const slotMap = {
  'locus': 'elsewhere', 'helm': 'head', 'barrette': 'pin',
  'earcuff': 'ear', 'bracelet': 'wrist', 'ring': 'finger',
  'tattoo': 'elsewhere', ...
}
```

## Benefits
✅ Handles duplicate items (unique IDs)
✅ Imports tattoos (mapped to 'elsewhere')
✅ Single source of truth (no matching required)
✅ More reliable parsing

## Usage
1. Run `;enh_export` in game (Lich script)
2. Copy YAML file content
3. Paste into bulk import field
4. Click "Process Import"

## Limitations
- Currently imports items without enhancive data (empty `[]`)
- Future: Parse totals section to populate enhancives
- Future: Detect permanence from charge_info

## Files
- `enh_export.lic` - Lich script to generate YAML
- `Tijay_enhancives_2026-03-13_11-37-42.yaml` - Example output
