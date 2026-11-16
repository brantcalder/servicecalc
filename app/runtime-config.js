export function getRequiredEnv(name) {
  const value = process.env[name];

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

export function validateRuntimeConfig() {
  const databaseUrl = getRequiredEnv("DATABASE_URL");
  const apiKey = getRequiredEnv("SHOPIFY_API_KEY");
  const apiSecretKey = getRequiredEnv("SHOPIFY_API_SECRET");
  const appUrl = getRequiredEnv("SHOPIFY_APP_URL");
  const scopes = getRequiredEnv("SCOPES")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);

  if (!appUrl.startsWith("https://")) {
    throw new Error("SHOPIFY_APP_URL must start with https://");
  }

  if (scopes.length === 0) {
    throw new Error("SCOPES must contain at least one permission.");
  }

  return {
    apiKey,
    apiSecretKey,
    appUrl,
    databaseUrl,
    scopes,
  };
}
