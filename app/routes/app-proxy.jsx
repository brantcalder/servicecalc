import { authenticate, unauthenticated } from "../shopify.server";
import { getCalculatorByMetaobjectId } from "../calculators.server";
import { DIMENSIONS, MAX_FIELD_VALUE_LENGTH } from "../calculator-config";
import { calculatePriceBreakdown } from "../calculator-pricing";

const MAX_REQUEST_SIZE = 4 * 1024 * 1024;
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const MAX_UPLOAD_REQUEST_SIZE = MAX_UPLOAD_SIZE + 256 * 1024;
const MAX_ITEMS = 50;
const MAX_TOTAL_MEASURE = 1_000_000_000_000;

function jsonResponse(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function validateFieldValue(field, rawValue, context) {
  if (field.type === "checkbox") {
    if (typeof rawValue !== "boolean") {
      return { error: `${field.label} is invalid ${context}.` };
    }
    if (field.required && !rawValue) {
      return { error: `${field.label} is required ${context}.` };
    }
    return { value: rawValue };
  }

  if (typeof rawValue !== "string") {
    return { error: `${field.label} is invalid ${context}.` };
  }

  const value = rawValue.trim();
  if (field.required && !value) {
    return { error: `${field.label} is required ${context}.` };
  }
  if (value.length > MAX_FIELD_VALUE_LENGTH) {
    return {
      error: `${field.label} must be ${MAX_FIELD_VALUE_LENGTH} characters or fewer ${context}.`,
    };
  }
  if (!value) return { value: "" };

  if (field.type === "file") {
    try {
      const fileUrl = new URL(value);
      if (
        fileUrl.protocol !== "https:" ||
        fileUrl.hostname !== "cdn.shopify.com"
      ) {
        return {
          error: `${field.label} must be a valid uploaded file ${context}.`,
        };
      }
    } catch {
      return {
        error: `${field.label} must be a valid uploaded file ${context}.`,
      };
    }
    return { value };
  }

  if (field.type === "number") {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return {
        error: `Enter a valid ${field.label.toLowerCase()} ${context}.`,
      };
    }
    if (field.min !== "" && number < Number(field.min)) {
      return {
        error: `${field.label} must be at least ${field.min} ${context}.`,
      };
    }
    if (field.max !== "" && number > Number(field.max)) {
      return {
        error: `${field.label} must be no more than ${field.max} ${context}.`,
      };
    }
    if (field.step && field.step !== "any") {
      const step = Number(field.step);
      const base = field.min === "" ? 0 : Number(field.min);
      const steps = (number - base) / step;
      if (Math.abs(steps - Math.round(steps)) > 1e-8) {
        return { error: `Enter a valid ${field.label} increment ${context}.` };
      }
    }
    return { value: number };
  }

  if (field.type === "select" && !field.options.includes(value)) {
    return { error: `Choose a valid ${field.label} ${context}.` };
  }
  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { error: `Enter a valid email address ${context}.` };
  }
  if (field.type === "date" && !isValidDate(value)) {
    return { error: `Enter a valid date ${context}.` };
  }

  return { value };
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validateFieldGroup(fields, submitted, context) {
  if (fields.length === 0) return { values: {} };
  if (!submitted || typeof submitted !== "object" || Array.isArray(submitted)) {
    return { error: `Enter the requested details ${context}.` };
  }

  const values = {};
  for (const field of fields) {
    const result = validateFieldValue(field, submitted[field.id], context);
    if (result.error) return result;
    values[field.id] = result.value;
  }
  return { values };
}

function validateSubmission(submission, calculator) {
  const { config } = calculator;
  if (!submission || typeof submission !== "object") {
    return { error: "Submit item details to continue." };
  }
  if (
    !Array.isArray(submission.items) ||
    submission.items.length === 0 ||
    submission.items.length > MAX_ITEMS
  ) {
    return { error: `Enter between 1 and ${MAX_ITEMS} items.` };
  }

  const dimension = DIMENSIONS[config.dimension];
  const measureField = config.itemFields.find(
    (field) => field.id === config.measureFieldId,
  );
  const quantityField = config.itemFields.find(
    (field) => field.id === config.quantityFieldId,
  );
  if (config.dimension !== "per_item" && !measureField) {
    return { error: "The calculator is missing its measurement field." };
  }
  if (config.quantityFieldId && !quantityField) {
    return { error: "The calculator is missing its quantity field." };
  }
  const items = [];

  for (const [index, submittedItem] of submission.items.entries()) {
    const context = `for item ${index + 1}`;
    const result = validateFieldGroup(
      config.itemFields,
      submittedItem?.fields,
      context,
    );
    if (result.error) return result;

    const quantity = quantityField
      ? result.values[quantityField.id] === ""
        ? 1
        : result.values[quantityField.id]
      : 1;
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      (config.dimension === "per_item" && !Number.isSafeInteger(quantity))
    ) {
      return {
        error: `Enter a valid quantity ${context}.`,
      };
    }

    const measure =
      config.dimension === "per_item"
        ? quantity
        : result.values[measureField.id];
    if (
      !Number.isFinite(measure) ||
      measure <= 0 ||
      measure > MAX_TOTAL_MEASURE / dimension.units[config.inputUnit].factor
    ) {
      return { error: `Enter a valid ${dimension.label}${context}.` };
    }

    items.push({ values: result.values, measure, quantity });
  }

  const pricing = calculatePriceBreakdown(config, items);
  const { totalMeasureBase, totalPriceCents } = pricing;
  if (
    !Number.isFinite(totalMeasureBase) ||
    totalMeasureBase <= 0 ||
    totalMeasureBase > MAX_TOTAL_MEASURE
  ) {
    return { error: "The total measurement is too large to check out." };
  }

  if (!Number.isSafeInteger(totalPriceCents) || totalPriceCents <= 0) {
    return {
      error:
        "The total is too large to check out. Please reduce the item quantities.",
    };
  }

  const orderResult = validateFieldGroup(
    config.orderFields,
    submission.orderFields,
    "for the order",
  );
  if (orderResult.error) return orderResult;

  return {
    items: items.map((item, index) => ({
      ...item,
      priceCents: pricing.linePriceCents[index],
    })),
    orderFields: orderResult.values,
    totalMeasure: totalMeasureBase / pricing.inputUnit.factor,
    totalMeasureBase,
    totalPriceCents,
    inputUnit: pricing.inputUnit,
    rateUnit: pricing.rateUnit,
    config,
  };
}

function fieldDisplayValue(field, value, config, itemField = false) {
  if (field.type === "checkbox") return value ? "Yes" : "No";
  if (
    itemField &&
    field.type === "number" &&
    field.id === config.measureFieldId &&
    config.dimension !== "per_item"
  ) {
    return `${value} ${DIMENSIONS[config.dimension].units[config.inputUnit].shortLabel}`;
  }
  return String(value);
}

export async function loader({ request }) {
  try {
    await authenticate.public.appProxy(request);
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");

    if (!shop || !/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop)) {
      return jsonResponse(
        { error: "Could not identify the Shopify store." },
        400,
      );
    }

    const calculatorId = url.searchParams.get("calculatorId");
    const calculator = await getCalculatorByMetaobjectId(shop, calculatorId);
    if (!calculator) {
      return jsonResponse(
        { error: "This calculator is no longer available." },
        404,
      );
    }

    return jsonResponse({
      calculator: {
        id: calculator.id,
        name: calculator.name,
        config: calculator.config,
      },
    });
  } catch (error) {
    console.error("ServiceCalc app proxy settings request failed.", error);
    return jsonResponse(
      { error: "Could not load calculator settings. Please refresh and try again." },
      500,
    );
  }
}

export async function action({ request }) {
  try {
    await authenticate.public.appProxy(request);

    if (request.method !== "POST") {
      return jsonResponse(
        { error: "Use POST to submit a kiln firing order." },
        405,
      );
    }

    const url = new URL(request.url);
    if (url.searchParams.get("resource") === "upload") {
      return uploadFieldFile(request, url);
    }

    const contentLength = Number(request.headers.get("Content-Length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_SIZE) {
      return jsonResponse({ error: "The submission is too large." }, 413);
    }

    if (!request.headers.get("Content-Type")?.includes("application/json")) {
      return jsonResponse({ error: "Submit the calculator form as JSON." }, 415);
    }

    const requestBody = await request.text();
    if (new TextEncoder().encode(requestBody).byteLength > MAX_REQUEST_SIZE) {
      return jsonResponse({ error: "The submission is too large." }, 413);
    }

    let submission;
    try {
      submission = JSON.parse(requestBody);
    } catch {
      return jsonResponse({ error: "The submission is not valid JSON." }, 400);
    }

    const shop = url.searchParams.get("shop");
    if (!shop || !/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop)) {
      return jsonResponse(
        { error: "Could not identify the Shopify store." },
        400,
      );
    }
    const calculatorId = url.searchParams.get("calculatorId");
    const calculator = await getCalculatorByMetaobjectId(shop, calculatorId);
    if (!calculator) {
      return jsonResponse(
        { error: "This calculator is no longer available." },
        404,
      );
    }
    const validated = validateSubmission(submission, calculator);
    if (validated.error) {
      return jsonResponse({ error: validated.error }, 400);
    }

    const { admin } = await unauthenticated.admin(shop);
    const shopResponse = await admin.graphql(
    `#graphql
      query ShopCurrency {
        shop {
          currencyCode
        }
      }`,
  );
    const shopData = await shopResponse.json();
    const currencyCode = shopData.data?.shop?.currencyCode;

    if (!shopResponse.ok || shopData.errors || !currencyCode) {
      console.error("Could not retrieve the shop currency for a kiln order.");
      return jsonResponse(
        { error: "Could not prepare checkout. Please try again." },
        502,
      );
    }

    const lineItems = validated.items.map((item, index) => ({
    title: `${calculator.name} — ${validated.config.labels.itemPrefix} ${index + 1}`,
    quantity: 1,
    originalUnitPriceWithCurrency: {
      amount: (item.priceCents / 100).toFixed(2),
      currencyCode,
    },
    requiresShipping: false,
    taxable: true,
    customAttributes: validated.config.itemFields
      .filter((field) => {
        const value = item.values[field.id];
        return field.type === "checkbox" || value !== "";
      })
      .map((field) => ({
        key: field.label,
        value: fieldDisplayValue(
          field,
          item.values[field.id],
          validated.config,
          true,
        ),
      })),
  }));
    const customAttributes = [
    {
      key: "Kiln firing rate",
      value: `${validated.config.ratePerUnit} ${currencyCode} per ${validated.rateUnit.label}`,
    },
    ...validated.config.orderFields
      .filter((field) => {
        const value = validated.orderFields[field.id];
        return field.type === "checkbox" || value !== "";
      })
      .map((field) => ({
        key: field.label,
        value: fieldDisplayValue(
          field,
          validated.orderFields[field.id],
          validated.config,
        ),
      })),
  ];

    const orderResponse = await admin.graphql(
    `#graphql
      mutation CreateKilnFiringDraftOrder($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            invoiceUrl
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        input: {
          lineItems,
          customAttributes,
          note: `${calculator.name} order submitted through the storefront calculator. Total: ${validated.totalMeasure.toFixed(validated.config.totalMeasureDecimalPlaces ?? 3)} ${validated.inputUnit.shortLabel}.`,
          tags: ["servicecalc"],
          presentmentCurrencyCode: currencyCode,
        },
      },
    },
  );

    const orderData = await orderResponse.json();
    const draftOrder = orderData.data?.draftOrderCreate?.draftOrder;
    const userErrors = orderData.data?.draftOrderCreate?.userErrors;

    if (
      !orderResponse.ok ||
      orderData.errors ||
      userErrors?.length ||
      !draftOrder?.invoiceUrl
    ) {
      console.error(
        "Could not create a ServiceCalc draft order.",
        orderData.errors ?? userErrors,
      );
      return jsonResponse(
        { error: "Could not create checkout. Please try again." },
        502,
      );
    }

    return jsonResponse({ checkoutUrl: draftOrder.invoiceUrl });
  } catch (error) {
    console.error("ServiceCalc app proxy checkout request failed.", error);
    return jsonResponse(
      { error: "Could not prepare checkout. Please try again." },
      500,
    );
  }
}

async function uploadFieldFile(request, url) {
  const contentLength = Number(request.headers.get("Content-Length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_UPLOAD_REQUEST_SIZE
  ) {
    return jsonResponse({ error: "The file must be 10 MB or smaller." }, 413);
  }

  const shop = url.searchParams.get("shop");
  if (!shop || !/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop)) {
    return jsonResponse(
      { error: "Could not identify the Shopify store." },
      400,
    );
  }
  const calculatorId = url.searchParams.get("calculatorId");
  const calculator = await getCalculatorByMetaobjectId(shop, calculatorId);
  if (!calculator) {
    return jsonResponse(
      { error: "This calculator is no longer available." },
      404,
    );
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ error: "Submit a valid file upload." }, 400);
  }
  const fieldId = formData.get("fieldId");
  const file = formData.get("file");
  const isFile =
    file &&
    typeof file === "object" &&
    typeof file.name === "string" &&
    typeof file.size === "number" &&
    typeof file.arrayBuffer === "function";
  if (
    typeof fieldId !== "string" ||
    !isFile ||
    file.size === 0 ||
    file.size > MAX_UPLOAD_SIZE
  ) {
    return jsonResponse({ error: "Submit a file up to 10 MB." }, 400);
  }

  const field = [
    ...calculator.config.itemFields,
    ...calculator.config.orderFields,
  ].find((candidate) => candidate.id === fieldId);
  if (!field || field.type !== "file") {
    return jsonResponse(
      { error: "This is not a valid file upload field." },
      400,
    );
  }

  const filename = file.name
    .replace(/[\\/]/g, "_")
    .replace(/[\r\n]/g, "_")
    .slice(0, 255);
  if (!filename) {
    return jsonResponse({ error: "The file name is invalid." }, 400);
  }

  const { admin } = await unauthenticated.admin(shop);
  const stagedResponse = await admin.graphql(
    `#graphql
      mutation CreateKilnFileUploadTarget($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        input: [
          {
            filename,
            mimeType: file.type || "application/octet-stream",
            httpMethod: "POST",
            resource: "FILE",
          },
        ],
      },
    },
  );
  const stagedData = await stagedResponse.json();
  const stagedUpload = stagedData.data?.stagedUploadsCreate;
  const target = stagedUpload?.stagedTargets?.[0];
  if (
    !stagedResponse.ok ||
    stagedData.errors ||
    stagedUpload?.userErrors?.length ||
    !target?.url ||
    !target.resourceUrl ||
    !Array.isArray(target.parameters)
  ) {
    console.error(
      "Could not create a staged upload for a kiln calculator file.",
      stagedData.errors ?? stagedUpload?.userErrors,
    );
    return jsonResponse(
      { error: "Could not upload the file. Please try again." },
      502,
    );
  }

  const uploadData = new FormData();
  for (const parameter of target.parameters) {
    uploadData.append(parameter.name, parameter.value);
  }
  uploadData.append("file", file, filename);
  const uploadResponse = await fetch(target.url, {
    method: "POST",
    body: uploadData,
  });
  if (!uploadResponse.ok) {
    console.error(
      "Could not transfer a kiln calculator file to Shopify.",
      uploadResponse.status,
    );
    return jsonResponse(
      { error: "Could not upload the file. Please try again." },
      502,
    );
  }

  const fileResponse = await admin.graphql(
    `#graphql
      mutation CreateKilnCalculatorFile($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            ... on GenericFile {
              id
              fileStatus
              url
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        files: [
          {
            originalSource: target.resourceUrl,
            contentType: "FILE",
            alt: `${field.label}: ${filename}`,
          },
        ],
      },
    },
  );
  const fileData = await fileResponse.json();
  let uploadedFile = fileData.data?.fileCreate?.files?.[0];
  if (
    !fileResponse.ok ||
    fileData.errors ||
    fileData.data?.fileCreate?.userErrors?.length ||
    !uploadedFile?.id
  ) {
    console.error(
      "Could not create a Shopify file for a kiln calculator upload.",
      fileData.errors ?? fileData.data?.fileCreate?.userErrors,
    );
    return jsonResponse(
      { error: "Could not save the file. Please try again." },
      502,
    );
  }

  for (
    let attempt = 0;
    attempt < 10 &&
    uploadedFile.fileStatus !== "READY" &&
    uploadedFile.fileStatus !== "FAILED";
    attempt++
  ) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const statusResponse = await admin.graphql(
      `#graphql
        query KilnCalculatorFileStatus($id: ID!) {
          node(id: $id) {
            ... on GenericFile {
              fileStatus
              url
            }
          }
        }`,
      { variables: { id: uploadedFile.id } },
    );
    const statusData = await statusResponse.json();
    const statusFile = statusData.data?.node;
    if (!statusResponse.ok || statusData.errors || !statusFile) {
      console.error(
        "Could not check the status of a Shopify file for a kiln calculator upload.",
        statusData.errors,
      );
      return jsonResponse(
        { error: "Could not prepare the uploaded file. Please try again." },
        502,
      );
    }
    uploadedFile = { ...uploadedFile, ...statusFile };
  }

  if (uploadedFile.fileStatus !== "READY" || !uploadedFile.url) {
    console.error(
      "Shopify could not finish processing a kiln calculator file.",
      uploadedFile.fileStatus,
    );
    return jsonResponse(
      { error: "Could not prepare the uploaded file. Please try again." },
      502,
    );
  }

  return jsonResponse({ fileUrl: uploadedFile.url });
}
