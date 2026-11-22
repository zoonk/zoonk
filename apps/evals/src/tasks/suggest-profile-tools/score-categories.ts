import { defineScoreCategories } from "@/lib/score-categories";

export const SUGGEST_PROFILE_TOOLS_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Audit whether each tool is one this person most likely uses TODAY for their work, studies or everyday life. The goals are what they're learning, not what they use: a tool for learning the goal's subject (a language-learning or test-prep app, a translator, a course site, a practice platform) or the subject itself is wrong unless their job or studies already imply they use it. A goal may still reveal a project or field they work in, and that project's tools fit. Score at most 6 when two or more tools are for learning the goal, and at most 8 for one.`,
    id: "usedToday",
    label: "Tools they use today, not tools for the goal",
    weight: 40,
  },
  {
    expectations: `Audit how specific the list is to this person. When their job or studies are known, the list leads with the software that work or field really runs on in their country (a country's own clinic, accounting, payroll, legal or school systems; a profession's standard design or analysis software), not only general office and messaging apps. When little is known, everyday and study apps common in their country for their likely age are right. Score at most 6 when a known job or field gets mostly generic apps, and at most 8 when an obvious, widely used product for their role and country is missing.`,
    id: "specific",
    label: "Specific to their role and country",
    weight: 30,
  },
  {
    expectations: `Audit each name. Each is one real, widely used product, programming language or platform, never a category ("spreadsheets"), an organization or employer, a professional council, a government agency, a website people don't work in, a device, or an invented name. Names are the short form people say ("Excel", "Teams", "VS Code"), each product appears once, and nothing is unsafe to show a minor (betting, gambling, dating, adult, alcohol, tobacco, weapons). Score at most 5 for any unsafe or invented product, at most 7 for a category, organization or website, and at most 9 for long-form names.`,
    id: "names",
    label: "Real, short, safe product names",
    weight: 30,
  },
]);
