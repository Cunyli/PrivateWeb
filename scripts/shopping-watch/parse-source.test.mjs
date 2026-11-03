import assert from "node:assert/strict";
import test from "node:test";

import { fetchObservation, parseProductJsonLd, parseShopifyProduct } from "./parse-source.mjs";

const tv = { url: "https://www.verkkokauppa.com/fi/product/123/tcl-55c6k", monitor: { kind: "jsonld", match: ["TCL", "55C6K"] } };
const offer = { "@type": "Offer", price: "599.00", priceCurrency: "EUR", availability: "https://schema.org/InStock" };
const product = { "@type": "Product", name: 'TCL 55" C6K Mini LED', model: "55C6K", offers: offer };
const html = (value) => `<html><script type="application/ld+json">${JSON.stringify(value)}</script></html>`;
const chair = {
  url: "https://eu.sihoo.com/products/m102c",
  monitor: { kind: "shopify", endpoint: "https://eu.sihoo.com/products/m102c.js", variantId: 222, currency: "EUR" },
};
const chairProduct = {
  title: "Sihoo M102C",
  variants: [
    { id: 111, title: "White", price: 12_999, available: true },
    { id: 222, title: "Black", price: 14_999, available: false },
  ],
};

test("single EUR Product Offer is matched by model and records InStock", () => {
  const result = parseProductJsonLd(html(product), tv);
  assert.equal(result.price, 599);
  assert.equal(result.stockStatus, "in_stock");
});

test("a recommendation price cannot masquerade as the target price", () => {
  const page = {
    ...product,
    offers: undefined,
    isRelatedTo: { ...product, name: "Recommended TCL 55C6K", offers: { ...offer, price: "99.00" } },
  };
  assert.throws(() => parseProductJsonLd(html(page), tv), /single Offer/);
});

test("Product recommendation inside ItemList is not used", () => {
  const page = { "@type": "ItemList", itemListElement: [{ item: product }] };
  assert.throws(() => parseProductJsonLd(html(page), tv), /found 0/);
});

test("AggregateOffer is rejected rather than using its lowPrice", () => {
  const page = { ...product, offers: { "@type": "AggregateOffer", lowPrice: 499, highPrice: 899, priceCurrency: "EUR" } };
  assert.throws(() => parseProductJsonLd(html(page), tv), /AggregateOffer/);
});

test("non-EUR offer is rejected", () => {
  assert.throws(() => parseProductJsonLd(html({ ...product, offers: { ...offer, priceCurrency: "USD" } }), tv), /EUR currency/);
});

test("zero is rejected as an unavailable or placeholder price", () => {
  assert.throws(() => parseProductJsonLd(html({ ...product, offers: { ...offer, price: 0 } }), tv), /greater than zero/);
});

test("multiple offers and multiple matching Products are rejected", () => {
  assert.throws(() => parseProductJsonLd(html({ ...product, offers: [offer, offer] }), tv), /multiple offers/);
  assert.throws(() => parseProductJsonLd(html([product, product]), tv), /found 2/);
});

test("ProductGroup / hasVariant cannot supply an exact-variant price", () => {
  assert.throws(() => parseProductJsonLd(html({ ...product, hasVariant: [product] }), tv), /multi-variant/);
});

test("SoldOut is recorded as out_of_stock", () => {
  const result = parseProductJsonLd(html({ ...product, offers: { ...offer, availability: "https://schema.org/SoldOut" } }), tv);
  assert.equal(result.stockStatus, "out_of_stock");
});

test("missing availability is unknown, never presumed in stock", () => {
  const result = parseProductJsonLd(html({ ...product, offers: { ...offer, availability: undefined } }), tv);
  assert.equal(result.stockStatus, "unknown");
});

test("@graph Product is supported and unrelated Products are skipped", () => {
  const page = { "@context": "https://schema.org", "@graph": [
    { "@type": "WebPage", name: "Store" },
    { ...product, name: "Other TV", model: "42V6", offers: { ...offer, price: "199.00" } },
    { ...product, "@type": "https://schema.org/Product" },
  ] };
  assert.equal(parseProductJsonLd(html(page), tv).price, 599);
});

test("an exact product URL can identify a Product without monitor tokens", () => {
  const item = { url: tv.url, monitor: { kind: "jsonld" } };
  assert.equal(parseProductJsonLd(html({ ...product, url: tv.url }), item).price, 599);
  assert.throws(() => parseProductJsonLd(html(product), item), /found 0/);
});

test("plain text prices and non-JSON-LD scripts are never used", () => {
  assert.throws(() => parseProductJsonLd(`<p>599 EUR</p><script type="application/json">${JSON.stringify(product)}</script>`, tv), /no application\/ld\+json/);
  assert.throws(() => parseProductJsonLd(`<script data-type="application/ld+json">${JSON.stringify(product)}</script>`, tv), /no application\/ld\+json/);
});

test("Shopify chooses the exact black variant, not the cheapest white variant", () => {
  const result = parseShopifyProduct(chairProduct, chair);
  assert.equal(result.price, 149.99);
  assert.equal(result.stockStatus, "out_of_stock");
  assert.match(result.evidenceNote, /Black/);
});

test("Shopify accepts a string variant ID but never chooses a missing variant", () => {
  assert.equal(parseShopifyProduct(chairProduct, { ...chair, monitor: { ...chair.monitor, variantId: "222" } }).price, 149.99);
  assert.throws(() => parseShopifyProduct(chairProduct, { ...chair, monitor: { ...chair.monitor, variantId: 333 } }), /found 0/);
  assert.throws(() => parseShopifyProduct(chairProduct, { ...chair, monitor: { kind: "shopify", currency: "EUR" } }), /exact numeric/);
});

test("Shopify requires API currency or an explicitly configured EUR storefront", () => {
  assert.throws(() => parseShopifyProduct({ ...chairProduct, currency: "USD" }, chair), /EUR currency/);
  assert.throws(() => parseShopifyProduct(chairProduct, { ...chair, monitor: { ...chair.monitor, currency: undefined } }), /EUR currency/);
  assert.equal(parseShopifyProduct({ ...chairProduct, currency: "EUR" }, { ...chair, monitor: { ...chair.monitor, currency: undefined } }).price, 149.99);
});

test("Shopify rejects decimal euro strings, zero prices and unknown availability", () => {
  const withVariant = (changes) => ({ ...chairProduct, variants: [{ ...chairProduct.variants[1], ...changes }] });
  assert.throws(() => parseShopifyProduct(withVariant({ price: "149.99" }), chair), /integer number of cents/);
  assert.throws(() => parseShopifyProduct(withVariant({ price: 0 }), chair), /greater than zero/);
  assert.throws(() => parseShopifyProduct(withVariant({ available: undefined }), chair), /must be a boolean/);
});

test("manual, HTTP and non-allowlisted sources fail before a request", async () => {
  await assert.rejects(fetchObservation({ url: tv.url, monitor: { kind: "manual" } }), /Manual source/);
  await assert.rejects(fetchObservation({ ...tv, url: "http://www.verkkokauppa.com/test" }), /only HTTPS/);
  await assert.rejects(fetchObservation({ ...tv, url: "https://unrelated.example/test" }), /not allowlisted/);
});

test("fetch stops on rate limiting, cross-merchant redirects and CAPTCHA", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("rate limited", { status: 429 }));
  await assert.rejects(fetchObservation(tv), /HTTP 429/);
  globalThis.fetch.mock.mockImplementation(async () => new Response(null, {
    status: 302, headers: { location: "https://www.ikea.com/fi/fi/" },
  }));
  await assert.rejects(fetchObservation(tv), /changed merchant/);
  globalThis.fetch.mock.mockImplementation(async () => new Response("<html><title>CAPTCHA required</title></html>"));
  await assert.rejects(fetchObservation(tv), /CAPTCHA/);
});

test("fetch accepts same-merchant redirects and rejects oversized content", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests += 1;
    return requests === 1
      ? new Response(null, { status: 301, headers: { location: "https://verkkokauppa.com/fi/product/123/tcl-55c6k" } })
      : new Response(html(product));
  });
  assert.equal((await fetchObservation(tv)).price, 599);
  assert.equal(requests, 2);
  globalThis.fetch.mock.mockImplementation(async () => new Response("small body", { headers: { "content-length": String(2 * 1024 * 1024 + 1) } }));
  await assert.rejects(fetchObservation(tv), /2 MiB/);
});

test("fetch stops after three redirects and applies the limit to streamed bytes", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests += 1;
    return new Response(null, { status: 302, headers: { location: "/same-merchant-redirect" } });
  });
  await assert.rejects(fetchObservation(tv), /maximum 3 redirects/);
  assert.equal(requests, 4);
  globalThis.fetch.mock.mockImplementation(async () => new Response("x".repeat(2 * 1024 * 1024 + 1)));
  await assert.rejects(fetchObservation(tv), /2 MiB/);
});
