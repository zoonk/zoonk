/**
 * All translatable strings in the launch video.
 * Add a new locale by adding a new key to the `translations` object.
 * Each scene reads from this file via the `useTranslation` hook.
 */

export type Locale = "en" | "pt-br";

type TranslationStrings = {
  /** Scene: SearchPrompt */
  searchPlaceholder: string;
  searchQuery: string;
  chapters: string[];

  /** Scene: EverydayLanguage */
  everydaySetup: string;
  everydayPayoff: string;

  /** Scene: StoryBranch */
  storySetup: string;
  storyPayoff: string;
  storyScenario: string;
  storyChoices: string[];
  storyFeedbackSetup: string;
  storyFeedbackPayoff: string;
  storyFeedback: string;

  /** Scene: VisualsHeadline */
  visualsSetup: string;
  visualsPayoff: string;

  /** Scene: LanguageTransform */
  jargon: string;
  /** Words from the simple sentence that appear in the jargon, in order. */
  simpleWords: string[];

  /** Scene: VisualsGrid */
  gridSetup: string;
  gridPayoff: string;
  gridLabels: {
    charts: string;
    diagrams: string;
    timelines: string;
    code: string;
    formulas: string;
    tables: string;
    images: string;
    music: string;
    quotes: string;
  };

  /** Scene: BrainPower */
  brainIntroSetup: string;
  brainIntroPayoff: string;
  brainNeverSetup: string;
  brainPhiloSetup: string;
  brainPhiloPayoff: string;

  /** Scene: BeltSystem */
  beltSetup: string;
  beltPayoff: string;
  beltPunchSetup: string;
  beltPunchPayoff: string;

  /** Scene: EnergyMeter */
  energySetup: string;
  energyPayoff: string;
  energyDipSetup: string;
  energyDipPayoff: string;
  energyRecoversSetup: string;
  energyRecoversPayoff: string;

  /** Scene: PerformanceStats */
  patternsSetup: string;
  patternsPayoff: string;
  patternsFocusTime: string;
  patternsFocusLabel: string;
  patternsAccuracyLabel: string;
  patternsWhySetup: string;
  patternsWhyPayoff: string;

  /** Scene: ClosingWords */
  closingWords: string;

  /** Scene: Website */
  website: string;
};

const en: TranslationStrings = {
  searchPlaceholder: "What do you want to learn?",
  searchQuery: "quantum physics",
  chapters: [
    "What is quantum physics?",
    "Waves and particles",
    "Superposition",
    "Heisenberg's uncertainty principle",
    "Schrödinger's equation",
    "Quantum entanglement",
    "Wave function collapse",
    "Quantum tunneling",
    "Spin and angular momentum",
    "The double-slit experiment",
    "Quantum decoherence",
    "Quantum field theory",
    "Bell's theorem",
    "Quantum computing basics",
    "Interpretations of quantum mechanics",
  ],

  everydaySetup: "We explain hard things",
  everydayPayoff: "using stuff you already know.",

  storySetup: "You learn",
  storyPayoff: "by making decisions.",
  storyScenario: "A customer wants a refund after 90 days. What do you do?",
  storyChoices: ["Ignore the request", "Check the refund policy", "Offer a full refund"],
  storyFeedbackSetup: "Made a mistake?",
  storyFeedbackPayoff: "You'll know why.",
  storyFeedback: "Ignoring customers damages trust and loyalty.",

  visualsSetup: "Complex things,",
  visualsPayoff: "made simple.",

  /**
   * The jargon text is engineered so that the words of the simple sentence
   * appear within it in order. The animation fades out everything except
   * those anchor words, distilling the jargon into the simple sentence.
   *
   * Simple: "Light acts like both a wave and a ball."
   * Anchors: Light, acts, like, both, a, wave, and, a, ball.
   */
  jargon:
    "Light, as characterized within quantum electrodynamics, acts in accordance " +
    "with the principle of wave-particle duality, behaving like a phenomenon " +
    "that is both continuous, manifesting as a wave through measurable " +
    "interference patterns, and discrete, functioning as a particulate entity " +
    "not unlike a ball of concentrated energy.",
  simpleWords: ["Light,", "acts", "like", "both", "a", "wave", "and", "a", "ball"],

  gridSetup: "Hard to explain,",
  gridPayoff: "easy to show.",

  gridLabels: {
    charts: "Charts",
    diagrams: "Diagrams",
    timelines: "Timelines",
    code: "Code",
    formulas: "Formulas",
    tables: "Tables",
    images: "Images",
    music: "Music",
    quotes: "Quotes",
  },

  brainIntroSetup: "As you learn things",
  brainIntroPayoff: "your Brain Power increases.",
  brainNeverSetup: "It never goes down.",
  brainPhiloSetup: "Because knowledge",
  brainPhiloPayoff: "is something nobody can take from you.",

  beltSetup: "Become a black belt",
  beltPayoff: "in anything you learn.",
  beltPunchSetup: "Like martial arts.",
  beltPunchPayoff: "But for your brain.",

  energySetup: "Every correct answer",
  energyPayoff: "boosts your energy.",
  energyDipSetup: "Miss a day?",
  energyDipPayoff: "It dips. Just a little.",
  energyRecoversSetup: "Life is messy.",
  energyRecoversPayoff: "But your energy always recovers.",

  patternsSetup: "Zoonk shows your learning patterns",
  patternsPayoff: "so you always know what works.",
  patternsFocusTime: "Tue, 8 AM",
  patternsFocusLabel: "Best focus time",
  patternsAccuracyLabel: "Accuracy",
  patternsWhySetup: "Know when you learn best,",
  patternsWhyPayoff: "so you can be more productive.",

  closingWords: "You can learn anything.",

  website: "zoonk.com",
};

const ptBr: TranslationStrings = {
  searchPlaceholder: "O que você quer aprender?",
  searchQuery: "física quântica",
  chapters: [
    "O que é física quântica?",
    "Ondas e partículas",
    "Superposição",
    "Princípio da incerteza de Heisenberg",
    "Equação de Schrödinger",
    "Entrelaçamento quântico",
    "Colapso da função de onda",
    "Tunelamento quântico",
    "Spin e momento angular",
    "O experimento da dupla fenda",
    "Decoerência quântica",
    "Teoria quântica de campos",
    "Teorema de Bell",
    "Introdução à computação quântica",
    "Interpretações da mecânica quântica",
  ],

  everydaySetup: "Explicamos coisas difíceis",
  everydayPayoff: "usando o que você já conhece.",

  storySetup: "Você aprende",
  storyPayoff: "tomando decisões.",
  storyScenario: "Um cliente quer reembolso após 90 dias. O que você faz?",
  storyChoices: [
    "Ignorar o pedido",
    "Verificar a política de reembolso",
    "Oferecer reembolso total",
  ],
  storyFeedbackSetup: "Errou?",
  storyFeedbackPayoff: "Você vai saber o porquê.",
  storyFeedback: "Ignorar clientes prejudica a confiança e a lealdade.",

  visualsSetup: "Coisas complexas,",
  visualsPayoff: "simplificadas.",

  jargon:
    "A luz, conforme caracterizada pela eletrodinâmica quântica, se comporta " +
    "de acordo com o princípio da dualidade onda-partícula, agindo como um " +
    "fenômeno que é simultaneamente contínuo, manifestando-se como uma onda " +
    "através de padrões mensuráveis de interferência, e discreto, funcionando " +
    "como uma entidade particulada não diferente de uma bola de energia " +
    "concentrada, ao mesmo tempo.",
  simpleWords: [
    "A",
    "luz,",
    "se",
    "comporta",
    "como",
    "uma",
    "onda",
    "e",
    "uma",
    "bola",
    "ao",
    "mesmo",
    "tempo.",
  ],

  gridSetup: "Difícil de explicar,",
  gridPayoff: "fácil de mostrar.",

  gridLabels: {
    charts: "Gráficos",
    diagrams: "Diagramas",
    timelines: "Linhas do tempo",
    code: "Código",
    formulas: "Fórmulas",
    tables: "Tabelas",
    images: "Imagens",
    music: "Música",
    quotes: "Citações",
  },

  brainIntroSetup: "Conforme você aprende",
  brainIntroPayoff: "seu Poder Mental aumenta.",
  brainNeverSetup: "Nunca diminui.",
  brainPhiloSetup: "Porque conhecimento",
  brainPhiloPayoff: "é algo que ninguém pode tirar de você.",

  beltSetup: "Seja faixa preta",
  beltPayoff: "em tudo que você aprender.",
  beltPunchSetup: "Como artes marciais.",
  beltPunchPayoff: "Mas para a sua mente.",

  energySetup: "Cada resposta certa",
  energyPayoff: "aumenta sua energia.",
  energyDipSetup: "Perdeu um dia?",
  energyDipPayoff: "Ela cai. Só um pouco.",
  energyRecoversSetup: "A vida é imprevisível.",
  energyRecoversPayoff: "Mas sua energia sempre se recupera.",

  patternsSetup: "O Zoonk mostra seus padrões de aprendizado",
  patternsPayoff: "para você saber o que funciona.",
  patternsFocusTime: "Ter, 8h",
  patternsFocusLabel: "Melhor horário de foco",
  patternsAccuracyLabel: "Precisão",
  patternsWhySetup: "Saiba quando você aprende melhor,",
  patternsWhyPayoff: "para ser mais produtivo.",

  closingWords: "Você pode aprender qualquer coisa.",

  website: "zoonk.com",
};

const translations: Record<Locale, TranslationStrings> = {
  en,
  "pt-br": ptBr,
};

/** Returns all translation strings for a given locale. */
export function getTranslations(locale: Locale): TranslationStrings {
  return translations[locale];
}
