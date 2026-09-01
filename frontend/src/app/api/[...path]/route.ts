import { NextRequest, NextResponse } from "next/server";
import { getBackendBaseUrl } from "@/lib/server/backend-url";

const SESSION_COOKIE = "maggenta_session";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

function getBackendUrl(path: string[], request: NextRequest) {
  const pathname = ["api", ...path]
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const url = new URL(`/${pathname}`, getBackendBaseUrl());
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });
  return url;
}

function getForwardHeaders(request: NextRequest) {
  const headers = new Headers();
  const allowedHeaders = [
    "content-type",
    "accept",
    "accept-language",
  ];

  allowedHeaders.forEach((name) => {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  });

  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  if (sessionToken) {
    headers.set("authorization", `Bearer ${sessionToken}`);
    return headers;
  }

  return headers;
}

async function proxyRequest(request: NextRequest, context: RouteContext) {
  try {
    const { path } = await context.params;
    const method = request.method.toUpperCase();
    const hasBody = !["GET", "HEAD"].includes(method);
    const timeoutMs = path.includes("gerar-descricao") ? 300_000 : 30_000;
    const response = await fetch(getBackendUrl(path, request), {
      method,
      headers: getForwardHeaders(request),
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });

    const headers = new Headers(response.headers);
    headers.delete("content-encoding");
    headers.delete("content-length");
    headers.delete("set-cookie");
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      {
        success: false,
        message: "Servico de backend indisponivel",
        data: null,
        error: { code: timedOut ? "BACKEND_TIMEOUT" : "BACKEND_UNAVAILABLE" },
      },
      {
        status: timedOut ? 504 : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
