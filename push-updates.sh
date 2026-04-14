#!/bin/bash
# Run this script from inside the cloned repo to push all latest fixes
# Usage: bash push-updates.sh

echo "📦 Pushing Devis BTP updates to GitHub..."
git add -A
git commit -m "fix: DQE column layout (table-layout:auto) + no-prices hides value only

- Fix DQE table columns broken by table-layout:fixed + auto col width
  → switched to table-layout:auto, explicit widths on fixed cols only
  → Désignation column now takes remaining space naturally

- Fix no-prices mode: hide only price VALUE cells (color:transparent)
  → Sub-total/chap-total/grand-total ROW LABELS stay fully visible
  → Only the numeric value (tot-val) becomes transparent
  → Applies to: rts, rtc, rgt, rtva, rttc rows

- Update adjustColumns() to work with auto table layout
- Update print.css with same no-prices fix"
git push origin main
echo "✅ Done!"
