# StudioShelf demo audit — 2 November 2026

The core project-demo workflow is usable after the corrections below. This is an interactive showcase with browser-local work, not a connected commercial service or a guarantee of behavior in every browser.

## Confirmed issues and corrections

| Issue                                                                                        | Result after correction                                                                                                                                |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Help navigation discarded unfinished edits without a warning.                                | Help opens separately and the editor retains its unsaved draft. Reproduced before the fix and verified afterward.                                      |
| Download dialog's review action stayed on Overview or another view.                          | It opens the actual review workspace from desktop and mobile navigation.                                                                               |
| Valid long fact lines produced invalid template fields and blocked saves.                    | Short artwork/highlight fields are bounded; complete facts remain in long copy. A long-fact kit saved and restored through the actual backup importer. |
| Negative values could lose a leading minus sign.                                             | List-marker handling preserves values such as `-10 °C`.                                                                                                |
| Non-Latin or emoji-only inputs could produce an empty keyword list.                          | Unicode-aware keyword handling and a bounded fallback keep the kit valid.                                                                              |
| A similar product URL could satisfy the destination check or be partially rewritten in HTML. | Complete normalized URLs are compared and linked. Edited social copy stays intact.                                                                     |
| Malformed backup IDs passed validation and could fail later in browser storage.              | Missing and non-string IDs are rejected before import/storage.                                                                                         |
| Connections could download an incomplete backup that restore rejected.                       | Backup serialization validates the same contract as restore before producing a file.                                                                   |
| Demo voice/audience controls appeared to affect fixed templates.                             | Those unsupported controls are hidden in the demo; the full application explains their Gemini role. Call-to-action controls remain functional.         |
| Mobile drawer lacked proper dismissal/focus behavior and gained horizontal overflow.         | Escape, outside click, close control, focus wrapping/return, background protection and scroll lock work. Drawer content width equals its client width. |

## Verification performed

- All **88 automated tests passed**, including new regression cases for template bounds, negative/Unicode facts, normalized URL length, exact destination matching, malformed metadata and backup round trips.
- Whole-project Prettier check, strict TypeScript and both final production builds passed: the regular server application and the isolated GitHub Pages export.
- On the public pre-update site, checked direct product/palette/slide/asset links, listing and carousel editing, undo/redo, selective regeneration preserving a separate slide edit, and the stale-copy warning after a product-price change.
- Verified Shopify availability, privacy, pricing and support routes. The dark theme survived refresh; the public preference was returned to light. No browser errors were recorded for those routes.
- On the corrected static artifact, verified help preserves the active draft, export-to-review navigation, long-fact generation/save, JSON download and actual backup import. The restored description retained both `-10 °C` and non-Latin text.
- At a requested 390-pixel viewport, the visible browser measured **375 CSS pixels** with equal document/content widths. Mobile focus wraps within the drawer, Escape and outside click close it, focus returns to the toggle, and Download → Review works. After the sizing correction, drawer client and content widths both measured **195 pixels**. Its close target remains 44 × 44 pixels.
- The static artifact retains its source/secret exclusions and same-origin connection policy. Only compiled website files, public media and license notices are published; the main repository remains private.
- After redeployment, verified the corrected public site: help uses a separate tab, demo voice controls are absent, Download → Review opens the actual checklist, and browser logs recorded no errors. Public mobile document/content widths both measured 390 pixels, and drawer client/content widths both measured 195 pixels.

Evidence: [local mobile navigation](deep-audit-mobile.jpg), [updated live mobile navigation](deep-audit-live.jpg). Earlier upload, full PNG/ZIP export, review persistence and live channel-download checks are recorded in [VERIFICATION.md](VERIFICATION.md).

## Practical limits

Gemini, cloud accounts and Shopify remain unavailable on GitHub Pages by design. Browser saves are tied to the current browser and origin; backups are the portable copy. Incomplete required fields must be completed before a restorable backup can be exported.

This pass did not run live provider/store tests, a screen-reader session, every browser/device, restrictive browser-storage settings, or a throttled-network performance benchmark. Original concept PNGs are relatively large and remain a possible optimization for slow connections. No conversion, revenue, independent factual-verification or security-certification claim follows from this audit.
