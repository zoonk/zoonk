export const EXIT_CODES = { failed: 1, notLoggedIn: 3, usage: 2 } as const;

type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

export class CliError extends Error {
  readonly exitCode: ExitCode;

  constructor(message: string, exitCode: ExitCode = EXIT_CODES.failed) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

export function usageError(message: string): CliError {
  return new CliError(`${message}\nRun \`pnpm zoonk help\` for usage.`, EXIT_CODES.usage);
}

/** Node's parse errors add advice (about positional arguments, or `--x=-XYZ`) no command here needs. */
export function describeParseError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const unknown = /^Unknown option '[^']+'\./u.exec(message)?.[0];

  const missing =
    /^Option '(?<option>--[a-z-]+)(?: <value>)?' argument (?:missing|is ambiguous)/u.exec(message)
      ?.groups?.option;

  return unknown ?? (missing ? `${missing} needs a value.` : message);
}
