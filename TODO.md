# 🌿 PlantGo v2 - Project Roadmap & Tasks

## 🚀 High Priority
- [ ] **Pictures credentials**: add credentials on wikipedia and quiz pictures.
- [ ] **Vernacular names**: manage vernacular names in the frontend for multiple language, fix language in the species hunt challenge.
- [/] **Menu dropdown**: Fix and improve menu dropdown.

## 🛠 Refactoring
- [ ] **Centralize Concurrency Limiter**: The `MAX_CONCURRENT` and `runLimited` logic is currently duplicated in:
    - `src/controllers/HerbariumCard.controller.js`
    - `src/controllers/MissionCard.controller.js`
    - `src/controllers/ObservationCard.controller.js`
    *Action: Move this to a shared utility in `src/data/wiki.service.js` or a new `src/utils/async.js`.*
- [ ] **Standardize Modals**: Unify the logic between `Modal.js` and `ResultModal.view.js` to use a consistent overlay/close pattern.
- [ ] **CSS Variables**: Audit `styles.css` to replace remaining hardcoded hex codes with the established CSS tokens (e.g., `--green-600`).

## ✨ Planned Features
- [ ] **Observation Sharing**: Add a "Share" button to `ResultModal` to export observation summaries as images or social links.
- [ ] **Improve visuals**: clean css file and improve visuals overhaul.

## 🐛 Known Issues
- [/] **Quiz Generation Speed**: Load per questions to fix delay on quiz generation.

## Improvments
- [ ] **Firebase Optimization**: Review `user.repo.js` to ensure we aren't over-fetching user data across multiple panel initializations.
- [ ] **PlantNet sci names**: Fix plantnet scientific names the same way than gbif id, could improve number of wikipedia pages found.
---
*Maintain this file by moving completed items to the section below.*

## ✅ Completed
- [x] Add observation history page