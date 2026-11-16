/* eslint-disable react/prop-types */
import { Form, redirect, useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import {
  createCalculator,
  ensureShopCalculators,
  setCalculatorArchived,
} from "../calculators.server";
import { DIMENSIONS } from "../calculator-config";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const calculators = await ensureShopCalculators(admin, session.shop);
  return {
    calculators: calculators.map((calculator) => ({
      ...calculator,
      dimension: DIMENSIONS[calculator.config.dimension].label,
    })),
  };
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const id = await createCalculator(admin, session.shop);
    return redirect(`/app/calculators/${id}`);
  }

  if (intent === "archive" || intent === "restore") {
    const id = formData.get("calculatorId");
    if (typeof id !== "string" || !id) {
      return { error: "Select a calculator and try again." };
    }

    await ensureShopCalculators(admin, session.shop);
    const calculator = await setCalculatorArchived(
      admin,
      session.shop,
      id,
      intent === "archive",
    );
    if (!calculator) return { error: "That calculator could not be found." };
    return { saved: true };
  }

  return { error: "Choose an available calculator action." };
};

function CalculatorList({ calculators, archived = false }) {
  if (calculators.length === 0) {
    return <s-paragraph>No calculators in this section.</s-paragraph>;
  }

  return (
    <s-stack direction="block" gap="base">
      {calculators.map((calculator) => (
        <s-box
          key={calculator.id}
          padding="base"
          border="base"
          borderRadius="base"
        >
          <s-grid
            gridTemplateColumns="minmax(0, 1fr) auto auto"
            gap="base"
            alignItems="center"
          >
            <div>
              <s-heading>{calculator.name}</s-heading>
              <s-paragraph>
                {calculator.dimension} based ·{" "}
                {calculator.config.itemFields.length} item fields ·{" "}
                {calculator.config.orderFields.length} order fields
              </s-paragraph>
            </div>
            <s-link href={`/app/calculators/${calculator.id}`}>
              Edit calculator
            </s-link>
            <Form method="post">
              <input
                type="hidden"
                name="intent"
                value={archived ? "restore" : "archive"}
              />
              <input type="hidden" name="calculatorId" value={calculator.id} />
              <s-button type="submit">
                {archived ? "Restore" : "Archive"}
              </s-button>
            </Form>
          </s-grid>
        </s-box>
      ))}
    </s-stack>
  );
}

export default function CalculatorsIndex() {
  const { calculators } = useLoaderData();
  const actionData = useActionData();
  const active = calculators.filter((calculator) => !calculator.isArchived);
  const archived = calculators.filter((calculator) => calculator.isArchived);

  return (
    <s-page heading="Calculators">
      <s-paragraph>
        Create separate calculators for different services, then choose which
        one to display in each theme app block.
      </s-paragraph>

      {actionData?.error && (
        <s-banner tone="critical">{actionData.error}</s-banner>
      )}
      {actionData?.saved && (
        <s-banner tone="success">Calculator updated.</s-banner>
      )}

      <Form method="post">
        <input type="hidden" name="intent" value="create" />
        <s-button type="submit" variant="primary">
          Create calculator
        </s-button>
      </Form>

      <s-section heading="Active calculators">
        <CalculatorList calculators={active} />
      </s-section>

      {archived.length > 0 && (
        <s-section heading="Archived calculators">
          <s-paragraph>
            Archived calculators remain available to existing theme blocks.
            Their names are marked as archived in the theme editor picker.
          </s-paragraph>
          <CalculatorList calculators={archived} archived />
        </s-section>
      )}
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
