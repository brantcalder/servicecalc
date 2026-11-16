import assert from "node:assert/strict";
import test from "node:test";
import { calculatePriceBreakdown } from "./calculator-pricing.js";

test("converts customer input units to the configured weight rate unit", () => {
  const result = calculatePriceBreakdown(
    {
      dimension: "weight",
      inputUnit: "grams",
      rateUnit: "kilograms",
      ratePerUnit: 15,
    },
    [{ measure: 250, quantity: 2 }],
  );

  assert.equal(result.totalMeasureBase, 500);
  assert.equal(result.totalPriceCents, 750);
  assert.deepEqual(result.linePriceCents, [750]);
});

test("converts pounds to kilograms before calculating the rate", () => {
  const result = calculatePriceBreakdown(
    {
      dimension: "weight",
      inputUnit: "pounds",
      rateUnit: "kilograms",
      ratePerUnit: 15,
    },
    [{ measure: 1, quantity: 1 }],
  );

  assert.equal(result.totalPriceCents, 680);
});

test("uses the same conversion model for length and area", () => {
  const length = calculatePriceBreakdown(
    {
      dimension: "length",
      inputUnit: "centimeters",
      rateUnit: "meters",
      ratePerUnit: 2,
    },
    [{ measure: 100, quantity: 1 }],
  );
  const area = calculatePriceBreakdown(
    {
      dimension: "area",
      inputUnit: "squareCentimeters",
      rateUnit: "squareMeters",
      ratePerUnit: 3,
    },
    [{ measure: 10000, quantity: 1 }],
  );
  const volume = calculatePriceBreakdown(
    {
      dimension: "volume",
      inputUnit: "milliliters",
      rateUnit: "liters",
      ratePerUnit: 7.5,
    },
    [{ measure: 1000, quantity: 1 }],
  );

  assert.equal(length.totalPriceCents, 200);
  assert.equal(area.totalPriceCents, 300);
  assert.equal(volume.totalPriceCents, 750);
});

test("prices an item count using the configured quantity field", () => {
  const result = calculatePriceBreakdown(
    {
      dimension: "per_item",
      inputUnit: "items",
      rateUnit: "items",
      ratePerUnit: 2.5,
    },
    [{ measure: 4, quantity: 4 }],
  );

  assert.equal(result.totalMeasureBase, 4);
  assert.equal(result.totalPriceCents, 1000);
});

test("allocates rounded cents across item rows without changing the order total", () => {
  const result = calculatePriceBreakdown(
    {
      dimension: "weight",
      inputUnit: "grams",
      rateUnit: "kilograms",
      ratePerUnit: 0.06,
    },
    [
      { measure: 100, quantity: 1 },
      { measure: 100, quantity: 1 },
    ],
  );

  assert.equal(result.totalPriceCents, 1);
  assert.equal(
    result.linePriceCents.reduce((total, cents) => total + cents, 0),
    result.totalPriceCents,
  );
});
