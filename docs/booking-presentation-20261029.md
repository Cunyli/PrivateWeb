# Booking portfolio presentation — 2026-10-29

Booking client work uses rating-1 photographs and excludes the photographer's own model tag, dedicated intro photos, and withdrawn samples. No unmarked or rating-0 photograph is promoted by the display rules.

The opening portrait is Ziyang's DSC04154 (2830), using its existing original. Ziyang's Stockholm frames are excluded from the series gallery without changing their ratings. Hongjia's Oeschinen frames remain excluded; Helsinki frames stay together.

The photographer introduction uses three explicit ordered display tags, `display:booking-intro-1` through `-3`. It displays only these approved portraits, separately from client casework. Newly supplied originals are stored with deterministic content hashes and responsive 640/1280/2560 renditions; an existing pointing portrait is reused. The intro follows a native CSS scroll timeline when supported, with one rAF transform fallback and no smoothed chase or per-frame child transforms. Reduced-motion remains a static reading layout.

Authored display-group tags join the requested shoots: Hongjia/Helsinki, Jianji & Xinyi across Croatia and Barcelona, the two Lijiang shoots, and David/Switzerland. Person tags are corrected only using the owner's explicit filename or identity confirmation. Single-frame shoots do not get standalone headings; multiple remaining singles can share one quiet Portraits selection.

Hero, introduction, process, and gallery placements are reserved separately to avoid repeated images on the same page. The owner corrected the former Florence and final Appenzell frames out of client casework. Why me uses explicit ordered process placements, with left-side text and a sticky image on the right. The sequence advances once through the chosen pictures rather than cycling modulo the text count; only the shown/departing/requested/next images are mounted.


Confirmed filename corrections: DSC09457 (2385), DSC00373 (2815), and the sharper existing DSC00471 variant (2493) join Jianji & Xinyi's two confirmed frames. The duplicated, softer 00471 record is not added to this gallery. David/Switzerland contains four frames; 2881 is explicitly identified by the owner as their own portrait and moves to Why me together with 2868.

Why me's ordered selection is DSC05245 (2604), DSC01164 (2530), DSC00309 (2814), DSC08848 (2523), DSC05236 (2858), DSC08353 (2868), and DSC07046 (2881). Only 2858 required a rating change: the owner explicitly approved marking it 1. All other stored ratings were preserved. Client series order stays unchanged.


The selected fixed asset master1 (-2) closes the Why me sequence as its eighth image. Its existing public 1280×1920 display file is used directly; the private original remains undeployed and no duplicate database record or rating is created.

Portrait book quality: retain device density up to 3x within a 6 MP / GPU-dimension bound, including curling-page overscan. Dense displays avoid redundant multisample antialiasing; low-density displays retain it. The same higher-density page texture and surface render the resting spread and moving leaf, so there is no content-owner handoff or change to turn geometry/state. Existing responsive source pixels already exceed the displayed photo areas.
