import { getBackendBaseUrl } from "@/lib/server/backend-url";

const HEALTH_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

function hasValidBackendConfiguration() {
  try {
    getBackendBaseUrl();
    return true;
  } catch {
    return false;
  }
}

export function GET() {
  if (!hasValidBackendConfiguration()) {
    return Response.json(
      { status: "unhealthy", reason: "backend_configuration" },
      {
        status: 503,
        headers: HEALTH_HEADERS,
      },
    );
  }

  return Response.json(
    { status: "ok" },
    {
      status: 200,
      headers: HEALTH_HEADERS,
    },
  );
}

export function HEAD() {
  return new Response(null, {
    status: hasValidBackendConfiguration() ? 200 : 503,
    headers: HEALTH_HEADERS,
  });
}
