const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

// Exact hosts keep a watch-list endpoint from becoming an arbitrary URL fetcher.
const MERCHANT_HOSTS = new Map([
  ["sihoo", ["eu.sihoo.com", "de.sihoo.com", "sihoooffice.com", "www.sihoooffice.com", "de.sihoooffice.com", "eu.sihoooffice.com"]],
  ["hbada", ["hbada.eu", "www.hbada.eu", "hbada.com", "www.hbada.com", "eu.hbada.com"]],
  ["masku", ["masku.com", "www.masku.com"]],
  ["jysk", ["jysk.fi", "www.jysk.fi"]],
  ["ikea", ["ikea.com", "www.ikea.com"]],
  ["verkkokauppa", ["verkkokauppa.com", "www.verkkokauppa.com"]],
  ["gigantti", ["gigantti.fi", "www.gigantti.fi"]],
  ["power", ["power.fi", "www.power.fi"]],
  ["proshop", ["proshop.fi", "www.proshop.fi"]],
  ["prisma", ["prisma.fi", "www.prisma.fi"]],
  ["tokmanni", ["tokmanni.fi", "www.tokmanni.fi"]],
  ["clasohlson", ["clasohlson.com", "www.clasohlson.com"]],
  ["krauta", ["k-rauta.fi", "www.k-rauta.fi"]],
  ["puuilo", ["puuilo.fi", "www.puuilo.fi"]],
  ["varuste", ["varuste.net", "www.varuste.net", "viranomainen.fi", "www.viranomainen.fi"]],
  ["scandinavianoutdoor", ["scandinavianoutdoor.fi", "www.scandinavianoutdoor.fi", "scandinavianoutdoor.com", "www.scandinavianoutdoor.com"]],
  ["partioaitta", ["partioaitta.fi", "www.partioaitta.fi"]],
  ["xxl", ["xxl.fi", "www.xxl.fi"]],
  ["helsinkioutlet", ["helsinkioutlet.fi", "www.helsinkioutlet.fi"]],
  ["patagonia", ["eu.patagonia.com"]],
  ["arcteryx", ["arcteryx.com", "www.arcteryx.com", "outlet.arcteryx.com"]],
  ["hardloop", ["hardloop.fi", "www.hardloop.fi"]],
  ["halti", ["halti.fi", "www.halti.fi"]],
  ["haglofs", ["haglofs.com", "www.haglofs.com"]],
  ["norrona", ["norrona.com", "www.norrona.com"]],
]);
const MERCHANT_BY_HOST = new Map(
  [...MERCHANT_HOSTS].flatMap(([merchant, hosts]) => hosts.map((host) => [host, merchant])),
);

function schemaType(value, expected) {
  const types = Array.isArray(value) ? value : [value];
  return types.some((type) => typeof type === "string"
    && type.split(/[\/#]/).filter(Boolean).at(-1)?.toLowerCase() === expected.toLowerCase());
}

function assertEuro(currency, context) {
  if (typeof currency !== "string" || currency.toUpperCase() !== "EUR") {
    throw new Error(`${context}: explicit EUR currency is required; received ${String(currency)}`);
  }
}

function positivePrice(value, context) {
  if ((typeof value !== "number" && typeof value !== "string")
    || (typeof value === "string" && !/^\d+(?:\.\d{1,2})?$/.test(value.trim()))) {
    throw new Error(`${context}: price must be a plain euro amount with at most two decimal places`);
  }
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0 || price > 100_000) {
    throw new Error(`${context}: price must be greater than zero and at most 100000 EUR`);
  }
  return Math.round(price * 100) / 100;
}

function normalizedUrl(value, base) {
  if (typeof value !== "string" || !value.trim()) return null;
  const url = new URL(value, base);
  if (url.protocol !== "https:" || url.username || url.password) return null;
  url.hash = "";
  url.hostname = url.hostname.replace(/^www\./, "");
  url.pathname = url.pathname.replace(/\/$/, "");
  return `${url.origin}${url.pathname}${url.search}`;
}

function primitiveText(value) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "";
}

function productMatches(product, item) {
  const match = item.monitor?.match;
  if (match !== undefined && (!Array.isArray(match)
    || match.some((token) => typeof token !== "string" || !token.trim()))) {
    throw new Error("JSON-LD: monitor.match must be an array of nonempty strings");
  }
  const identity = [product.name, product.model, product.sku].map(primitiveText).join(" ").toLowerCase();
  const tokensMatch = Array.isArray(match) && match.length > 0
    && match.every((token) => identity.includes(token.trim().toLowerCase()));
  const productUrl = normalizedUrl(product.url, item.url);
  const targetUrl = normalizedUrl(item.url);
  const urlMatches = productUrl !== null && targetUrl !== null && productUrl === targetUrl;
  return tokensMatch || urlMatches;
}

function productNodes(value) {
  if (Array.isArray(value)) return value.flatMap(productNodes);
  if (value === null || typeof value !== "object") return [];
  const products = schemaType(value["@type"], "Product") ? [value] : [];
  // Do not recurse through ItemList, recommendations, isRelatedTo or nested offers.
  if (Array.isArray(value["@graph"])) products.push(...value["@graph"].flatMap(productNodes));
  return products;
}

function imageUrl(value, base) {
  const candidates = Array.isArray(value) ? value : [value];
  for (const candidate of candidates) {
    const raw = typeof candidate === "string" ? candidate : candidate?.url ?? candidate?.contentUrl;
    if (typeof raw !== "string" || !raw.trim()) continue;
    const url = new URL(raw, base);
    if (url.protocol === "https:" && !url.username && !url.password) return url.href;
  }
  return undefined;
}

function offerStock(availability) {
  const status = typeof availability === "string"
    ? availability.split(/[\/#]/).filter(Boolean).at(-1)?.toLowerCase() : "";
  if (status === "instock") return { stockStatus: "in_stock", stockNote: "商品结构化数据标记有货；结账前复核。" };
  if (status === "limitedavailability") return { stockStatus: "in_stock", stockNote: "商品结构化数据标记库存有限；结账前复核。" };
  if (["outofstock", "soldout", "discontinued"].includes(status)) {
    return { stockStatus: "out_of_stock", stockNote: `商品结构化数据标记 ${availability}。` };
  }
  if (["preorder", "presale", "backorder"].includes(status)) {
    return { stockStatus: "unknown", stockNote: `商品标记 ${availability}；不计为现货。` };
  }
  return { stockStatus: "unknown", stockNote: "未取得明确现货状态；需要在商家页面确认。" };
}

/** Parse a Shopify /products/<handle>.js response; its variant prices are cents. */
export function parseShopifyProduct(json, item) {
  const product = json?.product ?? json;
  if (!product || typeof product !== "object" || !Array.isArray(product.variants)) {
    throw new Error("Shopify: expected a product with a variants array");
  }
  const variantId = item.monitor?.variantId;
  if ((typeof variantId !== "number" && typeof variantId !== "string")
    || !/^\d+$/.test(String(variantId))) {
    throw new Error("Shopify: an exact numeric monitor.variantId is required");
  }
  const matches = product.variants.filter((variant) => String(variant.id) === String(variantId));
  if (matches.length !== 1) {
    throw new Error(`Shopify: expected exactly one variant ${variantId}; found ${matches.length}`);
  }
  const variant = matches[0];
  const sourceCurrency = json.currency ?? product.currency;
  const currency = sourceCurrency ?? item.monitor?.currency;
  assertEuro(currency, "Shopify");
  if (typeof variant.price !== "number" || !Number.isSafeInteger(variant.price)) {
    throw new Error("Shopify: variant.price must be an integer number of cents from the product.js API");
  }
  if (typeof variant.available !== "boolean") {
    throw new Error("Shopify: exact variant.available must be a boolean");
  }
  const productIdentity = { name: product.title, model: product.handle, sku: variant.sku, url: product.url };
  if (item.monitor?.match?.length && !productMatches(productIdentity, item)) {
    throw new Error("Shopify: product identity does not match the monitored product");
  }
  const price = positivePrice(variant.price / 100, "Shopify");
  const image = imageUrl(variant.featured_image?.src ?? variant.featured_image ?? product.featured_image, item.url);
  return {
    price,
    stockStatus: variant.available ? "in_stock" : "out_of_stock",
    stockNote: variant.available
      ? `所选${variant.title || "款式"}可售；芬兰配送和交期在结账时确认。`
      : `所选${variant.title || "款式"}目前不可售。`,
    ...(image ? { image } : {}),
    evidenceNote: `Shopify 商品接口；精确变体 ${variantId}${variant.title ? `（${variant.title}）` : ""}；${sourceCurrency ? "接口币种 EUR" : "店面币种配置 EUR，接口未返回币种"}。`,
  };
}

/** Read only top-level / @graph Products in application/ld+json script elements. */
export function parseProductJsonLd(html, item) {
  if (typeof html !== "string") throw new Error("JSON-LD: expected an HTML string");
  const products = [];
  let scriptCount = 0;
  for (const script of html.matchAll(/<script(?=[\s>])([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const type = script[1].match(/(?:^|\s)type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if ((type?.[1] ?? type?.[2] ?? type?.[3] ?? "").trim().toLowerCase() !== "application/ld+json") continue;
    scriptCount += 1;
    const payload = script[2].replace(/^\uFEFF/, "").trim();
    if (!payload) throw new Error(`JSON-LD: script ${scriptCount} is empty`);
    let value;
    try {
      value = JSON.parse(payload);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      throw new Error(`JSON-LD: script ${scriptCount} contains invalid JSON: ${error.message}`, { cause: error });
    }
    products.push(...productNodes(value));
  }
  if (scriptCount === 0) throw new Error("JSON-LD: no application/ld+json script found");
  const matches = products.filter((product) => productMatches(product, item));
  if (matches.length !== 1) {
    throw new Error(`JSON-LD: expected one matching top-level Product; found ${matches.length}`);
  }
  const product = matches[0];
  if (schemaType(product["@type"], "ProductGroup")
    || product.hasVariant !== undefined || product.variesBy !== undefined) {
    throw new Error("JSON-LD: multi-variant Product / ProductGroup is not an exact purchasable variant");
  }
  const offers = Array.isArray(product.offers) ? product.offers : [product.offers];
  if (offers.length !== 1 || !offers[0] || typeof offers[0] !== "object") {
    throw new Error("JSON-LD: expected a single Offer; multiple offers or missing offers are ambiguous");
  }
  const offer = offers[0];
  if (schemaType(offer["@type"], "AggregateOffer")) {
    throw new Error("JSON-LD: AggregateOffer is a price range, not an exact product price");
  }
  if (!schemaType(offer["@type"], "Offer")) throw new Error("JSON-LD: offers must explicitly have @type Offer");
  assertEuro(offer.priceCurrency, "JSON-LD Offer");
  const price = positivePrice(offer.price, "JSON-LD Offer");
  const image = imageUrl(product.image, item.url);
  return {
    price,
    ...offerStock(offer.availability),
    ...(image ? { image } : {}),
    evidenceNote: "官方商品页欧元报价；商品身份与所选款一致，未采用推荐商品或集合起价。",
  };
}

function approvedUrl(value, merchant) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("Source URL: only HTTPS without credentials or a custom port is allowed");
  }
  const actualMerchant = MERCHANT_BY_HOST.get(url.hostname);
  if (!actualMerchant) throw new Error(`Source URL: merchant host ${url.hostname} is not allowlisted`);
  if (merchant && actualMerchant !== merchant) {
    throw new Error(`Source URL: redirect or endpoint changed merchant to ${url.hostname}`);
  }
  return { url, merchant: actualMerchant };
}

async function limitedResponseText(response) {
  const size = response.headers.get("content-length");
  if (size && Number(size) > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new Error("Source response exceeds the 2 MiB limit");
  }
  if (!response.body) throw new Error("Source response has no body");
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Source response exceeds the 2 MiB limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}

function hasAccessChallenge(html) {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] ?? "";
  return /captcha|access denied|just a moment|verify (?:you are|that you are) human|robot check/i.test(title)
    || /id\s*=\s*["']challenge-form["']/i.test(html)
    || /<h[12]\b[^>]*>\s*(?:verify (?:you are|that you are) human|complete the captcha|access denied)/i.test(html);
}

/** Fetch one allowlisted public product source without bypassing access challenges. */
export async function fetchObservation(item) {
  const kind = item.monitor?.kind ?? item.monitor?.type;
  if (kind === "manual" || !kind) throw new Error("Manual source: automatic observation is unavailable; check the merchant page manually");
  if (!["shopify", "jsonld"].includes(kind)) throw new Error(`Unsupported monitor kind: ${kind}`);
  const productUrl = approvedUrl(item.url);
  let current = approvedUrl(item.monitor.endpoint ?? item.url, productUrl.merchant).url;
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      signal,
      headers: {
        "User-Agent": "FinlandShoppingWatch/1.0 (personal product price monitor)",
        Accept: kind === "shopify" ? "application/json" : "text/html,application/xhtml+xml",
      },
    });
    if (REDIRECT_STATUSES.has(response.status)) {
      await response.body?.cancel();
      if (redirects === MAX_REDIRECTS) throw new Error("Source redirect limit exceeded (maximum 3 redirects)");
      const location = response.headers.get("location");
      if (!location) throw new Error("Source redirect has no Location header");
      current = approvedUrl(new URL(location, current).href, productUrl.merchant).url;
      continue;
    }
    if (response.status === 403 || response.status === 429) {
      await response.body?.cancel();
      throw new Error(`Source HTTP ${response.status}: access restricted or rate limited; no bypass attempted`);
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Source HTTP ${response.status}`);
    }
    const text = await limitedResponseText(response);
    if (hasAccessChallenge(text)) throw new Error("Source access challenge / CAPTCHA detected; no bypass attempted");
    if (kind === "jsonld") return parseProductJsonLd(text, item);
    let json;
    try {
      json = JSON.parse(text);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      throw new Error(`Shopify: response is not valid JSON: ${error.message}`, { cause: error });
    }
    return parseShopifyProduct(json, item);
  }
  throw new Error("Source redirect limit exceeded");
}
