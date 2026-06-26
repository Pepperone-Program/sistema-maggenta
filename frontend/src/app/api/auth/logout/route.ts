import { NextResponse } from "next/server";

const SESSION_COOKIE = "maggenta_session";

export async function POST() {
  const response = NextResponse.json({ success: true });

  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
