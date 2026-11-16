import path from "node:path";
import { FORMATTING_MODULE, FORMATTING_SEVERITY, scanFormatting } from "./formatting-rules.mts";

const violations = await scanFormatting(path.join(import.meta.dirname, "../Zoonk"));

for (const violation of violations) {
  process.stderr.write(
    `Zoonk/${violation.file}:${violation.line}: ${FORMATTING_SEVERITY}: CentralizedFormatting: ${violation.call} belongs in ${FORMATTING_MODULE}\n`,
  );
}

process.stdout.write(
  `CentralizedFormatting: ${violations.length} Apple violations (${FORMATTING_SEVERITY})\n`,
);

if (FORMATTING_SEVERITY === "error" && violations.length > 0) {
  process.exitCode = 1;
}
