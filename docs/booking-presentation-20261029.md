# Booking portfolio presentation — 2026-10-29

Booking client work uses rating-1 photographs and excludes the photographer's own model tag, dedicated intro photos, and withdrawn samples. No unmarked or rating-0 photograph is promoted by the display rules.

The opening portrait is Ziyang's DSC04154 (2830), using its existing original. Ziyang's Stockholm frames are excluded from the series gallery without changing their ratings. Hongjia's Oeschinen frames remain excluded; Helsinki frames stay together.

The photographer introduction uses three explicit ordered display tags, `display:booking-intro-1` through `-3`. It displays only these approved portraits, separately from client casework. Newly supplied originals are stored with deterministic content hashes and responsive 640/1280/2560 renditions; an existing pointing portrait is reused. The intro follows a native CSS scroll timeline when supported, with one rAF transform fallback and no smoothed chase or per-frame child transforms. Reduced-motion remains a static reading layout.

Authored display-group tags join the requested shoots without altering person tags or grades: Hongjia/Helsinki, Jianji & Xinyi across Croatia and Florence, the two Lijiang shoots, and an Appenzell travel story. Single-frame shoots do not get standalone headings; multiple remaining singles can share one quiet Portraits selection.

Hero, introduction, process, and gallery placements are reserved separately to avoid repeated images on the same page. The former Florence process image now belongs to Jianji & Xinyi's gallery; no empty photo column remains in the process section.
