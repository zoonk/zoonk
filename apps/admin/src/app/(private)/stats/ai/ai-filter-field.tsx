import { Label } from "@zoonk/ui/components/label";

/**
 * The AI stats pages repeat the same label-plus-input structure across several
 * server-rendered forms. Keeping that wrapper in one file makes the filters
 * consistent without pushing form layout details into every page component.
 */
export function AiFilterField({
  children,
  htmlFor,
  label,
}: {
  children: React.ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="flex min-w-32 flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
