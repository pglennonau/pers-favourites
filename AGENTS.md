# Pers Favourites Engineering Instructions

For all functional application work in this repository, follow `skills/app-building/SKILL.md`.

Non-negotiable rules:

- Fix the base implementation; do not add runtime corrective overlays or monkey patches.
- Use semantic versioning (`0.27.11`, `0.28.0`, etc.).
- Preserve existing user data and backward-compatible stored values.
- Functional UI changes require real browser interaction QA; source-text/static checks alone do not prove functionality.
- For iPhone/PWA-sensitive changes, include WebKit/mobile-oriented testing where practical.
- Treat service-worker caching and deployed behaviour as part of QA.
- Do not call a defect fixed until the deployed user path is verified, or explicitly state what remains unverified.
- Prefer substantial changes on a branch with CI and diff review before merge.

The detailed workflow, QA layers, release discipline and definition of done are in `skills/app-building/SKILL.md`.
