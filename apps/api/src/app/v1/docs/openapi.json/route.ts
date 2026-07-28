import { openAPIDocument } from "@/lib/openapi/document";
import { NextResponse } from "next/server";

/**
 * Publishes only Zoonk-owned operations so Better Auth's implementation routes
 * can evolve without silently becoming part of the public API contract.
 */
export function GET() {
  return NextResponse.json(openAPIDocument);
}
