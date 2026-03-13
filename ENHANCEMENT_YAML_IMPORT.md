# Enhancement: YAML-based Bulk Import

## Problem
Current bulk import parser has limitations:
- Cannot handle duplicate items with same name (e.g., two "a mossbark ring")
- Requires matching items across two separate text outputs
- Text parsing is fragile and error-prone
- Skips tattoos and non-wearable items

## Proposed Solution
Add YAML-based import format with unique item IDs.

## YAML Format (Draft)
```yaml
items:
  - id: "185391909"
    name: "a gilded locus"
    slot: "elsewhere"
    permanent: true
    enhancives:
      - stat: "Strength"
        bonus: 9
      - stat: "Constitution"
        bonus: 1
      - stat: "Aura"
        bonus: 2
  - id: "185391910"
    name: "an ornate vultite helm"
    slot: "head"
    permanent: true
    enhancives:
      - stat: "Shield Use Bonus"
        bonus: 7
```

## Benefits
- ✅ Handles duplicate items via unique IDs
- ✅ Single source of truth (no matching required)
- ✅ Easy to parse with standard YAML library
- ✅ Includes permanence info directly
- ✅ Clean, unambiguous structure
- ✅ Can include tattoos and all item types

## Implementation Tasks
1. Add YAML parser to bulk import (detect YAML vs text format)
2. Add file upload option to bulk import form
3. User will provide Lich script to generate YAML output
4. Test with real inventory data

## Alternative: XML Format
User also suggested using `;showxml` output with `exist` IDs:
```xml
<a exist="185391909" noun="locus">gilded locus</a>
```

Pros: Already available in game
Cons: More complex parsing, requires matching two XML outputs

## Status
- [ ] Waiting for user to provide Lich script
- [ ] Waiting for example YAML output
- [ ] Implementation pending

## Related Issues
- Bulk import duplicate item bug (mossbark ring issue)
- Tattoo items not imported
