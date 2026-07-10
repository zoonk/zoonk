import { type TestCase } from "@/lib/types";
import { type generateLessonKind } from "@zoonk/ai/tasks/lessons/kind";
import { type LessonKindExpected } from "./scorer";

type LessonKindInput = Parameters<typeof generateLessonKind>[0];
type LessonKindTestCase = TestCase<LessonKindExpected, LessonKindInput>;

/**
 * Attaches the exact lesson kind used by the deterministic scorer without
 * maintaining a duplicate prose rubric for a judge model.
 */
function lessonKindCase({
  id,
  kind,
  userInput,
}: LessonKindExpected & { id: string; userInput: LessonKindInput }): LessonKindTestCase {
  return { expected: { kind }, id, userInput };
}

export const TEST_CASES: LessonKindTestCase[] = [
  lessonKindCase({
    id: "pt-explanation-kanban-board-structure",
    kind: "explanation",
    userInput: {
      chapterTitle: "Montando um quadro Kanban que mostra o trabalho",
      courseTitle: "Kanban",
      language: "pt",
      lessonDescription:
        "Monte a estrutura visível mínima do quadro para que o trabalho apareça diante dos olhos. Foque no que cada parte física ou digital representa no dia a dia.",
      lessonTitle: "Montando a estrutura visível do quadro",
    },
  }),
  lessonKindCase({
    id: "en-explanation-js-function-concept",
    kind: "explanation",
    userInput: {
      chapterTitle: "Functions, Arrays, and Objects",
      courseTitle: "JavaScript",
      language: "en",
      lessonDescription:
        "Break a repeated task into a named block of code and run it when needed. These ideas make code shorter, easier to read, and easier to change later.",
      lessonTitle: "Turning repeated code into a function",
    },
  }),
  lessonKindCase({
    id: "en-explanation-transformer-attention",
    kind: "explanation",
    userInput: {
      chapterTitle: "Transformers",
      courseTitle: "Machine Learning",
      language: "en",
      lessonDescription:
        "Start with the core operation that made transformers work so well. Trace how a token looks at other tokens and turns those relationships into a new representation.",
      lessonTitle: "Following how one token attends to others",
    },
  }),
  lessonKindCase({
    id: "pt-explanation-petition-structure",
    kind: "explanation",
    userInput: {
      chapterTitle: "Processo Civil",
      courseTitle: "Direito",
      language: "pt",
      lessonDescription:
        "Monte a estrutura mínima da demanda com clareza sobre fatos, fundamento e resultado pretendido. Uma inicial bem construída evita emendas, indeferimento e perda de foco.",
      lessonTitle: "Escrevendo uma petição inicial que se sustenta",
    },
  }),
  lessonKindCase({
    id: "es-explanation-exoplanet-transit",
    kind: "explanation",
    userInput: {
      chapterTitle: "Exoplanetas",
      courseTitle: "Astronomía",
      language: "es",
      lessonDescription:
        "Lee la señal más famosa de los exoplanetas directamente en el brillo estelar. Cada detalle de la caída de luz aporta una pista física sobre el planeta y su órbita.",
      lessonTitle: "Leyendo un planeta cuando cruza su estrella",
    },
  }),
  lessonKindCase({
    id: "en-explanation-indigenous-trade-networks",
    kind: "explanation",
    userInput: {
      chapterTitle: "Indigenous Brazil Before Colonization",
      courseTitle: "Brazilian History",
      language: "en",
      lessonDescription:
        "Track how goods moved across long distances before Europeans arrived. Trade networks linked communities through rivers, trails, and shorelines rather than isolated local worlds.",
      lessonTitle: "Following trade across rivers, trails, and coasts",
    },
  }),
  lessonKindCase({
    id: "en-edge-etymology",
    kind: "explanation",
    userInput: {
      chapterTitle: "History of English",
      courseTitle: "English Language History",
      language: "en",
      lessonDescription: "Discover how English words evolved from Latin, Greek, and Germanic roots",
      lessonTitle: "Word Origins and Etymology",
    },
  }),
  lessonKindCase({
    id: "en-tutorial-git-setup",
    kind: "tutorial",
    userInput: {
      chapterTitle: "Getting Started",
      courseTitle: "Git and GitHub",
      language: "en",
      lessonDescription: "Step-by-step guide to installing and configuring Git on your computer",
      lessonTitle: "How to Set Up Git",
    },
  }),
  lessonKindCase({
    id: "en-tutorial-react-app",
    kind: "tutorial",
    userInput: {
      chapterTitle: "Project Setup",
      courseTitle: "React Development",
      language: "en",
      lessonDescription: "Follow along to create a new React application from scratch",
      lessonTitle: "Creating Your First React App",
    },
  }),
  lessonKindCase({
    id: "es-edge-programming-tutorial-spanish",
    kind: "tutorial",
    userInput: {
      chapterTitle: "Configuración",
      courseTitle: "Desarrollo Web",
      language: "es",
      lessonDescription: "Guía paso a paso para instalar Node.js en tu computadora",
      lessonTitle: "Instalando Node.js",
    },
  }),
  lessonKindCase({
    id: "en-tutorial-trello-first-board",
    kind: "tutorial",
    userInput: {
      chapterTitle: "Getting Started with Trello",
      courseTitle: "Trello for Teams",
      language: "en",
      lessonDescription:
        "Follow the steps to sign up, create your first board in the Trello web app, and invite teammates from the workspace menu.",
      lessonTitle: "Creating Your First Trello Board",
    },
  }),
];
