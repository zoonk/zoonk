/** The depth versions a learner can ask for with "Simpler" and "Go deeper". */
export const LEARNER_VARIANT_KINDS = ["simpler", "deeper"] as const;

export type LearnerVariantKind = (typeof LEARNER_VARIANT_KINDS)[number];
