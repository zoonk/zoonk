import { type SupportedLocale, getSupportedLocaleFromLanguage } from "./locale";

type CourseLevel = "advanced" | "beginner" | "intermediate" | "overview";

/**
 * Content, not interface copy: a course plan stores them as its phase names, and a certificate's
 * own words use them in the certificate's language.
 */
const COURSE_LEVEL_NAMES: Readonly<Record<SupportedLocale, Record<CourseLevel, string>>> = {
  de: {
    advanced: "Fortgeschritten",
    beginner: "Anfänger",
    intermediate: "Mittelstufe",
    overview: "Überblick",
  },
  en: {
    advanced: "Advanced",
    beginner: "Beginner",
    intermediate: "Intermediate",
    overview: "Overview",
  },
  es: {
    advanced: "Avanzado",
    beginner: "Principiante",
    intermediate: "Intermedio",
    overview: "Panorama general",
  },
  fr: {
    advanced: "Avancé",
    beginner: "Débutant",
    intermediate: "Intermédiaire",
    overview: "Vue d’ensemble",
  },
  it: {
    advanced: "Avanzato",
    beginner: "Principiante",
    intermediate: "Intermedio",
    overview: "Panoramica",
  },
  ja: { advanced: "上級", beginner: "初級", intermediate: "中級", overview: "概要" },
  ko: { advanced: "고급", beginner: "초급", intermediate: "중급", overview: "개요" },
  pl: {
    advanced: "Zaawansowany",
    beginner: "Początkujący",
    intermediate: "Średnio zaawansowany",
    overview: "Przegląd",
  },
  pt: {
    advanced: "Avançado",
    beginner: "Iniciante",
    intermediate: "Intermediário",
    overview: "Visão geral",
  },
  tr: {
    advanced: "İleri seviye",
    beginner: "Başlangıç",
    intermediate: "Orta seviye",
    overview: "Genel bakış",
  },
};

export function getCourseLevelNames(language: string): Readonly<Record<CourseLevel, string>> {
  return COURSE_LEVEL_NAMES[getSupportedLocaleFromLanguage(language)];
}
