const LOCAL_BACKEND_URL = "http://localhost:3001";

export function getBackendBaseUrl() {
  const configuredUrl = process.env.BACKEND_URL?.trim();

  if (!configuredUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("BACKEND_URL must be configured in production");
    }

    return LOCAL_BACKEND_URL;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(configuredUrl);
  } catch {
    throw new Error("BACKEND_URL must be an absolute URL");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("BACKEND_URL must use HTTP or HTTPS");
  }

  if (parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash) {
    throw new Error("BACKEND_URL must not contain credentials, query, or fragment");
  }

  return parsedUrl.toString().replace(/\/$/, "");
}
