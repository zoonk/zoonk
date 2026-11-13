import { createCn } from "cn/config";

export const cn = createCn({
  extend: {
    classGroups: {
      duration: [{ duration: ["quick", "base", "pop", "settle", "fill", "burst", "frame"] }],
      readout: [{ text: ["readout"] }],
      "text-role": [{ text: ["display", "headline", "title", "section", "lead", "label"] }],
    },
    /** A type role sets size, weight, leading and tracking, so it replaces what came before. */
    conflictingClassGroups: {
      "font-size": ["text-role"],
      "text-role": ["font-size", "font-weight", "leading", "tracking"],
    },
    theme: {
      animate: ["settle", "pop", "fill", "spark"],
      container: ["column", "form", "wide"],
      ease: ["spring", "accelerate", "swing", "follow"],
      radius: ["meter"],
      text: ["2xs", "compact", "reading"],
    },
  },
});

/** One ref callback that sets every ref it's given. */
export function mergeRefs<Target>(...refs: (React.Ref<Target> | undefined)[]) {
  return (node: Target | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    }
  };
}
