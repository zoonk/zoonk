import { auth } from "@zoonk/core/auth";
import { type NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const response = await auth.api.verifyOneTimeToken({ asResponse: true, body: { token } });

  if (!response.ok) {
    return new Response(null, { headers: { Location: "/login?error=auth" }, status: 302 });
  }

  const headers = new Headers({ Location: "/" });

  for (const cookie of response.headers.getSetCookie()) {
    headers.append("set-cookie", cookie);
  }

  return new Response(null, { headers, status: 302 });
}
