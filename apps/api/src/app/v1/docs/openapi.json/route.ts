import { openAPIDocument } from "@/lib/openapi/document";
import { auth } from "@zoonk/core/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const authSchema = await auth.api.generateOpenAPISchema();

  const mergedDocument = {
    ...openAPIDocument,
    components: {
      ...authSchema.components,
      ...openAPIDocument.components,
    },
    paths: {
      ...authSchema.paths,
      ...openAPIDocument.paths,
    },
    tags: [...(authSchema.tags ?? []), ...(openAPIDocument.tags ?? [])],
  };

  return NextResponse.json(mergedDocument);
}
