import assert from "node:assert/strict";
import test from "node:test";

import { campaignSourceHash, campaignSourceSignals } from "./campaign-source.mjs";

test("English dates retain day and year changes", () => {
  const before = "<main>Black Friday starts November 6, 2026</main>";
  assert.notEqual(campaignSourceHash(before), campaignSourceHash(before.replace("November 6", "November 7")));
  assert.notEqual(campaignSourceHash(before), campaignSourceHash(before.replace("2026", "2027")));
  assert.ok(campaignSourceSignals(before).includes("november 6, 2026"));
});

test("abbreviated compact English date ranges preserve both ends", () => {
  const before = "<main>Black Friday Nov.6–Dec.2</main>";
  assert.notEqual(campaignSourceHash(before), campaignSourceHash(before.replace("Nov.6", "Nov.7")));
  assert.notEqual(campaignSourceHash(before), campaignSourceHash(before.replace("Dec.2", "Dec.3")));
  assert.ok(campaignSourceSignals(before).includes("nov.6-dec.2"));
});

test("Finnish numeric dates and ranges work with optional years", () => {
  for (const suffix of [".", ".2026"]) {
    assert.notEqual(campaignSourceHash(`<main>Black Week 6.11${suffix}</main>`), campaignSourceHash(`<main>Black Week 7.11${suffix}</main>`));
  }
  assert.notEqual(campaignSourceHash("<main>Black Week 6.–27.11.</main>"), campaignSourceHash("<main>Black Week 7.–27.11.</main>"));
  assert.notEqual(campaignSourceHash("<main>6.11.2026–2.12.2026</main>"), campaignSourceHash("<main>6.11.2027–2.12.2027</main>"));
});

test("Finnish month names and ISO dates retain the complete date", () => {
  assert.notEqual(campaignSourceHash("<main>Alkaa 6 marraskuuta 2026</main>"), campaignSourceHash("<main>Alkaa 7 marraskuuta 2026</main>"));
  assert.notEqual(campaignSourceHash("<main>2026-11-06</main>"), campaignSourceHash("<main>2026-11-07</main>"));
});

test("amount and discount changes affect the offer hash", () => {
  for (const [before, after] of [["€30", "€40"], ["149,99 €", "139,99 €"], ["20%", "25%"], ["EUR 499", "EUR 599"]]) {
    assert.notEqual(campaignSourceHash(`<main>${before}</main>`), campaignSourceHash(`<main>${after}</main>`));
  }
});

test("unrelated script changes and countdown seconds do not change the hash", () => {
  const page = (seconds, script) => `<script>${script}</script><main><p>Black Friday November 6, 2026: €30 off</p><div class="countdown">20 days 12:34:${seconds}<span>${seconds} seconds</span></div></main>`;
  assert.equal(campaignSourceHash(page(10, 'track("€100", "November 1")')), campaignSourceHash(page(9, 'track("€999", "November 2")')));
  assert.equal(campaignSourceHash("<main>Black Friday in 15 seconds</main>"), campaignSourceHash("<main>Black Friday in 14 seconds</main>"));
});

test("main content is preferred to unrelated navigation and footer offers", () => {
  const page = (footer) => `<nav>€999</nav><main>Black Friday November 6 €30</main><footer>${footer}</footer>`;
  assert.equal(campaignSourceHash(page("€100")), campaignSourceHash(page("€200")));
});

test("markup, entities and event completion remain meaningful", () => {
  const before = "<main>Black Friday Nov.<span>6</span>&ndash;Dec.<span>2</span> &euro;30</main>";
  assert.ok(campaignSourceSignals(before).some(signal => signal.includes("6-dec.")));
  assert.notEqual(campaignSourceHash("<main>Black Friday</main>"), campaignSourceHash("<main>Black Friday has ended</main>"));
});
