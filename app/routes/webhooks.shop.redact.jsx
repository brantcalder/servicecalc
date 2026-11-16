import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(
    `Received ${topic} webhook for ${shop}. Shop id: ${payload?.shop_id ?? "unknown"}`,
  );

  // Redact merchant data stored by the app.
  await db.calculator.deleteMany({ where: { shop } });
  await db.serviceCalcSettings.deleteMany({ where: { shop } });
  await db.session.deleteMany({ where: { shop } });

  return new Response(null, { status: 200 });
};
