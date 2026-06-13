// Thrown for expected, user-facing failures. The top-level handler prints the
// message without a stack trace and exits with the given code.
export class CliError extends Error {
  readonly exitCode: number

  constructor(message: string, exitCode = 1) {
    super(message)
    this.name = "CliError"
    this.exitCode = exitCode
  }
}
