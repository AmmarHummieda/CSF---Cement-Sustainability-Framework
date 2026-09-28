const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const SOURCE_FILE = path.join(__dirname, "..", "CSF_vLatest.sol");
const EXPECTED_SHA256 = "11fec39aafef28742ffd7e193cb54987a1b54c8bd7d9cc52dc5b14c4c1774bf3";

const source = readFileSync(SOURCE_FILE);
const actual = createHash("sha256").update(source).digest("hex");

if (actual !== EXPECTED_SHA256) {
  throw new Error(
    `CSF_vLatest.sol integrity check failed: expected ${EXPECTED_SHA256}, received ${actual}`
  );
}

console.log(`CSF_vLatest.sol SHA-256 verified: ${actual}`);
