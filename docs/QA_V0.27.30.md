# v0.27.30 QA

Baseline: v29 commit 172e37492e8888b2c0289ee9557a4c521c127a0a. Build 20260922.3.

174 frontend, 115 release-integrity and 15 Worker checks pass. The new checks verify visible Spai/Andal/Mala suggestions, tap-to-commit, keyboard selection, the always-visible Add entry point, viewer identity guidance without privilege grants, and actual form-button submission with persisted venue data using the same location suggestions. Previous v29 checks and prior release regressions remain covered.

Country/region/city suggestion lists use app-rendered controls with 44px minimum targets. Partial input is preserved. Native datalist popups are replaced, while source option data remains available. English/Spanish Andalusia and Málaga aliases use consistent suggestion labels.

No authentication rules, local storage keys, Worker code or data migrations changed. The existing local trial's Owner/System Administrator rules remain intact. Physical iPhone Safari and the user's exact device data are not directly accessible; browser release smoke checks follow publication. The user's clarified Add symptom was a missing button, not a failed Save.
