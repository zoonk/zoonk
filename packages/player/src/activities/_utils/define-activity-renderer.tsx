import {
  type ActivityContentFor,
  type ActivityStepContent,
  type ActivityTemplateId,
} from "@zoonk/core/library/activities/templates";
import { type ComponentType, type LazyExoticComponent, lazy } from "react";
import { type ActivityBadgeKind } from "../_components/activity-badge";
import { type ActivityRenderer, type AnyActivityRendererProps } from "../activity-renderer";

export type ActivityRendererEntry<TId extends ActivityTemplateId> = {
  /** The badge above the prompt, naming what the learner does on this screen. */
  badge: (content: ActivityStepContent) => ActivityBadgeKind;
  /** Loaded on first use, so a lesson only downloads the templates it shows. */
  Canvas: LazyExoticComponent<ComponentType<AnyActivityRendererProps>>;
  /**
   * Whether the check sits above the canvas, for predict-first screens whose canvas shows what
   * happens after the guess. Otherwise it follows the canvas.
   */
  checkFirst: (content: ActivityStepContent) => boolean;
  template: TId;
};

/**
 * Renderer entries for some templates, each typed to its own id. Registry files for one area use
 * it so every entry's `load` is checked against its template.
 */
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
 * Declares a template's renderer. `load` returns the component from a dynamic import, and the
 * canvas only renders it for content of that template, so the registry stays type-safe without
 * casts.
 */
export function defineActivityRenderer<TId extends ActivityTemplateId>({
  badge,
  checkFirst = () => false,
  load,
  template,
}: {
  /** One badge for every screen, or one per screen for an engine whose modes differ. */
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

    // The registry only hands a renderer its own template's content; the guard narrows the type.
    return isTemplate(content, template) ? badge(content) : "explore";
  }

  return {
    Canvas,
    badge: badgeFor,
    checkFirst: (content) => isTemplate(content, template) && checkFirst(content),
    template,
  };
}
