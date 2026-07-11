import { GoogleGenAI } from "@google/genai";

import type { GenerateOptions, ModelAnswer } from "../engine/types.js";
import type { AnswerProvider } from "./AnswerProvider.js";

import { ProviderError } from "./AnswerProvider.js";

export class GeminiProvider implements AnswerProvider {
  readonly name = "gemini" as const;
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.model = model;
    this.client = new GoogleGenAI({ apiKey });
  }

  async generate(prompt: string, options: GenerateOptions = {}): Promise<ModelAnswer> {
    const start = Date.now();

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 1024,
          abortSignal: options.signal,
        },
      });

      const text = response.text ?? "";
      const usage = response.usageMetadata;

      return {
        provider: this.name,
        text,
        latencyMs: Date.now() - start,
        usage: {
          promptTokens: usage?.promptTokenCount ?? 0,
          completionTokens: usage?.candidatesTokenCount ?? 0,
          totalTokens: usage?.totalTokenCount ?? 0,
        },
      };
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new ProviderError(this.name, `Gemini request failed: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }
}
