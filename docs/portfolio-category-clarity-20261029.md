# Classification loading and first-photo clarity — 2026-10-29

The classification cards previously waited until they were near the viewport before fetching a 282 KB response. They now receive one approved first frame per category with the initial portfolio payload, and fetch a small rotation pool in the background. Tags and categories both participate in the existing master-image rule. A decoded image no longer causes the current cover to be unnecessarily replaced.

The shared, tagged server cache preserves the existing category members, ordering and clicked-picture behavior. The style viewer calls that loader directly, removing its HTTP round trip back into the same site. Browser preview caches also follow curation changes and exclude withdrawn IDs immediately.

427 currently published photographs received bounded WebP display renditions with a maximum edge of 2560 pixels. Original files, database records, publication flags and ratings were not changed. The client registry contains only stable IDs, source fingerprints and dimensions, not storage URLs. New uploads generate the same size. Sources smaller than 2560 are not enlarged.

The viewer measures its stage and pixel density before selecting 1280 or the verified larger rendition. It decodes that image before entrance, and no longer overlays a full original after a 1.1-second delay. Responsive first-image preloads use the same display sizes. The decoded neighbor cache stays bounded at five images.

Validation: TypeScript, production build, curation/seed regression checks, exact before/after API picture-ID and order comparisons, and a WebKit context at DPR 2. With the classification API held pending, all four seeded cards were enabled and had images. The 40 KB preview response returned in 4–25 ms on warm local cache. The first desktop image used a 2560-pixel rendition immediately and kept the same source after 2.2 seconds; forward/back navigation and mobile landscape passed without full-original requests or page errors.
