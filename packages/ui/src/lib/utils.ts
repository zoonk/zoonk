import { createCn } from "cn/config";

export const cn = createCn({
  extend: {
    classGroups: {
      duration: [{ duration: ["quick", "base", "pop", "settle", "fill", "burst", "frame"] }],
      "font-size": [{ text: ["display", "headline", "title", "section", "lead", "label"] }],
      readout: [{ text: ["readout"] }],
    },
    theme: {
      animate: ["settle", "pop", "fill", "spark"],
      container: ["column", "form", "wide"],
      ease: ["spring", "accelerate", "swing", "follow"],
      radius: ["option"],
    },
  },
});
