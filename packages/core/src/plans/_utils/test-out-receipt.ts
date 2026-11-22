export function levelTestReceipt(attemptId: string | null | undefined) {
  return `levelTest:${attemptId ?? "onboarding"}`;
}

export function levelTestOutReceipt(attemptId: string) {
  return `levelTestOut:${attemptId}`;
}

export function placementPartReceipt(attemptId: string, part: number) {
  return `${attemptId}:${part}`;
}
