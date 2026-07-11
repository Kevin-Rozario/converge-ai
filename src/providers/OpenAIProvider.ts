import OpenAI from "openai";
import { GenerateOptions, ModelAnswer } from "../engine/types.js";
import { AnswerProvider } from "./AnswerProvider.js";
import { ProviderError } from "./AnswerProvider.js";

export class OpenAIProvider implements AnswerProvider {
  readonly name = "openai" as const;
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async generate(prompt: string, options: GenerateOptions = {}): Promise<ModelAnswer> {
    const start = Date.now();

    try {
      const response = await this.client.responses.create(
        {
          model: this.model,
          input: prompt,
          temperature: options.temperature ?? 0.7,
          max_output_tokens: options.maxTokens ?? 1024,
        },
        { signal: options.signal },
      );

      const text = response.output_text ?? "";
      const usage = response.usage;

      return {
        provider: this.name,
        text,
        latencyMs: Date.now() - start,
        usage: {
          promptTokens: usage?.input_tokens ?? 0,
          completionTokens: usage?.output_tokens ?? 0,
          totalTokens: usage?.total_tokens ?? 0,
        },
      };
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new ProviderError(this.name, `OpenAI request failed: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }
}
