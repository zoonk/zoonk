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
