# Shopping watch

The private `/shopping` page keeps furniture, appliances and outdoor gear candidates in one place. It reuses the existing admin login and AAL2 check. `/api/shopping` is private and never returns credentials. Entry links are in the admin dashboard and private AI feed.

The checked-in `data/shopping-watch/catalog.json` is an empty template. Personal candidates, budgets, priorities, historical purchasing context and preferences must never be committed to this public repository. The live catalog is the encrypted R2 object `shopping-watch/catalog-v1.json`. Catalog encryption uses AES-256-GCM and a purpose-specific HKDF key derived server-side from the existing R2 secret; the public image bucket cannot reveal its contents. Rotating that secret requires re-encrypting the catalog with the new secret or reseeding it. Browser favorites, target prices, purchases and notes stay in localStorage on that browser; they are not uploaded.

## Update and review

Run from the portfolio checkout with Node 22 or newer and its existing environment:

```sh
node scripts/shopping-watch/update.mjs
node scripts/shopping-watch/update.mjs --dry-run
node scripts/shopping-watch/update.mjs --export tmp/shopping-current.json
node scripts/shopping-watch/update.mjs --apply-curation tmp/shopping-current.json
```

`--env /absolute/path/to/.env` can select the configured local environment. Never print that file or copy credentials into the catalog. Writes use the read ETag and fail on concurrent modification. Every write is read back. `--apply-curation` also rejects a file exported before a newer catalog update. Ordinary runs update data without deploying the website.

The local Codex heartbeat is intended to run every ten minutes while the Mac and Codex are available. The page polls its authenticated API every minute while visible. Polling does not itself fetch merchants. Every item has its own successful price check time; the run time is not substituted for it. Failed and manual sources keep their prior quotation and are shown as requiring review. HTTP 403/429/challenges get a six-hour backoff, without bypasses. A late or unavailable run remains visible in the status line.

`outputs/shopping-watch/latest-catalog.json` contains private local working data; `logs/shopping-watch/` holds bounded run summaries. These files are ignored by Git. They contain public merchant data, not tokens or browser notes.

## Evidence rules

- Keep exact model, color, size and membership terms with the quote. A cheapest collection price is not the price of every size. Shopify checks require an exact variant and an explicitly configured EUR storefront. General product checks accept one matching Product with one EUR Offer.
- IKEA Family offers remain manual when structured data only exposes the ordinary price. A national catalog availability flag is not stock at the delivery address or local shop.
- Missing shipping stays `null`, and the basket lists how many fees remain unknown. Do not infer a final delivered total from a starting delivery price.
- The merchant's 30-day low has a separate check time. It cannot become fresh when only the current price is fetched. Its discount badge expires after a day until reviewed. Never use crossed-out MSRP as an actual historical transaction price.
- Price changes return the item to review. An expired sale, failed price observation or stale quote cannot retain a current purchase endorsement. Linked campaign prices must match their candidate; campaign failures and stale reviews become unknown.
- Personal shopping requirements and budgets belong in the encrypted live catalog. Preserve previous candidates and historical baselines during updates. Compare actual model identities rather than similar marketing labels.
- Historical collection or delivery quotes remain dated planning inputs. Compare a full route and current commercial terms before recommending a delivery method.

For curation, export the current live state, edit that file from current official merchant evidence, then apply it. Update `checkedAt` and `priceVerifiedAt` only for claims actually checked; update `low30VerifiedAt` only when that historical-price claim was checked. Clear a campaign's `observation.changed` only after reviewing its new terms. Preserve unrelated items and browser-owned state.

## Verification

```sh
node --test scripts/shopping-watch/*.test.mjs
pnpm exec tsc --noEmit --incremental false
pnpm build
node scripts/check-security-hardening.cjs
```

Browser QA uses a disposable fixture under ignored `tmp/`, with a test data provider. It does not add a production login bypass. Verify the real API returns 401 to an anonymous request, as well as desktop/mobile filters, basket persistence, target editing and keyboard dismissal.
