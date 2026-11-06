// Exam, language and progress views built from the repo's learn components.
import { views as buddy } from "./views-buddy";
import { views as exam } from "./views-exam";
import { views as language } from "./views-language";

type View = (p: { lang: "en" | "pt"; state: string; q: URLSearchParams }) => any;

export const views: Record<string, View> = { ...exam, ...language, ...buddy };
