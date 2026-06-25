import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";
const SESSION_COOKIE = "pepperone_session";
const SITE_TOKEN = process.env.SITE_API_TOKEN || "";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

function getBackendUrl(path: string[], request: NextRequest) {
  const baseUrl = BACKEND_URL.replace(/\/$/, "");
  const pathname = ["api", ...path]
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const url = new URL(`/${pathname}`, baseUrl);
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

  if (SITE_TOKEN) {
    headers.set("authorization", `Bearer ${SITE_TOKEN.trim()}`);
    return headers;
  }

  const authorization = request.headers.get("authorization");
  if (authorization) {
    headers.set("authorization", authorization);
    return headers;
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  if (sessionToken) {
    headers.set("authorization", `Bearer ${sessionToken}`);
    return headers;
  }

  return headers;
}

async function proxyRequest(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const method = request.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  const response = await fetch(getBackendUrl(path, request), {
    method,
    headers: getForwardHeaders(request),
    body: hasBody ? await request.arrayBuffer() : undefined,
    cache: "no-store",
  });

  const headers = new Headers(response.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
