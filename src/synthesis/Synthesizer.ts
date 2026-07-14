import type { SampledAnswer } from "../engine/types.js";
import type { FinalAnswer } from "../engine/types.js";

export class SynthesisError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SynthesisError";
  }
}

/**
 * Strategy interface for "judge" step. Default implementation uses Claude, but can be swapped with other judge model by creating new class.
 */
export interface Synthesizer {
  synthesize(prompt: string, answers: SampledAnswer[]): Promise<FinalAnswer>;
}
