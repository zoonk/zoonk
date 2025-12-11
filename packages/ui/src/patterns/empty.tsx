import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import type { LucideProps } from "lucide-react";

type EmptyViewProps = {
  title: string;
  description: string;
  icon: React.ForwardRefExoticComponent<LucideProps>;
};

export function EmptyView({ title, description, icon: Icon }: EmptyViewProps) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
