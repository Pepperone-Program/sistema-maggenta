import { NextRequest, NextResponse } from "next/server";
import { getBackendBaseUrl } from "@/lib/server/backend-url";

const SESSION_COOKIE = "maggenta_session";

type LoginPayload = {
  success?: boolean;
  data?: {
    token?: string;
    [key: string]: unknown;
  };
  message?: string;
  [key: string]: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const response = await fetch(
      `${getBackendBaseUrl()}/api/v1/usuarios/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: await request.text(),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );

    const payload = (await response.json().catch(() => null)) as LoginPayload | null;
    const token = payload?.data?.token;
    const safePayload = payload ? { ...payload } : null;

    if (safePayload?.data) {
      safePayload.data = { ...safePayload.data };
      delete safePayload.data.token;
    }

    const nextResponse = NextResponse.json(
      safePayload || {
        success: false,
        message: "Resposta invalida do servico de autenticacao",
        data: null,
      },
      { status: payload ? response.status : 502 },
    );

    if (response.ok && payload?.success && token) {
      nextResponse.cookies.set({
        name: SESSION_COOKIE,
        value: token,
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
    }

    return nextResponse;
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      {
        success: false,
        message: "Servico de autenticacao indisponivel",
        data: null,
        error: { code: timedOut ? "AUTH_TIMEOUT" : "AUTH_UNAVAILABLE" },
      },
      {
        status: timedOut ? 504 : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
