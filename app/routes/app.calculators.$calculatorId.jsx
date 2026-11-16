/* eslint-disable react/prop-types */
import React from "react";
import { Form, useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import {
  calculatorConfigFromForm,
  createDefaultCalculatorConfig,
  DEFAULT_TOTAL_MEASURE_DECIMAL_PLACES,
  DIMENSIONS,
  FIELD_TYPES,
  MAX_FIELDS_PER_GROUP,
  TOTAL_MEASURE_DECIMAL_PLACES,
} from "../calculator-config";
import { getCalculator, saveCalculator } from "../calculators.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ params, request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shopResponse = await admin.graphql(
    `#graphql
      query CalculatorEditorShopCurrency {
        shop {
          currencyCode
        }
      }`,
  );
  const shopData = await shopResponse.json();
  const currencyCode = shopData.data?.shop?.currencyCode;
  if (!shopResponse.ok || shopData.errors || !currencyCode) {
    console.error(
      "Could not retrieve the shop currency for the calculator editor.",
    );
    throw new Response("Could not load the shop currency.", { status: 502 });
  }

  const calculator = await getCalculator(
    admin,
    session.shop,
    params.calculatorId,
  );
  if (!calculator) throw new Response("Calculator not found.", { status: 404 });
  return { calculator, currencyCode };
};

export const action = async ({ params, request }) => {
  const { admin, session } = await authenticate.admin(request);
  const calculator = await getCalculator(
    admin,
    session.shop,
    params.calculatorId,
  );
  if (!calculator) throw new Response("Calculator not found.", { status: 404 });

  const formData = await request.formData();
  const name = formData.get("name");
  const { config, errors } = calculatorConfigFromForm(
    formData,
    calculator.config,
  );
  if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
    errors.name = "Enter a calculator name of 1-100 characters.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      calculator: { ...calculator, name, config },
      errors,
      saved: false,
    };
  }

  const saved = await saveCalculator(
    admin,
    session.shop,
    calculator.id,
    name.trim(),
    config,
  );
  return { calculator: saved, errors: {}, saved: true };
};

function fieldRole(fieldId, measureFieldId, quantityFieldId) {
  if (fieldId === measureFieldId) return "measurement";
  if (fieldId === quantityFieldId) return "quantity";
  return null;
}

function FieldBuilder({
  fields,
  onChange,
  group,
  error,
  measureFieldId,
  quantityFieldId,
}) {
  const lockedFieldIds = [measureFieldId, quantityFieldId].filter(Boolean);
  const additionalFieldCount = fields.filter(
    (field) => !lockedFieldIds.includes(field.id),
  ).length;

  const updateField = (index, key, value) => {
    const field = fields[index];
    if (
      [measureFieldId, quantityFieldId].includes(field.id) &&
      (key === "type" || key === "required")
    ) {
      return;
    }
    onChange(
      fields.map((field, currentIndex) =>
        currentIndex === index ? { ...field, [key]: value } : field,
      ),
    );
  };

  const moveField = (index, offset) => {
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= fields.length) return;
    const updated = [...fields];
    [updated[index], updated[targetIndex]] = [
      updated[targetIndex],
      updated[index],
    ];
    onChange(updated);
  };

  const addField = () => {
    if (additionalFieldCount >= MAX_FIELDS_PER_GROUP) return;
    const id = `field-${crypto.randomUUID()}`;
    onChange([
      ...fields,
      {
        id,
        label: "New field",
        type: "text",
        placeholder: "",
        helpText: "",
        required: false,
        options: [],
        min: "",
        max: "",
        step: "",
        defaultValue: "",
      },
    ]);
  };

  return (
    <s-stack direction="block" gap="base">
      {error && <s-banner tone="critical">{error}</s-banner>}
      {fields.map((field, index) => {
        const role = fieldRole(field.id, measureFieldId, quantityFieldId);
        return (
          <s-box
            key={field.id}
            padding="base"
            border="base"
            borderRadius="base"
          >
            <s-stack direction="block" gap="base">
              {role && (
                <s-stack direction="inline" gap="small" alignItems="center">
                  <s-icon type="info" tone="info" size="small" />
                  <s-text tone="subdued" fontWeight="base">
                    {role === "measurement"
                      ? "Measurement field — required number used to calculate the charge."
                      : "Quantity field — required number of this item to include in the calculation."}{" "}
                    This field cannot be removed or changed to another type.
                  </s-text>
                </s-stack>
              )}

              <s-grid
                gridTemplateColumns="minmax(0, 1fr) minmax(0, 1fr)"
                gap="base"
                alignItems="end"
              >
                <s-text-field
                  label="Field label"
                  value={field.label}
                  maxlength="100"
                  required
                  onInput={(event) =>
                    updateField(index, "label", event.currentTarget.value)
                  }
                />
                <s-select
                  label="Field type"
                  value={field.type}
                  disabled={Boolean(role)}
                  onChange={(event) =>
                    updateField(index, "type", event.currentTarget.value)
                  }
                >
                  {FIELD_TYPES.map((type) => (
                    <s-option key={type} value={type}>
                      {type === "textarea"
                        ? "Long text"
                        : type === "file"
                          ? "File upload"
                          : type.charAt(0).toUpperCase() + type.slice(1)}
                    </s-option>
                  ))}
                </s-select>
              </s-grid>

              <s-grid
                gridTemplateColumns="minmax(0, 1fr) minmax(0, 1fr)"
                gap="base"
                alignItems="end"
              >
                {field.type !== "file" && (
                  <s-text-field
                    label="Placeholder"
                    value={field.placeholder}
                    maxlength="100"
                    onInput={(event) =>
                      updateField(
                        index,
                        "placeholder",
                        event.currentTarget.value,
                      )
                    }
                  />
                )}
                <s-text-field
                  label="Help text"
                  value={field.helpText}
                  maxlength="100"
                  onInput={(event) =>
                    updateField(index, "helpText", event.currentTarget.value)
                  }
                />
              </s-grid>

              {field.type === "select" && (
                <s-text-field
                  label="Options (separate with commas)"
                  value={field.options.join(", ")}
                  required
                  onInput={(event) =>
                    updateField(
                      index,
                      "options",
                      event.currentTarget.value
                        .split(",")
                        .map((option) => option.trim())
                        .filter(Boolean),
                    )
                  }
                />
              )}

              {field.type === "number" && (
                <s-grid
                  gridTemplateColumns="repeat(3, minmax(0, 1fr))"
                  gap="base"
                  alignItems="end"
                >
                  {["min", "max", "step"].map((key) => (
                    <s-text-field
                      key={key}
                      label={
                        key === "min"
                          ? "Minimum"
                          : key === "max"
                            ? "Maximum"
                            : "Step (number or any)"
                      }
                      value={field[key]}
                      onInput={(event) =>
                        updateField(index, key, event.currentTarget.value)
                      }
                    />
                  ))}
                </s-grid>
              )}

              {field.type === "checkbox" ? (
                <s-checkbox
                  label="Checked by default"
                  checked={field.defaultValue === "true"}
                  onChange={(event) =>
                    updateField(
                      index,
                      "defaultValue",
                      event.currentTarget.checked ? "true" : "false",
                    )
                  }
                />
              ) : field.type !== "file" ? (
                <s-text-field
                  label="Default value"
                  value={field.defaultValue}
                  maxlength="500"
                  onInput={(event) =>
                    updateField(
                      index,
                      "defaultValue",
                      event.currentTarget.value,
                    )
                  }
                />
              ) : null}

              <s-checkbox
                label="Required"
                checked={Boolean(role) || field.required}
                disabled={Boolean(role)}
                onChange={(event) =>
                  updateField(index, "required", event.currentTarget.checked)
                }
              />

              <s-stack direction="inline" gap="base">
                <s-button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveField(index, -1)}
                >
                  Move up
                </s-button>
                <s-button
                  type="button"
                  disabled={index === fields.length - 1}
                  onClick={() => moveField(index, 1)}
                >
                  Move down
                </s-button>
                {!role && (
                  <s-button
                    type="button"
                    onClick={() =>
                      onChange(
                        fields.filter(
                          (_, currentIndex) => currentIndex !== index,
                        ),
                      )
                    }
                  >
                    Remove field
                  </s-button>
                )}
              </s-stack>
            </s-stack>
          </s-box>
        );
      })}

      <s-button
        type="button"
        disabled={additionalFieldCount >= MAX_FIELDS_PER_GROUP}
        onClick={addField}
      >
        Add field
      </s-button>
      <input type="hidden" name={group} value={JSON.stringify(fields)} />
    </s-stack>
  );
}

function errorsSummary(errors) {
  return Object.entries(errors).map(
    ([field, message]) => `${field}: ${message}`,
  );
}

export default function CalculatorEditor() {
  const { calculator: loadedCalculator, currencyCode } = useLoaderData();
  const actionData = useActionData();
  const calculator = actionData?.calculator ?? loadedCalculator;
  const errors = actionData?.errors ?? {};
  const [itemFields, setItemFields] = React.useState(
    calculator?.config?.itemFields ??
      createDefaultCalculatorConfig().itemFields,
  );
  const [orderFields, setOrderFields] = React.useState(
    calculator?.config?.orderFields ??
      createDefaultCalculatorConfig().orderFields,
  );
  const [dimension, setDimension] = React.useState(calculator.config.dimension);
  const [inputUnit, setInputUnit] = React.useState(calculator.config.inputUnit);
  const [rateUnit, setRateUnit] = React.useState(calculator.config.rateUnit);
  const [totalMeasureDecimalPlaces, setTotalMeasureDecimalPlaces] =
    React.useState(
      calculator.config.totalMeasureDecimalPlaces ??
        DEFAULT_TOTAL_MEASURE_DECIMAL_PLACES,
    );
  const measureFieldId = calculator.config.measureFieldId;
  const quantityFieldId = calculator.config.quantityFieldId;
  const [inlineFields, setInlineFields] = React.useState(
    calculator.config.inlineFields,
  );
  const [labels, setLabels] = React.useState(calculator.config.labels);

  const changeDimension = (event) => {
    const nextDimension = event.currentTarget.value;
    const next = DIMENSIONS[nextDimension] ? nextDimension : "weight";
    const previousLabel = `Total ${DIMENSIONS[dimension].totalLabel}`;
    setDimension(next);
    setInputUnit(DIMENSIONS[next].inputUnit);
    setRateUnit(DIMENSIONS[next].rateUnit);
    setLabels((current) => ({
      ...current,
      totalMeasure:
        current.totalMeasure === previousLabel
          ? `Total ${DIMENSIONS[next].totalLabel}`
          : current.totalMeasure,
    }));
  };

  return (
    <s-page heading={calculator.name}>
      <Form method="post">
        <s-stack direction="block" gap="large">
          <s-section heading="Calculator">
            <s-stack direction="block" gap="base">
              <s-text-field
                name="name"
                label="Calculator name"
                value={calculator.name}
                maxlength="100"
                required
                error={errors.name}
              />
              <s-select
                name="dimension"
                label="What is this calculator charging for?"
                value={dimension}
                onChange={changeDimension}
              >
                {Object.entries(DIMENSIONS).map(([key, value]) => (
                  <s-option key={key} value={key}>
                    {key === "per_item"
                      ? "Per item"
                      : value.label.charAt(0).toUpperCase() +
                        value.label.slice(1)}
                  </s-option>
                ))}
              </s-select>
              <s-grid
                gridTemplateColumns="repeat(3, minmax(0, 1fr))"
                gap="base"
                alignItems="end"
              >
                <s-text-field
                  name="ratePerUnit"
                  type="number"
                  label={`Rate (${currencyCode})`}
                  prefix="$"
                  value={String(calculator.config.ratePerUnit)}
                  min="0.01"
                  max="1000000"
                  step="0.01"
                  required
                  error={errors.ratePerUnit}
                />
                <s-select
                  name="inputUnit"
                  label="Customer input unit"
                  value={inputUnit}
                  error={errors.inputUnit}
                  onChange={(event) => setInputUnit(event.currentTarget.value)}
                >
                  {Object.entries(DIMENSIONS[dimension].units).map(
                    ([key, unit]) => (
                      <s-option key={key} value={key}>
                        {unit.label}
                      </s-option>
                    ),
                  )}
                </s-select>
                <s-select
                  name="rateUnit"
                  label="Rate unit"
                  value={rateUnit}
                  error={errors.rateUnit}
                  onChange={(event) => setRateUnit(event.currentTarget.value)}
                >
                  {Object.entries(DIMENSIONS[dimension].units).map(
                    ([key, unit]) => (
                      <s-option key={key} value={key}>
                        {unit.label}
                      </s-option>
                    ),
                  )}
                </s-select>
              </s-grid>
              <s-select
                name="totalMeasureDecimalPlaces"
                label="Decimal places in total measurement"
                value={String(totalMeasureDecimalPlaces)}
                error={errors.totalMeasureDecimalPlaces}
                onChange={(event) =>
                  setTotalMeasureDecimalPlaces(
                    Number(event.currentTarget.value),
                  )
                }
              >
                {TOTAL_MEASURE_DECIMAL_PLACES.map((places) => (
                  <s-option key={places} value={String(places)}>
                    {places}
                  </s-option>
                ))}
              </s-select>
              <input
                type="hidden"
                name="measureFieldId"
                value={measureFieldId}
              />
              <input
                type="hidden"
                name="quantityFieldId"
                value={quantityFieldId}
              />
            </s-stack>
          </s-section>

          <s-section
            heading="Item fields"
            subheading={`Arrange fields in the order customers should see them. Measurement and quantity are required number fields. Add up to ${MAX_FIELDS_PER_GROUP} more fields to each section.`}
          >
            <s-stack direction="block" gap="base">
              <FieldBuilder
                fields={itemFields}
                onChange={setItemFields}
                group="itemFields"
                error={errors.itemFields}
                measureFieldId={measureFieldId}
                quantityFieldId={quantityFieldId}
              />
              <s-checkbox
                label="Display item fields inline"
                checked={inlineFields}
                onChange={(event) =>
                  setInlineFields(event.currentTarget.checked)
                }
              />
              <input
                type="hidden"
                name="inlineFields"
                value={inlineFields ? "true" : "false"}
              />
            </s-stack>
          </s-section>

          <s-section
            heading="Order fields"
            subheading="These fields appear once for the whole order."
          >
            <FieldBuilder
              fields={orderFields}
              onChange={setOrderFields}
              group="orderFields"
              error={errors.orderFields}
            />
          </s-section>

          <s-section heading="Customer-facing text">
            <s-stack direction="block" gap="base">
              {Object.entries({
                calculatorTitle: "Calculator title",
                itemsHeading: "Items heading",
                itemPrefix: "Item row prefix",
                addItem: "Add item button",
                removeItem: "Remove item button",
                totalMeasure: "Total measurement label",
                totalCharge: "Total charge label",
                submit: "Checkout button",
                processing: "Checkout loading button",
              }).map(([key, label]) => (
                <s-text-field
                  key={key}
                  name={`label.${key}`}
                  label={label}
                  value={labels[key]}
                  maxlength="100"
                  required
                  error={errors[`label.${key}`]}
                  onInput={(event) => {
                    const value = event.currentTarget.value;
                    setLabels((current) => ({
                      ...current,
                      [key]: value,
                    }));
                  }}
                />
              ))}
            </s-stack>
          </s-section>

          {Object.keys(errors).length > 0 && (
            <s-banner tone="critical">
              <s-stack direction="block" gap="small">
                <s-paragraph>Review these settings and try again.</s-paragraph>
                {errorsSummary(errors).map((error) => (
                  <s-paragraph key={error}>{error}</s-paragraph>
                ))}
              </s-stack>
            </s-banner>
          )}
          {actionData?.saved && (
            <s-banner tone="success">Calculator saved.</s-banner>
          )}

          <s-button type="submit" variant="primary">
            Save calculator
          </s-button>
        </s-stack>
      </Form>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
