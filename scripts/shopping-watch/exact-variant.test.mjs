import assert from "node:assert/strict"
import test from "node:test"
import { parseProductJsonLd, parseSyliusVariant } from "./parse-source.mjs"

const html = value => `<script type="application/ld+json">${JSON.stringify(value)}</script>`
const offer = { "@type": "Offer", priceCurrency: "EUR", price: 77.97, availability: "https://schema.org/InStock" }
const item = { url: "https://www.bergfreunde.fi/quest/", monitor: { match: ["Quest"], variantSku: "exact-m", color: "Green", size: "M" } }
const group = { "@type": "ProductGroup", name: "Quest", hasVariant: [
  { "@type": "Product", sku: "cheap-s", color: "Green", size: "S", offers: { ...offer, price: 49 } },
  { "@type": "Product", sku: "exact-m", color: "Green", size: "M", offers: offer },
] }
test("exact group SKU uses its own price; size mismatch and missing SKU reject", () => {
  assert.equal(parseProductJsonLd(html(group), item).price, 77.97)
  assert.equal(parseProductJsonLd(html([group, { "@type": "Product", name: "Quest", offers: { ...offer, price: 49 } }]), item).price, 77.97)
  assert.throws(() => parseProductJsonLd(html(group), { ...item, monitor: { ...item.monitor, size: "L" } }), /size changed/)
  assert.throws(() => parseProductJsonLd(html(group), { ...item, monitor: { ...item.monitor, variantSku: "gone" } }), /SKU/)
})
test("Prisma selects exactly the configured GTIN and named shop, never national fallback", () => {
  const local = { ...offer, seller: { name: "Prisma Tripla" }, availableAtOrFrom: { name: "Prisma Tripla" } }
  const page = { "@type": "Product", gtin13: "123", offers: [{ ...offer, price: 49 }, local] }
  const target = { url: "https://www.prisma.fi/123", monitor: { gtin: "123", seller: "Prisma Tripla" } }
  assert.equal(parseProductJsonLd(html(page), target).price, 77.97)
  assert.throws(() => parseProductJsonLd(html({ ...page, offers: [offer] }), target), /single Offer/)
  assert.throws(() => parseProductJsonLd(html({ ...page, gtin13: "456" }), target), /found 0/)
})
const syliusItem = { monitor: { match: ["Falketind"], color: "Sininen", size: "M", colorCode: "blue", sizeCode: "m" } }
const sylius = `<title>Falketind</title><div data-color-code="blue" data-color-translation="Sininen"></div>
  <select><option value="m">M</option></select>
  <div data-Taille="l" data-Couleur="multi" data-price="27900" data-value="279,00 €"></div>
  <div data-Taille="m" data-Couleur="blue" data-price="32900" data-value="329,00 €"></div>
  <div class="few-in-stock" data-Taille="m" data-Couleur="blue">Vain 3 jäljellä varastossa</div>`
test("Sylius maps stock and price to exact color/size, rejecting ambiguity and changed labels", () => {
  assert.equal(parseSyliusVariant(sylius, syliusItem).price, 329)
  assert.equal(parseSyliusVariant(sylius, syliusItem).stockStatus, "in_stock")
  assert.equal(parseSyliusVariant(sylius.replace("Vain 3", "Vain 0"), syliusItem).stockStatus, "out_of_stock")
  assert.throws(() => parseSyliusVariant(sylius + sylius, syliusItem), /ambiguous/)
  assert.throws(() => parseSyliusVariant(sylius.replace('translation="Sininen"', 'translation="Beige"'), syliusItem), /color identity/)
})
