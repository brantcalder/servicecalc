import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  if (topic === "shop/redact") {
    await db.calculator.deleteMany({ where: { shop } });
    await db.serviceCalcSettings.deleteMany({ where: { shop } });
    await db.session.deleteMany({ where: { shop } });
    return new Response(null, { status: 200 });
  }

  // This app does not persist customer records. Keep a log entry for auditability.
  console.log(
    `Received ${topic} webhook for ${shop}. Payload id: ${payload?.id ?? "unknown"}`,
  );

  return new Response(null, { status: 200 });
};
