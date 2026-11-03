import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const FORMAT = "shopping-aes256gcm-v1";
const HKDF_SALT = Buffer.from("lijie-shopping-watch/hkdf-salt/v1", "utf8");
const HKDF_INFO = Buffer.from("private-shopping-catalog/aes-256-gcm/key/v1", "utf8");
const AAD = Buffer.from("private-shopping-catalog/v1", "utf8");
const IV_BYTES = 12;
const TAG_BYTES = 16;
const CANONICAL_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function catalogKey(secret) {
  if (typeof secret !== "string" || secret.length === 0) {
    throw new TypeError("Shopping catalog encryption requires a nonempty storage secret");
  }
  // HKDF separates catalog encryption from the R2 credential's original use.
  // Versioned salt/info and AAD prevent reuse as another object's encryption key
  // or interchange with a different envelope protocol. The secret stays in memory.
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), HKDF_SALT, HKDF_INFO, 32));
}

function base64Bytes(value, field, expectedLength) {
  if (typeof value !== "string" || value.length === 0 || !CANONICAL_BASE64.test(value)) {
    throw new Error(`Shopping catalog ${field} must be nonempty canonical base64`);
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) {
    throw new Error(`Shopping catalog ${field} contains noncanonical base64 padding bits`);
  }
  if (expectedLength !== undefined && bytes.length !== expectedLength) {
    throw new Error(`Shopping catalog ${field} must decode to exactly ${expectedLength} bytes`);
  }
  return bytes;
}

function assertCatalog(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Shopping catalog must be a JSON object");
  }
}

/** Encrypt the complete catalog before writing to a potentially public asset bucket. */
export function encodeCatalog(catalog, secret) {
  assertCatalog(catalog);
  const serialized = JSON.stringify(catalog);
  if (typeof serialized !== "string") throw new TypeError("Shopping catalog must serialize to JSON");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", catalogKey(secret), iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(AAD);
  const data = Buffer.concat([cipher.update(serialized, "utf8"), cipher.final()]);
  return {
    format: FORMAT,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  };
}

/** Authenticate before parsing; plaintext, malformed envelopes and wrong keys fail closed. */
export function decodeCatalog(envelope, secret) {
  if (envelope === null || typeof envelope !== "object" || Array.isArray(envelope)
    || envelope.format !== FORMAT) {
    throw new Error(`Shopping catalog must use encrypted envelope format ${FORMAT}; plaintext is not accepted`);
  }
  const iv = base64Bytes(envelope.iv, "iv", IV_BYTES);
  const tag = base64Bytes(envelope.tag, "tag", TAG_BYTES);
  const data = base64Bytes(envelope.data, "data");
  const decipher = createDecipheriv("aes-256-gcm", catalogKey(secret), iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(AAD);
  decipher.setAuthTag(tag);
  // final() verifies the GCM tag and throws on any key/header/ciphertext mismatch.
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  const catalog = JSON.parse(plaintext.toString("utf8"));
  assertCatalog(catalog);
  return catalog;
}
