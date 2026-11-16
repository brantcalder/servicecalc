import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatorConfigFromForm,
  createDefaultCalculatorConfig,
  DEFAULT_LABELS,
  normalizeCalculatorConfig,
} from "./calculator-config.js";

function formFor(config) {
  const form = new FormData();
  form.set("dimension", config.dimension);
  form.set("inputUnit", config.inputUnit);
  form.set("rateUnit", config.rateUnit);
  form.set("ratePerUnit", String(config.ratePerUnit));
  form.set(
    "totalMeasureDecimalPlaces",
    String(config.totalMeasureDecimalPlaces ?? 3),
  );
  form.set("measureFieldId", config.measureFieldId);
  form.set("quantityFieldId", config.quantityFieldId);
  form.set("inlineFields", String(config.inlineFields));
  form.set("itemFields", JSON.stringify(config.itemFields));
  form.set("orderFields", JSON.stringify(config.orderFields));
  for (const [key, value] of Object.entries(config.labels)) {
    form.set(`label.${key}`, value);
  }
  return form;
}

test("accepts the default builder configuration and custom field types", () => {
  const config = createDefaultCalculatorConfig();
  config.itemFields.push({
    id: "finish",
    label: "Finish",
    type: "select",
    placeholder: "",
    helpText: "Choose a finish",
    required: true,
    options: ["Gloss", "Matte"],
    min: "",
    max: "",
    step: "",
    defaultValue: "Gloss",
  });
  config.orderFields.push({
    id: "reference-file",
    label: "Reference file",
    type: "file",
    placeholder: "",
    helpText: "",
    required: false,
    options: [],
    min: "",
    max: "",
    step: "",
    defaultValue: "",
  });

  const result = calculatorConfigFromForm(formFor(config), config);

  assert.deepEqual(result.errors, {});
  assert.equal(result.config.itemFields[3].options[1], "Matte");
  assert.equal(result.config.orderFields[2].type, "file");
});

test("locks measurement and quantity roles to distinct required number fields", () => {
  const config = createDefaultCalculatorConfig();
  config.measureFieldId = "description";
  config.quantityFieldId = "";
  config.itemFields[0].required = false;

  const result = calculatorConfigFromForm(formFor(config), config);

  assert.deepEqual(result.errors, {});
  const measurement = result.config.itemFields.find(
    (field) => field.id === result.config.measureFieldId,
  );
  const quantity = result.config.itemFields.find(
    (field) => field.id === result.config.quantityFieldId,
  );
  assert.notEqual(measurement.id, quantity.id);
  assert.equal(measurement.type, "number");
  assert.equal(measurement.required, true);
  assert.equal(quantity.type, "number");
  assert.equal(quantity.required, true);
  assert.equal(quantity.defaultValue, "1");
});

test("adds missing role fields when normalizing older calculator configs", () => {
  const config = createDefaultCalculatorConfig();
  config.dimension = "per_item";
  config.inputUnit = "items";
  config.rateUnit = "items";
  config.measureFieldId = "";
  config.quantityFieldId = "";
  config.itemFields = config.itemFields.filter(
    (field) => field.id !== "quantity",
  );

  const result = calculatorConfigFromForm(formFor(config), config);

  assert.deepEqual(result.errors, {});
  assert.ok(
    result.config.itemFields.some(
      (field) => field.id === result.config.measureFieldId,
    ),
  );
  assert.ok(
    result.config.itemFields.some(
      (field) => field.id === result.config.quantityFieldId,
    ),
  );
  assert.notEqual(result.config.measureFieldId, result.config.quantityFieldId);
});

test("requires non-empty customer-facing labels", () => {
  const config = createDefaultCalculatorConfig();
  config.labels = { ...DEFAULT_LABELS, submit: "" };

  const result = calculatorConfigFromForm(formFor(config), config);

  assert.match(result.errors["label.submit"], /1-100 characters/);
});

test("saves a configured number of total measurement decimal places", () => {
  const config = createDefaultCalculatorConfig();
  config.totalMeasureDecimalPlaces = 5;

  const result = calculatorConfigFromForm(formFor(config), config);

  assert.deepEqual(result.errors, {});
  assert.equal(result.config.totalMeasureDecimalPlaces, 5);
});

test("rejects unsupported total measurement decimal places", () => {
  const config = createDefaultCalculatorConfig();
  const form = formFor(config);
  form.set("totalMeasureDecimalPlaces", "7");

  const result = calculatorConfigFromForm(form, config);

  assert.match(result.errors.totalMeasureDecimalPlaces, /between 0 and 6/);
});

test("defaults old calculator configurations to three decimal places", () => {
  const config = createDefaultCalculatorConfig();
  delete config.totalMeasureDecimalPlaces;

  assert.equal(normalizeCalculatorConfig(config).totalMeasureDecimalPlaces, 3);
});
