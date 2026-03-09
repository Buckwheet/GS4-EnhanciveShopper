# TODO List

## High Priority
- [ ] **Separate filters for item types**
  - Worn equipment (armor/clothing slots: head, neck, arms, hands, legs, feet, etc.)
  - Weapons (including slung items like bows/shields with "shoulder" worn)
  - Containers (bags, pouches, etc.)
  - Need to determine item type from additional fields (not just `worn`)

## Medium Priority
- [ ] Add "Show sold items" toggle (items with `available = 0`)
- [ ] Alert only on NEW items (not existing ones that match)
- [ ] Add "Test Alert" button to verify Discord DMs work
- [ ] Show alert history in UI
- [ ] Character profile builder (track multiple builds per user)

## Low Priority
- [ ] Add enchant level filter
- [ ] Filter by specific towns (multi-select)
- [ ] Email notifications as backup (would add cost)
- [ ] "Recently sold" section showing popular items
- [ ] Price history tracking

## Technical Debt
- [ ] Better error handling in Discord OAuth
- [ ] Rate limiting on API endpoints
- [ ] Pagination for large result sets (currently showing first 500)
