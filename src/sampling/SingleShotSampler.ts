import type { ConsistencySampler } from "./ConsistencySampler.js";
import type { AnswerProvider } from "../providers/AnswerProvider.js";
import type { SampledAnswer } from "../engine/types.js";

/**
 * Default sampler. Ignores `n` and always returns a single sample.
 */
export class SingleShotSampler implements ConsistencySampler {
  async sample(
    provider: AnswerProvider,
    prompt: string,
    _n: number,
    signal?: AbortSignal,
  ): Promise<SampledAnswer> {
    const answer = await provider.generate(prompt, { signal });
    return {
      provider: provider.name,
      finalAnswer: answer.text,
      samples: [answer],
    };
  }
}
