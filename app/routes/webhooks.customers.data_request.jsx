import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  // This app does not persist customer records. Keep a log entry for auditability.
  console.log(
    `Received ${topic} webhook for ${shop}. Request id: ${payload?.data_request?.id ?? "unknown"}`,
  );

  return new Response(null, { status: 200 });
};
