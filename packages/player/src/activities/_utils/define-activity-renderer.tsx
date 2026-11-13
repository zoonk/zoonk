import {
  type ActivityContentFor,
  type ActivityStepContent,
  type ActivityTemplateId,
} from "@zoonk/core/library/activities/templates";
import { createOnDemand } from "@zoonk/ui/lib/on-demand";
import { type ActivityBadgeKind } from "../_components/activity-badge";
import { type ActivityRenderer, type AnyActivityRendererProps } from "../activity-renderer";

export type ActivityRendererEntry<TId extends ActivityTemplateId> = {
  badge: (content: ActivityStepContent) => ActivityBadgeKind | null;
  Canvas: (props: AnyActivityRendererProps) => React.ReactNode;
  checkFirst: (content: ActivityStepContent) => boolean;
  load: () => Promise<unknown>;
  template: TId;
};

export type ActivityRendererMap<TId extends ActivityTemplateId> = {
  [Id in TId]: ActivityRendererEntry<Id>;
};

function isTemplate<TId extends ActivityTemplateId>(
  content: ActivityStepContent,
  template: TId,
): content is ActivityContentFor<TId> {
  return content.template === template;
}

/**
 * `badge` is the chip over the title, for an activity whose title can't say what it names: how the
 * screen is worked, or what comes first. A chip that only names the task repeats the title, which
 * says what to do, so most activities have none.
 */
export function defineActivityRenderer<TId extends ActivityTemplateId>({
  badge,
  checkFirst = () => false,
  load,
  template,
}: {
  badge?: ActivityBadgeKind | ((content: ActivityContentFor<TId>) => ActivityBadgeKind | null);
  checkFirst?: (content: ActivityContentFor<TId>) => boolean;
  load: () => Promise<ActivityRenderer<TId>>;
  template: TId;
}): ActivityRendererEntry<TId> {
  // Not `lazy`: it suspends on its first render even when its code is already here, and React then
  // keeps the skeleton up for 300 ms.
  const renderer = createOnDemand(load);

  function Canvas({ content, ...props }: AnyActivityRendererProps) {
    const Renderer = renderer.useRequiredModule();

    if (!isTemplate(content, template)) {
      return null;
    }

    // oxlint-disable-next-line react/static-components -- Its chunk's one renderer, the same on every render; nothing is created here.
    return <Renderer {...props} content={content} />;
  }

  function badgeFor(content: ActivityStepContent): ActivityBadgeKind | null {
    if (typeof badge !== "function") {
      return badge ?? null;
    }

    return isTemplate(content, template) ? badge(content) : null;
  }

  return {
    Canvas,
    badge: badgeFor,
    checkFirst: (content) => isTemplate(content, template) && checkFirst(content),
    load: renderer.load,
    template,
  };
}
