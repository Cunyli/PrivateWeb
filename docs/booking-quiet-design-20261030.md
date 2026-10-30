# Booking page — quieter portfolio presentation

The booking page uses the photography portfolio’s typography and image space, with the original dark Why me panel and compact route-card map restored. The goal is to let the photographs establish the photographer’s taste while keeping booking information easy to find.

## Presentation

- Keep only the hero title; Chinese reads “我的约拍”. The language switch belongs to the hero and leaves with it. Keep the centred portrait-phone crop.
- Keep the shorter opening introduction and its three photographs. Restore the original bilingual Why me copy, dark background, numbered steps and left-text/right-photo presentation; retain all eight photo-linked steps.
- Remove the long testimonial carousel and its timer, repeated planning cards and separate booking-process pitch.
- Put prices, shoot-type selection and contact in one section. Keep delivery/fees and booking conditions in native, keyboard-accessible disclosures.
- End with three approved portfolio covers forming one linked preview, followed by the small signature and back-to-top control. Image-use terms remain accessible from the signature.
- Keep language controls in the first section/header rather than globally floating. The Portfolio book itself opens the session page; a pointer and a subtle corner mark indicate the link. There is no separate Book a shoot button, and dragging still turns pages.

Detailed conditions remain available on demand. The rate selector, included facts and shoot-type text controls use distinct formats. Portfolio preview images come from current rated-1 covers, exclude the portrait pool, and deduplicate asset families; no static fallback can restore removed photographs.

The original map cards, heading and map information panel are restored without a nested scrollbar. On desktop, the compact two-column stage stays in view while document progress advances through the six places. On phones, the original map-above-cards layout follows each card position. Scrolling selects places in order by default. Clicking a location or map marker takes control for the remainder of that visit; further page scroll does not change the chosen place. Hover and wheel events do not silently resume automatic selection.

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

## Restored sections and direct book entry

Both original section styles were taken from the bilingual version before the quiet-layout redesign. Desktop and phone checks in both languages confirmed the dark introduction, eight steps, compact 95px route cards and original map panel. All six places followed scrolling in both directions; manual selection remained locked. Clicking/tapping the physical book opened the session page, while desktop dragging changed its spread without navigation. No live booking was submitted.

## Pinned route scene and explicit booking entrance

The sticky map stage previously sat inside an auto-height wrapper while the extra scroll height belonged to the outer section. The stage could not remain pinned: at the fifth stop the map was already above the viewport. Put the title, map and compact cards in one sticky stage inside its own scroll track. Measure progress against that containing track, fit both columns to the viewport, and release the stage after all six stops. Short desktop windows use smaller card spacing; portrait phones keep the map visible above the ordered cards. Manual selection still stops automatic location changes.

The Portfolio entrance now reads “预约拍” / “Book a session”, with a fine underline and a persistent link arrow. Both that label and the book open the session page; dragging retains page turning.

Photo-book preparation starts earlier, cached turns no longer read layout, the mesh reuses its allocated GPU buffer, and the renderer avoids preserving a duplicate drawing buffer or rewriting its ready attributes every frame. Native texture density, image selection and curved geometry are unchanged.

Local verification covered Chinese and English at 1440×900, 1280×720, 1024×768, 1280×600, 1024×520 and a 390×844 portrait phone. All six map stops were traversed forward and backward with the map actually inside the viewport; pinned columns aligned, manual selection persisted, and the following booking heading remained reachable. Real wheel input kept the desktop stage at 24px, and a mid-turn screenshot retained the curved sheet. Both booking entrances and desktop drag navigation passed. Build, TypeScript, bilingual coverage, curation and the asynchronous book-transition regression passed. No live booking was submitted.

In 24 WebKit turns, preparation took 0–1ms versus 2–3ms in the original desktop sample. Frame-time p95 was 17–18ms; 5 of 1009 sampled intervals exceeded 25ms, with a 40ms maximum. This runner operates around 60Hz, so these measurements do not establish 120Hz hardware performance. Desktop density remained 2× and phone density 3×; no frame-rate limiter was introduced.

## Editorial booking rates

Remove the map disclaimer in both languages and let the route heading use the available width. Keep its scroll track and map interaction intact.

Present the four prices in a horizontal type-led selector, with a quiet underline for the selected package. On phones it becomes two columns. The standard shoot promise sits beside the heading, while shoot types are plain text controls and contact uses “约个时间。” / “Let’s find a day.” with two direct links. Four-plus-person quotes continue to omit the standard duration/delivery promise.

TypeScript, production build and bilingual coverage passed. The existing prices, delivery, extra fees and shoot-type arrays were compared directly with the previous version. WebKit checks passed in Chinese and English at 1440×1000, 1280×600, 390×844 and 320×740: layout fit, four package choices, form package/people values, custom-quote handling, couple-type binding, close/focus return and map visibility after simplifying its heading. No real booking was submitted.


## Route-map wheel input follows the page

The booking route map no longer binds the shared map-wheel handler. Ordinary wheel and trackpad scrolling over the map belongs to the document, so it advances the pinned route scene and continues into booking. Leaflet wheel zoom remains disabled. Marker/card selection, map dragging and the explicit zoom controls remain available; manual location selection still persists through later page scrolling. The portfolio map retains its existing interaction.

This supersedes the earlier wheel-inside-the-map behavior recorded in the historical checks above. Local desktop verification at 1440×900 used real wheel input over the map in both directions. With Market Square manually selected, the page moved 90px while the map pane transform and selected place stayed unchanged. Further scrolling over the map brought the booking heading into the viewport.
