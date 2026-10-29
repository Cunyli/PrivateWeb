# Mobile booking reading flow — 2026-10-30

## Problem and change

The phone layout put all Why me copy before its single photo and all six location cards before the map. On a 390×844 viewport, the photo was still at y=2217 while reading the third Why me paragraph; the map started at y=822 while reading the third location. The location observer also chose among newly delivered intersection records, which could produce out-of-order selections.

Portrait phone/tablet layouts now keep one photo or map in a bounded sticky area above the associated text. Existing desktop columns remain. Photos retain their intrinsic proportions and all eight approved Why me selections. Why me follows the heading that has reached the reading area; location selection uses cached card positions in document order. The same hook handles desktop nested-list coordinates without measuring layout on every scroll frame.

Booking map movements cancel the prior flight. Mouse-only hover is disabled on touch/coarse-pointer devices; starting a new list gesture cancels delayed hover selection. Manual selection remains in control until deliberate list interaction resumes tracking.

## Verification

- Production build and separate TypeScript check pass.
- WebKit phone contexts: 390×844, 375×667, 430×932 at DPR 3. Across 102 Why me scroll samples, the full photo remained visible, all eight distinct photographs appeared in order and in reverse, the active paragraph stayed visible, and image ratios matched their natural dimensions. Across 44 map samples, the map and active card remained visible together; all six locations followed forward and backward order.
- The original six map marker nodes were retained, with zero additions/removals through the phone scroll checks.
- Desktop 1440×900 and landscape 844×390 retain copy-left/photo-right. Rapid manual map selection ends at the last selected destination; selected tooltip remains; wheel panning stays inside the map. English and reduced-motion checks passed.
- A WebKit touch tap holds its destination through unrelated page scrolling. Touch hover cannot overwrite it. Deliberate list interaction restores scroll tracking.
- No photo identities, ratings, covers, groupings, or booking copy changed.

Local evidence: `/private/tmp/portfolio-mobile-readers-20261029/outputs/` and `logs/`. Browser timings are not a physical 120Hz guarantee.
