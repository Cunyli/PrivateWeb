# Portfolio gallery corrections — 2026-10-29

- Remove the synthetic Selected entry from the collection ribbon.
- Carry approved-cover width and height into the gallery. Image decoding no longer updates the global column assignment or restarts every floating pair. A WebKit cold-load reproduction previously observed 9 column changes in 658 ms; the fixed delayed-image run observed none.
- Preserve native image proportions and reserve their height before decoding.
- Sample a stable browser RAF cadence for the scene's adaptive pixel budget. Render every delivered frame. Loading-time callbacks and render callbacks must never both feed the same clock sample; startup bursts must not be interpreted as a high-refresh display.
- The optional `?perf=1` overlay reports the delivered cadence separately from achieved scene FPS. Automated WebKit here delivers about 60 Hz; tests exercise 60, 90, 120, 144 and 240 Hz clocks, overload, and startup jitter. This is not a claim of measured 120 FPS on a physical display.

## Applied data correction

The sole published photograph in August in Finland (2488) was moved from collection 100 to Midsummer (111), appended at order 15. Collection 100 was unpublished; its trashed photograph 2489 stays unpublished and recoverable. Ratings, deleted IDs, and featured IDs were verified unchanged. `/work/100` now redirects to the moved photograph.

Fill the two empty English collection titles (110, 111) and translate the six Chinese titles that had been copied into the English photograph records (2434, 2436–2440). Chinese records remain unchanged. The guarded SQL transaction and before-data snapshots are in the local run outputs, outside the repository.

Validation: `node scripts/check-photo-curation.cjs`, TypeScript, production build, WebKit delayed-image scrolling, bilingual ribbon, collection redirect and mobile landscape checks.
