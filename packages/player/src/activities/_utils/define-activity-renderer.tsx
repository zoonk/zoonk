import {
  type ActivityContentFor,
  type ActivityStepContent,
  type ActivityTemplateId,
} from "@zoonk/core/library/activities/templates";
import { type ComponentType, type LazyExoticComponent, lazy } from "react";
import { type ActivityBadgeKind } from "../_components/activity-badge";
import { type ActivityRenderer, type AnyActivityRendererProps } from "../activity-renderer";

export type ActivityRendererEntry<TId extends ActivityTemplateId> = {
  badge: (content: ActivityStepContent) => ActivityBadgeKind;
  Canvas: LazyExoticComponent<ComponentType<AnyActivityRendererProps>>;
  checkFirst: (content: ActivityStepContent) => boolean;
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

export function defineActivityRenderer<TId extends ActivityTemplateId>({
  badge,
  checkFirst = () => false,
  load,
  template,
}: {
  badge: ActivityBadgeKind | ((content: ActivityContentFor<TId>) => ActivityBadgeKind);
  checkFirst?: (content: ActivityContentFor<TId>) => boolean;
  load: () => Promise<ActivityRenderer<TId>>;
  template: TId;
}): ActivityRendererEntry<TId> {
  const Canvas = lazy(async () => {
    const Renderer = await load();

    /* oxlint-disable-next-line unicorn/consistent-function-scoping -- It captures Renderer through JSX, which the rule doesn't see. */
    function TemplateCanvas({ content, ...props }: AnyActivityRendererProps) {
      return isTemplate(content, template) ? <Renderer {...props} content={content} /> : null;
    }

    return { default: TemplateCanvas };
  });

  function badgeFor(content: ActivityStepContent): ActivityBadgeKind {
    if (typeof badge === "string") {
      return badge;
    }

    return isTemplate(content, template) ? badge(content) : "explore";
  }

  return {
    Canvas,
    badge: badgeFor,
    checkFirst: (content) => isTemplate(content, template) && checkFirst(content),
    template,
  };
}
