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


## Follow-up: opaque sticky visuals and phone series

Phone sticky visuals used a 64px top offset and an inset background. Step numbers could pass through the uncovered top/side area. A later global frame-height rule also overrode the phone portrait limit. Both the Why me shelf and map shelf now pin at zero with an opaque background extending across the viewport; the photograph itself is contained inside a bounded height. The desktop map stage also pins at zero with a full-width white background. Background extension uses paint-only shadows, avoiding scrollbar-width horizontal overflow.

The introduction now keeps its document-driven, clipped spread presentation on portrait phones as well as desktop. Reduced-motion preferences retain the static reading layout. Mixed Jianji/Xinyi and Lijiang shoots use readable full-width landscapes and centred portraits; David uses a large frame, a pair and a final large frame. Hongjia and Xiya keep their existing layouts. No photo records or order changed.

The portfolio book now selects responsive textures by each photograph's displayed width, with width descriptors adjusted for portrait proportions. GPU warming waits for a 180ms quiet window, warms the resting spread, then prepares the next spread after another 300ms quiet window. Further scrolling cancels that scheduled work. Curved geometry and native canvas pixel density are unchanged.

Validation: production build, independent TypeScript check, bilingual coverage, curation regression and asynchronous portrait-transition regression passed. Browser checks covered desktop 1440x900 and phone widths 390 and 320, introduction travel, portrait height containment, full-width top occlusion, no horizontal overflow, and forward/reverse book turns. One production 390x844 browser sample at DPR 1 recorded 98 turn frames, median 8.3ms, p95 9.0ms, maximum 16.7ms; first preparation took 52.9ms and the next cached preparation 0.4ms. This is a bounded browser observation, not a controlled before/after benchmark or physical-phone performance guarantee.
