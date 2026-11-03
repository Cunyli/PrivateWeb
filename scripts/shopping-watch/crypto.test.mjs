import assert from "node:assert/strict";
import test from "node:test";

import { decodeCatalog, encodeCatalog } from "../../lib/shopping-watch-crypto.mjs";

// Synthetic test input only; no deployed credential is read or written by these tests.
const secret = "synthetic-test-storage-secret-for-shopping-catalog";
const catalog = {
  schemaVersion: 1,
  items: [{ id: "test-chair", name: "黑色椅子", price: 149.99, shipping: null }],
  campaigns: [],
};

function flipByte(base64) {
  const bytes = Buffer.from(base64, "base64");
  bytes[0] ^= 1;
  return bytes.toString("base64");
}

test("catalog round-trips through the versioned authenticated envelope", () => {
  const envelope = encodeCatalog(catalog, secret);
  assert.equal(envelope.format, "shopping-aes256gcm-v1");
  assert.equal(Buffer.from(envelope.iv, "base64").length, 12);
  assert.equal(Buffer.from(envelope.tag, "base64").length, 16);
  assert.deepEqual(decodeCatalog(JSON.parse(JSON.stringify(envelope)), secret), catalog);
  assert.equal(JSON.stringify(envelope).includes("test-chair"), false);
});

test("each encoding uses a fresh random IV and distinct ciphertext", () => {
  const first = encodeCatalog(catalog, secret);
  const second = encodeCatalog(catalog, secret);
  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.data, second.data);
  assert.deepEqual(decodeCatalog(first, secret), decodeCatalog(second, secret));
});

test("a wrong key fails authentication", () => {
  const envelope = encodeCatalog(catalog, secret);
  assert.throws(() => decodeCatalog(envelope, "another-synthetic-storage-secret"));
});

test("tampering with IV, authentication tag or ciphertext fails authentication", () => {
  const envelope = encodeCatalog(catalog, secret);
  for (const field of ["iv", "tag", "data"]) {
    assert.throws(() => decodeCatalog({ ...envelope, [field]: flipByte(envelope[field]) }, secret));
  }
});

test("plaintext and incorrect format are never accepted as encrypted catalogs", () => {
  assert.throws(() => decodeCatalog(catalog, secret), /plaintext is not accepted/);
  const envelope = encodeCatalog(catalog, secret);
  assert.throws(() => decodeCatalog({ ...envelope, format: "other-format-v1" }, secret), /plaintext is not accepted/);
  assert.throws(() => decodeCatalog(null, secret), /plaintext is not accepted/);
});

test("base64 fields have strict encoding and IV/tag lengths", () => {
  const envelope = encodeCatalog(catalog, secret);
  assert.throws(() => decodeCatalog({ ...envelope, iv: "AAAA" }, secret), /exactly 12 bytes/);
  assert.throws(() => decodeCatalog({ ...envelope, tag: "AAAA" }, secret), /exactly 16 bytes/);
  assert.throws(() => decodeCatalog({ ...envelope, data: "" }, secret), /canonical base64/);
  assert.throws(() => decodeCatalog({ ...envelope, iv: `${envelope.iv}\n` }, secret), /canonical base64/);
  assert.throws(() => decodeCatalog({ ...envelope, data: "____" }, secret), /canonical base64/);
  // AB== has nonzero unused bits: Node decodes it, but a canonical writer emits AA==.
  assert.throws(() => decodeCatalog({ ...envelope, data: "AB==" }, secret), /padding bits/);
});

test("missing secrets and non-object catalogs are rejected", () => {
  assert.throws(() => encodeCatalog(catalog, ""), /nonempty storage secret/);
  assert.throws(() => encodeCatalog([], secret), /JSON object/);
  assert.throws(() => encodeCatalog(null, secret), /JSON object/);
});
