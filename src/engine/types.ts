import type { FinalAnswer } from "../schemas/finalAnswer.schema.js";
export type { FinalAnswer };

export type ProviderName = "openai" | "claude" | "gemini";

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** A single raw response from one call to one model. */
export interface ModelAnswer {
  provider: ProviderName;
  text: string;
  latencyMs: number;
  usage: TokenUsage;
}

/**
 * The (possibly voted-on) answer for one provider, after sampling.
 * With samplesPerProvider=1 this just wraps a single ModelAnswer.
 * With samplesPerProvider>1, `samples` holds every run and `finalAnswer`
 * is whatever the ConsistencySampler decided was the majority answer.
 */
export interface SampledAnswer {
  provider: ProviderName;
  finalAnswer: string;
  samples: ModelAnswer[];
  confidence?: number;
}

export interface ProviderFailure {
  provider: ProviderName;
  error: string;
}

export interface UsageSummary {
  perProvider: Record<string, TokenUsage>;
  totalTokens: number;
}

export interface EngineResult {
  prompt: string;
  sampled: SampledAnswer[];
  final: FinalAnswer;
  failures: ProviderFailure[];
  usage: UsageSummary;
  totalLatencyMs: number;
}

export interface RunOptions {
  samplesPerProvider?: number;
}
