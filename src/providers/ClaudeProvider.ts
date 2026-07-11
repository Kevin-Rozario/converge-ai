import Anthropic from "@anthropic-ai/sdk";
import type { GenerateOptions, ModelAnswer } from "../engine/types.js";
import type { AnswerProvider } from "./AnswerProvider.js";
import { ProviderError } from "./AnswerProvider.js";

export class ClaudeProvider implements AnswerProvider {
  readonly name = "claude" as const;
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async generate(prompt: string, options: GenerateOptions = {}): Promise<ModelAnswer> {
    const start = Date.now();

    try {
      const response = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: options.maxTokens ?? 1024,
          temperature: options.temperature ?? 0.7,
          messages: [{ role: "user", content: prompt }],
        },
        { signal: options.signal },
      );

      const block = response.content[0];
      const text = block?.type === "text" ? block.text : "";

      return {
        provider: this.name,
        text,
        latencyMs: Date.now() - start,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
      };
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new ProviderError(this.name, `Claude request failed: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }
}
