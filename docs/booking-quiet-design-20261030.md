# Booking page — quieter portfolio presentation

The booking page now follows the photography portfolio’s white background, Hanken typography, generous image space and small circular controls. The goal is to let the photographs establish the photographer’s taste while keeping booking information easy to find.

## Presentation

- Keep only the hero title; Chinese reads “我的约拍”. The language switch belongs to the hero and leaves with it. Keep the centred portrait-phone crop.
- Replace self-evaluation and sales prose with short, concrete bilingual copy. Keep the scrolling introduction, its three photographs, the client series, and all eight photo-linked process steps.
- Remove the long testimonial carousel and its timer, repeated planning cards and separate booking-process pitch.
- Put prices, shoot-type selection and contact in one section. Keep delivery/fees and booking conditions in native, keyboard-accessible disclosures.
- End with three approved portfolio covers forming one linked preview, followed by the small signature and back-to-top control. Image-use terms remain accessible from the signature.
- Keep language controls in the first section/header rather than globally floating. The Portfolio photo book has a quiet outlined booking action in its caption.

Detailed conditions remain available on demand. Package rows, the three included facts and the shoot-type pills use distinct formats. Portfolio preview images come from current rated-1 covers, exclude the portrait pool, and deduplicate asset families; no static fallback can restore removed photographs.

The route list scrolls with the document, alongside the sticky map, with no nested scrollbar or repeated map caption panel. Scrolling selects places in order by default. Clicking a location or map marker takes control for the remainder of that visit; further page scroll does not change the chosen place. Hover and wheel events do not silently resume automatic selection.

## Retained contracts

No photograph, curation score, series assignment, cover, API or database record was changed. A direct bilingual comparison confirmed unchanged package prices/durations, included delivery, extra fees, service types and map places. The 50% deposit, 24-hour cancellation boundary, delivery timing and payment methods remain available. Four-plus-person sessions retain their custom quote rather than inheriting the standard two-hour promise.

Package and shoot-type controls update the booking form. A selected known shoot type also follows a language change; user-written free text is retained.

## Validation

- Production build and separate TypeScript check passed; bilingual coverage, photo-curation and portrait-book transition checks passed.
- WebKit desktop and portrait-phone checks passed in both Chinese and English: no horizontal overflow, first-screen control placement, disclosure access, package/people fields, and shoot-type language synchronization.
- The mobile map followed all six places forward and backward in DOM order. A desktop mouse-wheel gesture over the map left document scroll unchanged. Mobile WebKit automation does not expose mouse-wheel input, so that wheel check used a desktop context.
- Three booking outcomes were intercepted and fulfilled locally: sent, saved without email, and error. Feedback followed the selected language; no real booking or email was sent.
- Custom-quote display and a 320-pixel phone viewport passed. The embedded homepage controls stayed below the opening scene.

Animation controllers and natural photograph proportions are retained. No new animation loop or frame-rate cap was added.

## Follow-up verification

The title-only cover, first-section language controls, document-driven map and persistent click selection passed in Chinese and English at desktop and portrait-phone sizes. Each route was exercised in both directions, and scrolling/keyboard input after selection did not resume automatic map changes. The route list had visible overflow and no independent scrollbar.

Both page entrances were followed as actual links. The portfolio preview displayed three distinct approved covers without cropping; at phone DPR 3, the 350px main preview selected a 1280px source and the two 170px previews selected 640px sources. Raw source dimensions were probed from `currentSrc`, avoiding the density-corrected `naturalWidth` of a `srcset` image. No live booking was submitted.
