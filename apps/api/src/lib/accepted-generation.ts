import { NextResponse } from "next/server";

const ACCEPTED = 202;

/** The client follows the run at `Location`, then sends its request again. */
export function acceptedGeneration(generationId: string) {
  return NextResponse.json(
    { generationId, status: "generating" },
    {
      headers: { Location: `/v1/generations/${encodeURIComponent(generationId)}` },
      status: ACCEPTED,
    },
  );
}
