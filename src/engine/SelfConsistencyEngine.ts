import type { AnswerProvider } from "../providers/AnswerProvider.js";
import type { ConsistencySampler } from "../sampling/ConsistencySampler.js";
import type { Synthesizer } from "../synthesis/Synthesizer.js";
import type { GuardrailConfig } from "../config/config.schema.js";
import type {
  EngineResult,
  ProviderFailure,
  RunOptions,
  SampledAnswer,
  TokenUsage,
} from "./types.js";
import { validatePrompt } from "../guardrails/promptGuardrail.js";
import { delimit } from "../guardrails/delimit.js";

export class EngineCancelledError extends Error {
  constructor(message = "Run cancelled") {
    super(message);
    this.name = "EngineCancelledError";
  }
}

export class SelfConsistencyEngine {
  constructor(
    private readonly providers: AnswerProvider[],
    private readonly sampler: ConsistencySampler,
    private readonly synthesizer: Synthesizer,
    private readonly guardrails: GuardrailConfig,
  ) {}

  async run(prompt: string, options: RunOptions = {}, signal?: AbortSignal): Promise<EngineResult> {
    if (signal?.aborted) throw new EngineCancelledError();

    if (this.providers.length === 0) {
      throw new EngineCancelledError(
        "No providers configured. Run `chai config set-key <provider> <key>` first.",
      );
    }

    const start = Date.now();

    // Input guardrail: Reject bad/suspicious input before spending a single API call.
    const validatedPrompt = validatePrompt(prompt, this.guardrails);
    const delimitedPrompt = delimit("user_question", validatedPrompt);

    const n = options.samplesPerProvider ?? 1;

    const settled = await Promise.allSettled(
      this.providers.map((p) => this.sampler.sample(p, delimitedPrompt, n, signal)),
    );

    if (signal?.aborted) throw new EngineCancelledError();

    const sampled: SampledAnswer[] = [];
    const failures: ProviderFailure[] = [];

    settled.forEach((result, i) => {
      if (result.status === "fulfilled") {
        sampled.push(result.value);
      } else {
        failures.push({
          provider: this.providers[i]!.name,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    });

    if (sampled.length === 0) {
      if (signal?.aborted) throw new EngineCancelledError();

      throw new Error(
        `All providers failed. Check API keys and network.\n${failures
          .map((f) => `  ${f.provider}: ${f.error}`)
          .join("\n")}`,
      );
    }

    const { answer: final, usage: judgeUsage } = await this.synthesizer.synthesize(
      validatedPrompt,
      sampled,
      signal,
    );

    if (signal?.aborted) throw new EngineCancelledError();

    return {
      prompt: validatedPrompt,
      sampled,
      final,
      failures,
      usage: this.summarizeUsage(sampled, judgeUsage),
      totalLatencyMs: Date.now() - start,
    };
  }

  private summarizeUsage(sampled: SampledAnswer[], judgeUsage: TokenUsage): EngineResult["usage"] {
    const perProvider: EngineResult["usage"]["perProvider"] = {};
    let totalTokens = 0;

    for (const answer of sampled) {
      const usage = answer.samples.reduce(
        (acc, s) => ({
          promptTokens: acc.promptTokens + s.usage.promptTokens,
          completionTokens: acc.completionTokens + s.usage.completionTokens,
          totalTokens: acc.totalTokens + s.usage.totalTokens,
        }),
        { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      );

      perProvider[answer.provider] = usage;
      totalTokens += usage.totalTokens;
    }

    perProvider["judge"] = judgeUsage;
    totalTokens += judgeUsage.totalTokens;

    return { perProvider, totalTokens };
  }
}
