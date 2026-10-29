# Booking portfolio presentation — 2026-10-29

Booking work uses approved session photographs and excludes the photographer's own model tag, withdrawn booking samples, and generic personal-cover frames that have neither a model nor a shoot tag. The ordinary portfolio and curation ratings remain separate.

Roles are stored as topic tags: `display:booking-hero` selects the original-resolution opening photograph, `display:booking-process` selects the unique process illustration, and `display:exclude-booking` withdraws a photograph from booking promotion and its portrait-book entry. Hero and process photographs are reserved before assembling the gallery, so they do not repeat in another section.

Current placements: Rico's Zermatt portrait 2872 is the hero; Florence frame 2868 appears once in the process section. Hongjia's Oeschinen-series frames 2875 and 2883 are withdrawn from booking display. Ratings and publication flags were not modified. Eight other Swiss photographs remain across the hero and series gallery.

The introduction retains its scrolling typography without personal-photo triptychs. The generic Portraits pile is split using real shoot/location metadata. Gallery sources are original-file references with responsive 640/1280/2560 display candidates, including correct width descriptors for vertical pictures. Booking lightbox IDs now resolve the verified high-resolution rendition.

Ziyang's stored selection is 12 photographs: two approved, two unreviewed, eight trashed. The display code does not promote unreviewed photographs or restore trash automatically; all remain available in the private library.

Validation: TypeScript, production build, curation/placement regression checks, and DPR-2 WebKit checks for original hero pixels, stable series, zero intro photos, no repeated casework images, responsive gallery sources, lightbox resolution, both languages and mobile landscape.
