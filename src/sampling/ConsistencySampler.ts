import type { AnswerProvider } from "../providers/AnswerProvider.js";
import type { SampledAnswer } from "../engine/types.js";

/**
 * Strategy interface for tuning N raw calls to a provider into a single SampledAnswer.
 */
export interface ConsistencySampler {
  sample(
    provider: AnswerProvider,
    prompt: string,
    n: number,
    signal?: AbortSignal,
  ): Promise<SampledAnswer>;
}
