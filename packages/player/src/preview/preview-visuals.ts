/* oxlint-disable no-magic-numbers -- Fixture content is literal lesson data. */
import { type ChartVisual, type TimelineVisual } from "@zoonk/core/library/steps/contract";

export const lettersChart: ChartVisual = {
  axisStart: null,
  categories: ["Maio", "Junho", "Julho"],
  categoryLabel: "Mês",
  chart: "bar",
  kind: "chart",
  series: [{ name: "Ofícios respondidos", values: [35, 36, 40] }],
  source: null,
  title: "Ofícios respondidos por mês",
  unit: null,
  valueLabel: "Ofícios",
};

export const visitorsChart: ChartVisual = {
  ...lettersChart,
  axisStart: 10_000,
  categories: ["Mar", "Abr", "Mai", "Jun", "Jul"],
  chart: "line",
  series: [{ name: "Visitantes", values: [10_050, 10_120, 10_200, 10_310, 10_380] }],
  title: "Visitantes por mês, com o eixo a partir de 10.000",
  valueLabel: "Visitantes",
};

export const japaneseRegionsChart: ChartVisual = {
  ...lettersChart,
  categories: ["北海道地方", "東北地方", "関東地方", "中部地方", "近畿地方"],
  categoryLabel: "地方",
  series: [{ name: "回答数", values: [18, 42, 64, 30, 22] }],
  title: "地方別の回答数",
  valueLabel: "回答数",
};

export const lawTimeline: TimelineVisual = {
  events: [
    { date: "1988", detail: "Promulgada em 5 de outubro.", label: "Constituição Federal" },
    { date: "1990", detail: null, label: "Lei nº 8.112, dos servidores federais" },
  ],
  kind: "timeline",
  title: "Leis que organizam o serviço público",
};
