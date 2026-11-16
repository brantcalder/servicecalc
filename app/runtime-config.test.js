import assert from "node:assert/strict";
import test from "node:test";

import { validateRuntimeConfig } from "./runtime-config.js";

test("validateRuntimeConfig rejects missing required variables", () => {
  const env = { ...process.env };

  delete process.env.SHOPIFY_API_KEY;
  delete process.env.SHOPIFY_API_SECRET;
  delete process.env.SHOPIFY_APP_URL;
  delete process.env.SCOPES;
  delete process.env.DATABASE_URL;

  assert.throws(() => validateRuntimeConfig(), /DATABASE_URL/);

  process.env = env;
});

test("validateRuntimeConfig accepts valid production settings", () => {
  const env = { ...process.env };

  process.env.SHOPIFY_API_KEY = "test-key";
  process.env.SHOPIFY_API_SECRET = "test-secret";
  process.env.SHOPIFY_APP_URL = "https://example.com";
  process.env.SCOPES = "write_products,read_products";
  process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/servicecalc";

  const config = validateRuntimeConfig();
  assert.equal(config.apiKey, "test-key");
  assert.equal(config.appUrl, "https://example.com");
  assert.deepEqual(config.scopes, ["write_products", "read_products"]);

  process.env = env;
});
