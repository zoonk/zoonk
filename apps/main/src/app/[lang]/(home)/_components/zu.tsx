import { Buddy } from "@zoonk/ui/components/buddy";

export function Zu({ className, crop }: { className?: string; crop?: "face" }) {
  return (
    <Buddy
      beltColor="white"
      className={className}
      crop={crop}
      energy={null}
      glasses="round"
      kind="zu"
    />
  );
}
