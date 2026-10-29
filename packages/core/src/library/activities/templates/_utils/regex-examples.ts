import { Script } from "node:vm";
import { type RegexExamples, runRegexExamples as testExamples } from "./regex-examples.browser";

const REGEX_TIME_LIMIT_MS = 50;

const examplesScript = new Script("testExamples(new RegExp(source, flags), examples)");

export function runRegexExamples(regex: RegExp, examples: RegexExamples): boolean {
  try {
    return (
      examplesScript.runInNewContext(
        { examples, flags: regex.flags, source: regex.source, testExamples },
        { timeout: REGEX_TIME_LIMIT_MS },
      ) === true
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ERR_SCRIPT_EXECUTION_TIMEOUT"
    ) {
      return false;
    }

    throw error;
  }
}
