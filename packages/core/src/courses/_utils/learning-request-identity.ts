import { stableLearningId } from "./stable-learning-id";

export function learningRequestIdentity({
  userId,
  language,
  prompt,
  kind,
}: {
  userId: string;
  language: string;
  prompt: string;
  kind: "discovery" | "track";
}) {
  return stableLearningId([kind, userId, language, prompt]);
}
