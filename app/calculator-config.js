export const MAX_FIELDS_PER_GROUP = 100;
export const MAX_OPTIONS_PER_FIELD = 100;
export const MAX_FIELD_LABEL_LENGTH = 100;
export const MAX_FIELD_VALUE_LENGTH = 500;
export const TOTAL_MEASURE_DECIMAL_PLACES = [0, 1, 2, 3, 4, 5, 6];
export const DEFAULT_TOTAL_MEASURE_DECIMAL_PLACES = 3;

export const DIMENSIONS = {
  weight: {
    label: "weight",
    totalLabel: "weight",
    units: {
      grams: { label: "grams", shortLabel: "g", factor: 1 },
      kilograms: { label: "kilograms", shortLabel: "kg", factor: 1000 },
      pounds: { label: "pounds", shortLabel: "lb", factor: 453.59237 },
      ounces: { label: "ounces", shortLabel: "oz", factor: 28.349523125 },
    },
    inputUnit: "grams",
    rateUnit: "kilograms",
  },
  length: {
    label: "length",
    totalLabel: "length",
    units: {
      millimeters: { label: "millimeters", shortLabel: "mm", factor: 1 },
      centimeters: { label: "centimeters", shortLabel: "cm", factor: 10 },
      meters: { label: "meters", shortLabel: "m", factor: 1000 },
      inches: { label: "inches", shortLabel: "in", factor: 25.4 },
      feet: { label: "feet", shortLabel: "ft", factor: 304.8 },
    },
    inputUnit: "centimeters",
    rateUnit: "meters",
  },
  volume: {
    label: "volume",
    totalLabel: "volume",
    units: {
      milliliters: { label: "milliliters", shortLabel: "mL", factor: 1 },
      liters: { label: "liters", shortLabel: "L", factor: 1000 },
      fluidOunces: {
        label: "US fluid ounces",
        shortLabel: "fl oz",
        factor: 29.5735295625,
      },
      gallons: { label: "US gallons", shortLabel: "gal", factor: 3785.411784 },
    },
    inputUnit: "milliliters",
    rateUnit: "liters",
  },
  area: {
    label: "area",
    totalLabel: "area",
    units: {
      squareCentimeters: {
        label: "square centimeters",
        shortLabel: "cm²",
        factor: 1,
      },
      squareMeters: {
        label: "square meters",
        shortLabel: "m²",
        factor: 10000,
      },
      squareInches: {
        label: "square inches",
        shortLabel: "in²",
        factor: 6.4516,
      },
      squareFeet: {
        label: "square feet",
        shortLabel: "ft²",
        factor: 929.0304,
      },
    },
    inputUnit: "squareCentimeters",
    rateUnit: "squareMeters",
  },
  per_item: {
    label: "item",
    totalLabel: "items",
    units: {
      items: { label: "items", shortLabel: "items", factor: 1 },
    },
    inputUnit: "items",
    rateUnit: "items",
  },
};

export const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "select",
  "checkbox",
  "email",
  "date",
  "file",
];

export const DEFAULT_LABELS = {
  calculatorTitle: "ServiceCalc",
  itemsHeading: "Enter your items",
  itemPrefix: "Item",
  addItem: "Add another item",
  removeItem: "Remove item",
  totalMeasure: "Total weight",
  totalCharge: "Estimated firing charge",
  submit: "Continue to checkout",
  processing: "Preparing checkout…",
};

const LABEL_KEYS = Object.keys(DEFAULT_LABELS);
const FIELD_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

function createField(id, label, type, values = {}) {
  return {
    id,
    label,
    type,
    placeholder: "",
    helpText: "",
    required: false,
    options: [],
    min: "",
    max: "",
    step: "",
    defaultValue: "",
    ...values,
  };
}

function uniqueFieldId(fields, base) {
  let id = base;
  let suffix = 2;
  while (fields.some((field) => field.id === id)) {
    id = `${base}-${suffix++}`;
  }
  return id;
}

function uniqueFieldLabel(fields, base) {
  let label = base;
  let suffix = 2;
  while (
    fields.some(
      (field) => field.label.trim().toLowerCase() === label.toLowerCase(),
    )
  ) {
    label = `${base} ${suffix++}`;
  }
  return label;
}

function createRoleField(fields, role) {
  const isQuantity = role === "quantity";
  const label = uniqueFieldLabel(
    fields,
    isQuantity ? "Quantity" : "Measurement",
  );
  const values = isQuantity
    ? { min: "1", step: "1", defaultValue: "1" }
    : { min: "0.000001", step: "any" };
  const field = createField(
    uniqueFieldId(fields, isQuantity ? "quantity" : "measurement"),
    label,
    "number",
    { required: true, ...values },
  );
  fields.push(field);
  return field;
}

function ensureRoleFields(fields, measureFieldId, quantityFieldId) {
  let measureField = fields.find((field) => field.id === measureFieldId);
  if (!measureField) {
    measureField = fields.find(
      (field) => field.type === "number" && field.id !== quantityFieldId,
    );
  }
  if (!measureField) measureField = createRoleField(fields, "measurement");

  let quantityField = fields.find(
    (field) => field.id === quantityFieldId && field.id !== measureField.id,
  );
  if (!quantityField) {
    quantityField = fields.find(
      (field) => field.type === "number" && field.id !== measureField.id,
    );
  }
  if (!quantityField) quantityField = createRoleField(fields, "quantity");

  measureField.type = "number";
  measureField.required = true;
  quantityField.type = "number";
  quantityField.required = true;
  quantityField.min ||= "1";
  quantityField.step ||= "1";
  quantityField.defaultValue ||= "1";

  return {
    measureFieldId: measureField.id,
    quantityFieldId: quantityField.id,
  };
}

export function createDefaultCalculatorConfig() {
  return {
    dimension: "weight",
    inputUnit: "grams",
    rateUnit: "kilograms",
    ratePerUnit: 15,
    totalMeasureDecimalPlaces: DEFAULT_TOTAL_MEASURE_DECIMAL_PLACES,
    measureFieldId: "weight",
    quantityFieldId: "quantity",
    inlineFields: false,
    itemFields: [
      createField("description", "Item description", "text", {
        required: true,
        placeholder: "Describe this item",
      }),
      createField("weight", "Weight", "number", {
        required: true,
        min: "0.000001",
        step: "any",
      }),
      createField("quantity", "Quantity", "number", {
        required: true,
        min: "1",
        step: "1",
        defaultValue: "1",
      }),
    ],
    orderFields: [
      createField("maker-mark", "Maker's mark", "text"),
      createField("comments", "Comments", "textarea"),
    ],
    labels: { ...DEFAULT_LABELS },
  };
}

function normalizeField(field, index) {
  const source = field && typeof field === "object" ? field : {};
  const type = FIELD_TYPES.includes(source.type) ? source.type : "text";
  const options = Array.isArray(source.options)
    ? source.options
        .filter((option) => typeof option === "string" && option.trim())
        .slice(0, MAX_FIELDS_PER_GROUP)
        .map((option) => option.trim().slice(0, MAX_FIELD_LABEL_LENGTH))
    : [];
  const label =
    typeof source.label === "string" && source.label.trim()
      ? source.label.trim().slice(0, MAX_FIELD_LABEL_LENGTH)
      : `Field ${index + 1}`;
  const id =
    typeof source.id === "string" && FIELD_ID_PATTERN.test(source.id)
      ? source.id
      : `field-${index + 1}`;

  return {
    ...createField(id, label, type),
    placeholder:
      typeof source.placeholder === "string"
        ? source.placeholder.slice(0, MAX_FIELD_LABEL_LENGTH)
        : "",
    helpText:
      typeof source.helpText === "string"
        ? source.helpText.slice(0, MAX_FIELD_LABEL_LENGTH)
        : "",
    required: source.required === true,
    options,
    min: typeof source.min === "string" ? source.min.slice(0, 30) : "",
    max: typeof source.max === "string" ? source.max.slice(0, 30) : "",
    step: typeof source.step === "string" ? source.step.slice(0, 30) : "",
    defaultValue:
      typeof source.defaultValue === "string"
        ? source.defaultValue.slice(0, MAX_FIELD_VALUE_LENGTH)
        : "",
  };
}

export function normalizeCalculatorConfig(value) {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  const source = parsed && typeof parsed === "object" ? parsed : {};
  const dimension = DIMENSIONS[source.dimension] ? source.dimension : "weight";
  const dimensionConfig = DIMENSIONS[dimension];
  const itemFields = Array.isArray(source.itemFields)
    ? source.itemFields.slice(0, MAX_FIELDS_PER_GROUP + 2).map(normalizeField)
    : createDefaultCalculatorConfig().itemFields;
  const orderFields = Array.isArray(source.orderFields)
    ? source.orderFields.slice(0, MAX_FIELDS_PER_GROUP).map(normalizeField)
    : createDefaultCalculatorConfig().orderFields;
  const roleFieldIds = ensureRoleFields(
    itemFields,
    typeof source.measureFieldId === "string" ? source.measureFieldId : "",
    typeof source.quantityFieldId === "string" ? source.quantityFieldId : "",
  );
  const labels =
    source.labels && typeof source.labels === "object" ? source.labels : {};

  return {
    dimension,
    inputUnit: dimensionConfig.units[source.inputUnit]
      ? source.inputUnit
      : dimensionConfig.inputUnit,
    rateUnit: dimensionConfig.units[source.rateUnit]
      ? source.rateUnit
      : dimensionConfig.rateUnit,
    ratePerUnit:
      Number.isFinite(Number(source.ratePerUnit)) &&
      Number(source.ratePerUnit) > 0
        ? Number(source.ratePerUnit)
        : 15,
    totalMeasureDecimalPlaces: TOTAL_MEASURE_DECIMAL_PLACES.includes(
      Number(source.totalMeasureDecimalPlaces),
    )
      ? Number(source.totalMeasureDecimalPlaces)
      : DEFAULT_TOTAL_MEASURE_DECIMAL_PLACES,
    ...roleFieldIds,
    inlineFields: source.inlineFields === true,
    itemFields,
    orderFields,
    labels: Object.fromEntries(
      LABEL_KEYS.map((key) => [
        key,
        typeof labels[key] === "string" && labels[key].trim()
          ? labels[key].trim().slice(0, MAX_FIELD_LABEL_LENGTH)
          : DEFAULT_LABELS[key],
      ]),
    ),
  };
}

function parseFieldList(formData, name, fallback) {
  const value = formData.get(name);
  if (typeof value !== "string") {
    return { fields: fallback, error: "The field list is missing." };
  }

  try {
    const fields = JSON.parse(value);
    if (!Array.isArray(fields)) {
      return { fields: fallback, error: "The field list is invalid." };
    }
    return { fields, error: null };
  } catch {
    return { fields: fallback, error: "The field list is invalid." };
  }
}

function validateFields(
  fields,
  group,
  errors,
  maxFields = MAX_FIELDS_PER_GROUP,
) {
  if (fields.length > maxFields) {
    errors[group] = `Add no more than ${maxFields} fields.`;
  }

  const ids = new Set();
  for (const [index, field] of fields.entries()) {
    if (!field || typeof field !== "object") {
      errors[`${group}.${index}`] = "This field is invalid.";
      continue;
    }
    if (
      typeof field.id !== "string" ||
      !FIELD_ID_PATTERN.test(field.id) ||
      ids.has(field.id)
    ) {
      errors[`${group}.${index}.id`] = "Field IDs must be unique and valid.";
    }
    ids.add(field.id);

    if (
      typeof field.label !== "string" ||
      !field.label.trim() ||
      field.label.trim().length > MAX_FIELD_LABEL_LENGTH
    ) {
      errors[`${group}.${index}.label`] =
        `Enter a field label of 1-${MAX_FIELD_LABEL_LENGTH} characters.`;
    }
    if (!FIELD_TYPES.includes(field.type)) {
      errors[`${group}.${index}.type`] = "Choose a supported field type.";
    }
    if (typeof field.required !== "boolean") {
      errors[`${group}.${index}.required`] =
        "Choose whether this field is required.";
    }
    for (const key of ["placeholder", "helpText"]) {
      if (
        typeof field[key] !== "string" ||
        field[key].length > MAX_FIELD_LABEL_LENGTH
      ) {
        errors[`${group}.${index}.${key}`] =
          `Keep ${key === "helpText" ? "help text" : "placeholder"} to ${MAX_FIELD_LABEL_LENGTH} characters or fewer.`;
      }
    }
    if (
      typeof field.defaultValue !== "string" ||
      field.defaultValue.length > MAX_FIELD_VALUE_LENGTH
    ) {
      errors[`${group}.${index}.defaultValue`] =
        `Keep the default value to ${MAX_FIELD_VALUE_LENGTH} characters or fewer.`;
    }
    if (field.type === "select") {
      if (
        !Array.isArray(field.options) ||
        field.options.length === 0 ||
        field.options.length > MAX_OPTIONS_PER_FIELD ||
        field.options.some(
          (option) =>
            typeof option !== "string" ||
            !option.trim() ||
            option.trim().length > MAX_FIELD_LABEL_LENGTH,
        )
      ) {
        errors[`${group}.${index}.options`] =
          "Add at least one valid option for this select field.";
      }
      if (
        field.defaultValue &&
        Array.isArray(field.options) &&
        !field.options.includes(field.defaultValue)
      ) {
        errors[`${group}.${index}.defaultValue`] =
          "Choose a default value from the select options.";
      }
    }
    if (field.type === "number") {
      for (const key of ["min", "max", "step"]) {
        const value = field[key];
        const isAnyStep = key === "step" && value === "any";
        if (
          value !== "" &&
          !isAnyStep &&
          (!Number.isFinite(Number(value)) ||
            (key === "step" && Number(value) <= 0))
        ) {
          errors[`${group}.${index}.${key}`] =
            key === "step"
              ? "Step must be a positive number."
              : `${key === "min" ? "Minimum" : "Maximum"} must be a number.`;
        }
      }
      if (
        field.min !== "" &&
        field.max !== "" &&
        Number(field.min) > Number(field.max)
      ) {
        errors[`${group}.${index}.max`] =
          "Maximum must be greater than or equal to minimum.";
      }
    }
  }

  const fieldLabels = fields
    .filter((field) => field && typeof field.label === "string")
    .map((field) => field.label.trim().toLowerCase());
  if (new Set(fieldLabels).size !== fieldLabels.length) {
    errors[group] = "Use a unique label for each field in this section.";
  }
}

export function calculatorConfigFromForm(formData, fallbackConfig) {
  const fallback = normalizeCalculatorConfig(fallbackConfig);
  const itemResult = parseFieldList(
    formData,
    "itemFields",
    fallback.itemFields,
  );
  const orderResult = parseFieldList(
    formData,
    "orderFields",
    fallback.orderFields,
  );
  const dimensionValue = formData.get("dimension");
  const dimension = DIMENSIONS[dimensionValue] ? dimensionValue : "weight";
  const dimensionConfig = DIMENSIONS[dimension];
  const labels = Object.fromEntries(
    LABEL_KEYS.map((key) => [key, formData.get(`label.${key}`)]),
  );
  const config = normalizeCalculatorConfig({
    dimension,
    inputUnit: formData.get("inputUnit"),
    rateUnit: formData.get("rateUnit"),
    ratePerUnit: formData.get("ratePerUnit"),
    totalMeasureDecimalPlaces: formData.get("totalMeasureDecimalPlaces"),
    measureFieldId: formData.get("measureFieldId"),
    quantityFieldId: formData.get("quantityFieldId"),
    inlineFields: formData.get("inlineFields") === "true",
    itemFields: itemResult.fields,
    orderFields: orderResult.fields,
    labels,
  });
  const errors = {};
  const rate = Number(formData.get("ratePerUnit"));
  const totalMeasureDecimalPlaces = Number(
    formData.get("totalMeasureDecimalPlaces"),
  );

  if (!TOTAL_MEASURE_DECIMAL_PLACES.includes(totalMeasureDecimalPlaces)) {
    errors.totalMeasureDecimalPlaces =
      "Choose between 0 and 6 decimal places for the total measurement.";
  }
  if (!dimensionConfig.units[formData.get("inputUnit")]) {
    errors.inputUnit = "Choose a supported input unit for this dimension.";
  }
  if (!dimensionConfig.units[formData.get("rateUnit")]) {
    errors.rateUnit = "Choose a supported rate unit for this dimension.";
  }
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1_000_000) {
    errors.ratePerUnit =
      "Enter a rate greater than 0 and no more than 1,000,000.";
  } else {
    config.ratePerUnit = rate;
  }

  if (itemResult.error) errors.itemFields = itemResult.error;
  if (orderResult.error) errors.orderFields = orderResult.error;
  validateFields(
    itemResult.fields,
    "itemFields",
    errors,
    MAX_FIELDS_PER_GROUP + 2,
  );
  if (config.itemFields.length > MAX_FIELDS_PER_GROUP + 2) {
    errors.itemFields = `Add no more than ${MAX_FIELDS_PER_GROUP} additional item fields.`;
  }
  validateFields(orderResult.fields, "orderFields", errors);

  for (const key of LABEL_KEYS) {
    const label = formData.get(`label.${key}`);
    if (
      typeof label !== "string" ||
      !label.trim() ||
      label.trim().length > MAX_FIELD_LABEL_LENGTH
    ) {
      errors[`label.${key}`] =
        `Enter a label of 1-${MAX_FIELD_LABEL_LENGTH} characters.`;
    }
  }

  const itemFields = config.itemFields;
  const measureField = itemFields.find(
    (field) => field.id === config.measureFieldId,
  );
  if (!measureField || measureField.type !== "number") {
    errors.measureFieldId = "Choose a numeric item field to calculate from.";
  }

  const quantityField = itemFields.find(
    (field) => field.id === config.quantityFieldId,
  );
  if (!quantityField || quantityField.type !== "number") {
    errors.quantityFieldId =
      "Choose a numeric item field for the quantity multiplier.";
  }
  if (
    config.measureFieldId &&
    config.measureFieldId === config.quantityFieldId
  ) {
    errors.quantityFieldId =
      "The measurement and quantity fields must be different.";
  }

  return { config, errors };
}
