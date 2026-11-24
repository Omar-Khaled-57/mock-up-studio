# Mockup Studio visual identity

Mockup Studio separates its editor chrome from the artwork being composed. Its
chrome uses familiar indigo controls and neutral zinc surfaces; the canvas and
user-created mockup remain independent of the UI theme.

| Role | Color |
| --- | --- |
| Dark accent | ![#6366f1](https://img.shields.io/badge/-%236366f1?style=flat-square&color=6366f1) `#6366f1` |
| Light accent | ![#4f46e5](https://img.shields.io/badge/-%234f46e5?style=flat-square&color=4f46e5) `#4f46e5` |
| Light chrome | ![#ffffff](https://img.shields.io/badge/-%23ffffff?style=flat-square&color=ffffff) `#ffffff`, `#f4f4f5`, `#e4e4e7` |
| Dark canvas | ![#09090b](https://img.shields.io/badge/-%2309090b?style=flat-square&color=09090b) `#09090b` |

The UI token source and theme-specific behavior are in
[`src/renderer/styles/globals.css`](../src/renderer/styles/globals.css);
components consume semantic tokens through the theme hook. The project docs
index is [`docs/index.md`](index.md).
