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
  storyFeedback: string;

  /** Scene: VisualsHeadline */
  visualsSetup: string;
  visualsPayoff: string;

  /** Scene: LanguageTransform */
  jargon: string;
  simple: string;

  /** Scene: VisualsMontage labels */
  labelTimelines: string;
  labelDiagrams: string;
  labelCharts: string;

  /** Scene: VisualsMontage — diagram nodes */
  diagramNodes: string[];

  /** Scene: VisualsGrid labels */
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
  brainNeverPayoff: string;
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
  energyGoneSetup: string;
  energyGonePayoff: string;
  energyPhiloSetup: string;
  energyPhiloPayoff: string;

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
  storyScenario:
    "You're running a laser calibration lab. Your latest readings are inconsistent. " +
    "One sensor says wave, another says particle.",
  storyChoices: [
    "Recalibrate both sensors",
    "Check the observation method",
    "Increase sample size",
  ],
  storyFeedback:
    "Recalibrating won't help — the inconsistency is caused by " +
    "how the measurement is done, not the sensors themselves.",

  visualsSetup: "Complex things,",
  visualsPayoff: "made simple.",

  jargon:
    "Wave-particle duality constitutes a fundamental ontological principle " +
    "within the theoretical framework of quantum mechanics, whereby subatomic " +
    "entities — including but not limited to photons, electrons, and other " +
    "elementary particles — simultaneously exhibit characteristics attributable " +
    "to both classical wave phenomena and discrete corpuscular behavior, as " +
    "empirically demonstrated through interference patterns observed in the " +
    "double-slit experiment, thereby challenging deterministic interpretations " +
    "of physical reality and necessitating a probabilistic reformulation of " +
    "measurement theory within the Copenhagen interpretation.",
  simple: "Light acts like both a wave and a ball.",

  labelTimelines: "Timelines",
  labelDiagrams: "Diagrams",
  labelCharts: "Charts",

  diagramNodes: ["You look at it", "It picks a state", "Now it's definite"],

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
  brainNeverSetup: "Your Brain Power never goes down.",
  brainNeverPayoff: "It only goes up.",
  brainPhiloSetup: "Because knowledge",
  brainPhiloPayoff: "is something nobody can take from you.",

  beltSetup: "Become a black belt",
  beltPayoff: "in anything you learn.",
  beltPunchSetup: "Like martial arts.",
  beltPunchPayoff: "But for your brain.",

  energySetup: "Miss a day?",
  energyPayoff: "Your energy dips a little.",
  energyGoneSetup: "But it doesn't disappear.",
  energyGonePayoff: "It bounces right back.",
  energyPhiloSetup: "No guilt. No punishment.",
  energyPhiloPayoff: "Just pick up where you left off.",

  patternsSetup: "Zoonk tracks your learning patterns",
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
  storyScenario:
    "Você está em um laboratório de calibração a laser. Suas últimas leituras estão inconsistentes. " +
    "Um sensor diz onda, outro diz partícula.",
  storyChoices: [
    "Recalibrar ambos os sensores",
    "Verificar o método de observação",
    "Aumentar o tamanho da amostra",
  ],
  storyFeedback:
    "Recalibrar não vai ajudar — a inconsistência é causada pelo " +
    "método de medição, não pelos sensores em si.",

  visualsSetup: "Coisas complexas,",
  visualsPayoff: "simplificadas.",

  jargon:
    "A dualidade onda-partícula constitui um princípio ontológico fundamental " +
    "dentro do arcabouço teórico da mecânica quântica, segundo o qual entidades " +
    "subatômicas — incluindo, mas não se limitando a fótons, elétrons e outras " +
    "partículas elementares — exibem simultaneamente características atribuíveis " +
    "tanto a fenômenos ondulatórios clássicos quanto ao comportamento corpuscular " +
    "discreto, conforme empiricamente demonstrado por padrões de interferência " +
    "observados no experimento de dupla fenda, desafiando interpretações " +
    "determinísticas da realidade física e necessitando uma reformulação " +
    "probabilística da teoria de medição dentro da interpretação de Copenhague.",
  simple: "A luz se comporta como uma onda e uma bola ao mesmo tempo.",

  labelTimelines: "Linhas do tempo",
  labelDiagrams: "Diagramas",
  labelCharts: "Gráficos",

  diagramNodes: ["Você observa", "Ele escolhe um estado", "Agora é definitivo"],

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
  brainNeverSetup: "Seu Poder Mental nunca diminui.",
  brainNeverPayoff: "Ele só sobe.",
  brainPhiloSetup: "Porque conhecimento",
  brainPhiloPayoff: "é algo que ninguém pode tirar de você.",

  beltSetup: "Conquiste a faixa preta",
  beltPayoff: "em tudo que você aprender.",
  beltPunchSetup: "Como artes marciais.",
  beltPunchPayoff: "Mas para o seu cérebro.",

  energySetup: "Perdeu um dia?",
  energyPayoff: "Sua energia cai um pouco.",
  energyGoneSetup: "Mas não desaparece.",
  energyGonePayoff: "Ela volta rapidinho.",
  energyPhiloSetup: "Sem culpa. Sem punição.",
  energyPhiloPayoff: "Continue de onde parou.",

  patternsSetup: "O Zoonk rastreia seus padrões de aprendizado",
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
