# Scroll interaction check — 2026-10-29

## Changes

- Remove the global phone landscape hint. Phone portrait now reads the booking introduction as a normal vertical sequence with all three existing photographs; desktop retains the horizontal scroll sequence.
- Give each desktop introduction spread a separate paint/compositing boundary, remove its large moving shadow, and increase the scroll distance from 235svh to 315svh. Do not run horizontal animation or promote its long strip in phone portrait.
- Preserve booking route geometry, marker nodes and tooltips across selection changes. Cancel pending hover selection on click, debounce hover for 120ms, and stop the previous camera animation before a new destination.
- Reuse Portfolio map markers by location/world-copy key instead of removing and rebuilding all copies on every movement.
- Size the fixed entry frame with the dynamic viewport, retain an opaque backing until the scene has expanded, and synchronize frame visibility, pointer interception and Portfolio inert state with the cloud shader endpoint at progress 0.735.

## Verification

- Production build and separate TypeScript check passed.
- Existing curation and portrait page-turn regressions passed. No photo identities, ratings, covers or groupings changed.
- Desktop WebKit, 1440×900 at DPR 2: introduction matches forward/reverse scroll positions; all three photographs remain. One 180-frame scripted scroll sample measured median 17ms, p95 18ms, maximum 19ms, zero frames over 25ms. The baseline was already within that automated sample budget; this result does not prove physical 120Hz performance or a measured FPS improvement.
- Six booking-map selections: baseline added 36 / removed 36 marker DOM nodes; candidate added 0 / removed 0, with the original six nodes retained. Wheel panning moves each map without scrolling its surrounding page. Portfolio location selection also remains usable.
- Phone WebKit at DPR 3: 390×844, 390×700, and 414×896; eight entry positions per size. The frame covers the viewport throughout. Portfolio remains inert and unreachable by hit testing until 0.735, and search opens normally afterward.
- Phone portrait: all three introduction images appear in vertical flow with no horizontal document overflow or orientation prompt. Reduced motion preserves the static photo sequence.

Screenshots and raw local results: `/private/tmp/portfolio-booking-edit-20261029/outputs/scroll-*` and `logs/scroll-candidate-qa.log`.
