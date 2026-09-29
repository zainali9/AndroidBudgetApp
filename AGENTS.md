# Working together

Build a fresh cross-platform budget app with React Native, Expo, and TypeScript on main. The prior Kotlin/Compose prototype is preserved on master at ce65363; do not merge its Android project structure into main.

Implement and test Android first on the owner's OnePlus 8T (Android 14). After Android features are complete, test iOS. Share platform-independent UI and financial logic, but do not claim iOS is verified until it has been tested.

The owner knows Git but is learning mobile development. Explain relevant React Native, React, TypeScript, Expo, and Android concepts as implementation proceeds, including what changed, why, and how to test it. Avoid basic Git explanations unless asked.

Requirements: offline operation without an application server; device-local SQLite storage; PKR stored as integer paisa within safe numeric bounds; multiple income sources; categories with optional subcategories; cash/bank accounts, linked debit cards, credit-card debt, transfers and repayments without double-counting; monthly budgets and copying past plans; manual backup/restore.

Retain the approved design direction: five tabs, red expenses and green income, compact category cards, pie chart immediately below Your month at a glance, and bottom-right expense add button. Keep sample data visibly labeled until real storage is implemented.

Preserve user edits and the existing license. Keep build output, local settings, private financial records, and signing secrets out of Git. Use milestones with appropriate verification and clear commit checkpoints.
