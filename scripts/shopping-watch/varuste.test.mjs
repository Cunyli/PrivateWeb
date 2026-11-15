import assert from "node:assert/strict"
import test from "node:test"
import { parseVarusteVariant } from "./parse-source.mjs"

const item = { monitor: { productId: "123", properties: { 1: "green" }, match: ["Example", "Tent"], variantLabel: "Green" } }
const html = `<title>Example Tent</title><div id="cart_box100"><form>
  <meta itemprop="price" content="299.90"><meta itemprop="priceCurrency" content="EUR">
  <link itemprop="availability" href="https://schema.org/InStock">
  <input name="_tuoteid" value="123"><input id="cart_box100_omin_property_type_1" name="_omin[]" value="green">
  <div id="vapaana123"></div></form></div>`
test("Varuste selected cart price is isolated from recommendations", () => {
  const result = parseVarusteVariant(html + '<meta itemprop="price" content="49.00">', item)
  assert.equal(result.price, 299.9); assert.equal(result.stockStatus, "in_stock")
})
test("Varuste rejects missing size, changed product identity and ambiguous currency", () => {
  assert.throws(() => parseVarusteVariant(html.replace('value="green"', ''), item), /every exact/)
  assert.throws(() => parseVarusteVariant(html, { monitor: { ...item.monitor, properties: { 1: "green", 2: "m" } } }), /every exact/)
  assert.throws(() => parseVarusteVariant(html.replace('value="123"', 'value="456"'), item), /ID changed/)
  assert.throws(() => parseVarusteVariant(html.replace('content="EUR"', 'content="USD"'), item), /EUR/)
})
