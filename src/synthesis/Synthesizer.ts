import type { SampledAnswer, TokenUsage } from "../engine/types.js";
import type { FinalAnswer } from "../schemas/finalAnswer.schema.js";

export class SynthesisError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SynthesisError";
  }
}

export interface SynthesisResult {
  answer: FinalAnswer;
  usage: TokenUsage;
}

/**
 * Strategy interface for the "judge" step. Default implementation uses
 * Claude, but can be swapped with another judge model by creating a new class.
 */
export interface Synthesizer {
  synthesize(
    prompt: string,
    answers: SampledAnswer[],
    signal?: AbortSignal,
  ): Promise<SynthesisResult>;
}
