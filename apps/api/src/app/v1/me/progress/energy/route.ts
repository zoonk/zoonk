import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { serializeEnergy } from "@/lib/progress-serializers";
import { getCurrentUserEnergy } from "@zoonk/core/progress/get-energy-data";
import { NextResponse } from "next/server";

async function getCurrentUserEnergyRoute() {
  const resource = await getCurrentUserEnergy();

  if (!resource) {
    return errors.unauthorized();
  }

  return NextResponse.json({ energy: resource.energy ? serializeEnergy(resource.energy) : null });
}

export const GET = withApiErrorBoundary(getCurrentUserEnergyRoute);
