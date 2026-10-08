import { type GuardianLink } from "@zoonk/db";
import { type GuardianLinkView } from "../guardian-contract";

export function toGuardianLinkView(link: GuardianLink): GuardianLinkView {
  return {
    acceptedAt: link.acceptedAt,
    createdAt: link.createdAt,
    dailyLimitMinutes: link.dailyLimitMinutes,
    expiresAt: link.expiresAt,
    guardianEmail: link.guardianEmail,
    id: link.id,
    memoryOff: link.memoryOff,
    plusApprovedAt: link.plusApprovedAt,
    status: link.status,
  };
}
