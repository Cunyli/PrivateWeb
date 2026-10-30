# Booking page — quieter portfolio presentation

The booking page now follows the photography portfolio’s white background, Hanken typography, generous image space and small circular controls. The goal is to let the photographs establish the photographer’s taste while keeping booking information easy to find.

## Presentation

- Shorten the hero to one sentence and two text actions; lighten the image overlay and centre the face in the portrait-phone crop.
- Replace self-evaluation and sales prose with short, concrete bilingual copy. Keep the scrolling introduction, its three photographs, the client series, and all eight photo-linked process steps.
- Remove the long testimonial carousel and its timer, repeated planning cards and separate booking-process pitch.
- Put prices, shoot-type selection and contact in one section. Keep delivery/fees and booking conditions in native, keyboard-accessible disclosures.
- Replace the large location footer with a small signature, portfolio link and back-to-top control. Image-use terms remain accessible from the signature.
- Fix the booking language button and standalone Portfolio language/search controls to the same viewport corner. Embedded homepage controls remain in document flow.

The default Chinese page text decreased from 2,388 to 676 characters in the same browser extraction. Detailed conditions remain available on demand; this is a reduction in default expanded text, not removal of booking terms.

## Retained contracts

No photograph, curation score, series assignment, cover, API or database record was changed. A direct bilingual comparison confirmed unchanged package prices/durations, included delivery, extra fees, service types and map places. The 50% deposit, 24-hour cancellation boundary, delivery timing and payment methods remain available. Four-plus-person sessions retain their custom quote rather than inheriting the standard two-hour promise.

Package and shoot-type controls update the booking form. A selected known shoot type also follows a language change; user-written free text is retained.

## Validation

- Production build and separate TypeScript check passed; bilingual coverage, photo-curation and portrait-book transition checks passed.
- WebKit desktop and portrait-phone checks passed in both Chinese and English: no horizontal overflow, 36 fixed-control position checks, disclosure access, package/people fields, and shoot-type language synchronization.
- The mobile map followed all six places forward and backward in DOM order. A desktop mouse-wheel gesture over the map left document scroll unchanged. Mobile WebKit automation does not expose mouse-wheel input, so that wheel check used a desktop context.
- Three booking outcomes were intercepted and fulfilled locally: sent, saved without email, and error. Feedback followed the selected language; no real booking or email was sent.
- Custom-quote display and a 320-pixel phone viewport passed. The embedded homepage controls stayed below the opening scene.

Animation controllers and natural photograph proportions are retained. No new animation loop or frame-rate cap was added.
