import { ipAddress } from "@vercel/functions";
import type { NextRequest } from "next/server";

function getAllowedIps() {
  return process.env.ALLOWED_IPS?.split(",").map((ip) => ip.trim()) || [];
}

export function isIpAllowed(request: NextRequest): boolean {
  const allowedIps = getAllowedIps();
  const clientIp = ipAddress(request) ?? "";
  const isAllowed = allowedIps.includes(clientIp);

  return isAllowed;
}
