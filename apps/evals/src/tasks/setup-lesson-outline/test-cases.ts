import { type TestCase } from "@/lib/types";
import { type SetupLessonOutlineParams } from "@zoonk/ai/tasks/curriculum/setup-lesson-outline";
import { type SetupLessonOutlineExpected } from "./scorer";

export const TEST_CASES: TestCase<SetupLessonOutlineExpected, SetupLessonOutlineParams>[] = [
  {
    expected: { device: "windows", tool: "python" },
    id: "en-python-windows",
    userInput: { language: "en", system: "windows", tool: "Python" },
  },
  {
    expected: { device: "mac", tool: "planilha|sheets|excel" },
    id: "pt-planilha-macos",
    userInput: { language: "pt", system: "macos", tool: "Planilha (Google Planilhas ou Excel)" },
  },
  {
    expected: { device: "linux|ubuntu", tool: "terminal" },
    id: "es-terminal-linux",
    userInput: { language: "es", system: "linux", tool: "Una terminal" },
  },
  {
    expected: { device: "phone|móvil|movil|celular|smartphone", tool: "python" },
    id: "en-python-phone",
    userInput: { language: "en", system: "phone", tool: "Python" },
  },
  {
    expected: { device: "chromebook", tool: "desmos|geogebra|calculadora" },
    id: "pt-calculadora-chromebook",
    userInput: {
      language: "pt",
      system: "chromebook",
      tool: "Calculadora gráfica (Desmos ou GeoGebra)",
    },
  },
  {
    expected: { device: "windows", tool: "python" },
    id: "ja-python-windows",
    userInput: { language: "ja", system: "windows", tool: "Python" },
  },
  {
    expected: { device: "mac|맥", tool: "엑셀|excel|스프레드시트|sheets" },
    id: "ko-spreadsheet-macos",
    userInput: {
      language: "ko",
      system: "macos",
      tool: "스프레드시트 (구글 스프레드시트 또는 엑셀)",
    },
  },
  {
    expected: { device: "linux|ubuntu", tool: "terminal|uçbirim" },
    id: "tr-terminal-linux",
    userInput: { language: "tr", system: "linux", tool: "Terminal" },
  },
];
