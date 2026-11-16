import prisma from "./db.server";
import {
  createDefaultCalculatorConfig,
  normalizeCalculatorConfig,
} from "./calculator-config";

const METAOBJECT_TYPE = "$app:servicecalc";
const DEFAULT_CALCULATOR_NAME = "ServiceCalc";

function storedConfig(record) {
  return normalizeCalculatorConfig(record.config);
}

function isMissingMetaobjectDefinitionError(payload, result) {
  const userErrors = payload?.userErrors ?? result?.errors ?? [];

  return userErrors.some((error) => {
    const message = error?.message ?? "";
    return (
      message.includes("No metaobject definition exists") ||
      message.includes("does not exist") && message.includes("metaobject")
    );
  });
}

async function syncMetaobject(admin, calculator) {
  const displayName = calculator.isArchived
    ? `Archived — ${calculator.name}`
    : calculator.name;
  const response = await admin.graphql(
    `#graphql
      mutation UpsertServiceCalcMetaobject(
        $handle: MetaobjectHandleInput!
        $values: JSON!
      ) {
        metaobjectUpsert(handle: $handle, values: $values) {
          metaobject {
            id
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        handle: {
          type: METAOBJECT_TYPE,
          handle: `servicecalc-${calculator.id}`,
        },
        values: { name: displayName },
      },
    },
  );
  const result = await response.json();
  const payload = result.data?.metaobjectUpsert;
  const metaobjectId = payload?.metaobject?.id;

  if (
    !response.ok ||
    result.errors?.length ||
    payload?.userErrors?.length ||
    !metaobjectId
  ) {
    if (isMissingMetaobjectDefinitionError(payload, result)) {
      console.warn(
        "Metaobject definition is not available yet for this shop; skipping sync until it is provisioned.",
        payload?.userErrors ?? result?.errors,
      );
      return calculator.metaobjectId ?? null;
    }

    console.error(
      "Could not synchronize a ServiceCalc theme-picker entry.",
      result.errors ?? payload?.userErrors,
    );
    throw new Error(
      payload?.userErrors?.[0]?.message ??
        "Could not publish the calculator to the theme editor. Please try again.",
    );
  }

  if (metaobjectId !== calculator.metaobjectId) {
    await prisma.calculator.update({
      where: { id: calculator.id },
      data: { metaobjectId },
    });
  }

  return metaobjectId;
}

async function normalizeRecord(record) {
  const config = storedConfig(record);
  const serializedConfig = JSON.stringify(config);

  if (serializedConfig !== record.config) {
    return prisma.calculator.update({
      where: { id: record.id },
      data: { config: serializedConfig },
    });
  }
  return record;
}

export async function ensureShopCalculators(admin, shop) {
  let calculators = await prisma.calculator.findMany({
    where: { shop },
    orderBy: { createdAt: "asc" },
  });

  if (calculators.length === 0) {
    calculators = [
      await prisma.calculator.create({
        data: {
          shop,
          name: DEFAULT_CALCULATOR_NAME,
          config: JSON.stringify(createDefaultCalculatorConfig()),
        },
      }),
    ];
  }

  const ready = [];
  for (const calculator of calculators) {
    const normalized = await normalizeRecord(calculator);
    if (!normalized.metaobjectId) {
      normalized.metaobjectId = await syncMetaobject(admin, normalized);
    }
    ready.push({
      ...normalized,
      config: storedConfig(normalized),
    });
  }

  return ready;
}

export async function getCalculator(admin, shop, id) {
  await ensureShopCalculators(admin, shop);
  const record = await prisma.calculator.findFirst({ where: { id, shop } });
  if (!record) return null;

  return {
    ...record,
    config: storedConfig(record),
  };
}

export async function getCalculatorByMetaobjectId(shop, metaobjectId) {
  if (typeof metaobjectId === "string" && metaobjectId) {
    const record = await prisma.calculator.findFirst({
      where: { shop, metaobjectId },
    });
    if (!record) return null;

    return {
      ...record,
      config: storedConfig(record),
    };
  }

  const record =
    (await prisma.calculator.findFirst({
      where: { shop, isArchived: false },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.calculator.findFirst({
      where: { shop },
      orderBy: { createdAt: "asc" },
    }));
  if (record) {
    return {
      ...record,
      config: storedConfig(record),
    };
  }

  return {
    id: null,
    name: DEFAULT_CALCULATOR_NAME,
    config: createDefaultCalculatorConfig(),
  };
}

export async function createCalculator(admin, shop) {
  const calculator = await prisma.calculator.create({
    data: {
      shop,
      name: "New calculator",
      config: JSON.stringify(createDefaultCalculatorConfig()),
    },
  });
  await syncMetaobject(admin, calculator);
  return calculator.id;
}

export async function saveCalculator(admin, shop, id, name, config) {
  const existing = await prisma.calculator.findFirst({ where: { id, shop } });
  if (!existing) return null;

  await syncMetaobject(admin, { ...existing, name });
  return prisma.calculator.update({
    where: { id },
    data: {
      name,
      config: JSON.stringify(normalizeCalculatorConfig(config)),
    },
  });
}

export async function setCalculatorArchived(admin, shop, id, isArchived) {
  const existing = await prisma.calculator.findFirst({ where: { id, shop } });
  if (!existing) return null;

  const updated = { ...existing, isArchived };
  await syncMetaobject(admin, updated);
  return prisma.calculator.update({
    where: { id },
    data: { isArchived },
  });
}
