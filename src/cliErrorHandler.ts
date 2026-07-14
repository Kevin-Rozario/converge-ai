import { GuardrailError } from "./guardrails/promptGuardrail.js";
import { ConfigError } from "./config/ConfigManager.js";
import { ProviderError } from "./providers/AnswerProvider.js";
import { SynthesisError } from "./synthesis/Synthesizer.js";
import { EngineCancelledError } from "./engine/SelfConsistencyEngine.js";

/** Returns true if the error was a cancellation. */
export function printCliError(error: unknown): boolean {
  if (error instanceof EngineCancelledError) {
    console.log("\nCancelled - no partial results to show.");
    return true;
  }

  if (
    error instanceof GuardrailError ||
    error instanceof ConfigError ||
    error instanceof ProviderError ||
    error instanceof SynthesisError
  ) {
    console.error(error.message);
    return false;
  }

  console.error(error instanceof Error ? error.message : String(error));
  return false;
}
