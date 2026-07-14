import type { ConsistencySampler } from "./ConsistencySampler.js";
import type { AnswerProvider } from "../providers/AnswerProvider.js";
import type { ModelAnswer, SampledAnswer } from "../engine/types.js";

/**
 * True self-consistency (Wang et al., 2022): call the same provider N times at temperature > 0, then vote. Naive exact-match-after-normalize voting fine for short/factual answers. For open-ended prompts, swap `clusterKey` for an embedding-similarity or LLM-based clustering step.
 */
export class MajorityVoteSampler implements ConsistencySampler {
  constructor(private readonly temperature = 0.7) {}

  async sample(
    provider: AnswerProvider,
    prompt: string,
    n: number,
    signal?: AbortSignal,
  ): Promise<SampledAnswer> {
    if (n <= 1) {
      const answer = await provider.generate(prompt, { temperature: 0.2, signal });
      return {
        provider: provider.name,
        finalAnswer: answer.text,
        samples: [answer],
      };
    }

    const samples: ModelAnswer[] = await Promise.all(
      Array.from({ length: n }).map(() =>
        provider.generate(prompt, { temperature: this.temperature, signal }),
      ),
    );

    const votes = new Map<string, { count: number; original: string }>();
    for (const s of samples) {
      const key = this.clusterKey(s.text);
      const entry = votes.get(key);
      if (entry) entry.count += 1;
      else votes.set(key, { count: 1, original: s.text });
    }

    let winner = { count: 0, original: samples[0]!.text };
    for (const entry of votes.values()) {
      if (entry.count > winner.count) winner = entry;
    }

    return {
      provider: provider.name,
      finalAnswer: winner?.original,
      samples,
      confidence: winner.count / n,
    };
  }

  /* Naive normalization for exact-match voting on short/factual answers. */
  private clusterKey(text: string): string {
    return text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[.,!?]/g, "");
  }
}
