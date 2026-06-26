import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";
const SESSION_COOKIE = "maggenta_session";

type LoginPayload = {
  success?: boolean;
  data?: {
    token?: string;
  };
  message?: string;
};

export async function POST(request: NextRequest) {
  const response = await fetch(
    `${BACKEND_URL.replace(/\/$/, "")}/api/v1/usuarios/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: await request.text(),
      cache: "no-store",
    },
  );

  const payload = (await response.json().catch(() => null)) as LoginPayload | null;
  const nextResponse = NextResponse.json(payload, { status: response.status });
  const token = payload?.data?.token;

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
}
