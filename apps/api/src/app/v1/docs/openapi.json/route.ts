import { openAPIDocument } from "@/lib/openapi/document";
import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(openAPIDocument);
}
