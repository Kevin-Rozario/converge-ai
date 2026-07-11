import { GenerateOptions, ModelAnswer, ProviderName } from "../engine/types.js";

export class ProviderError extends Error {
  constructor(
    public readonly provider: ProviderName,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ProviderError";
  }
}

export interface AnswerProvider {
  readonly name: ProviderName;
  generate(prompt: string, options?: GenerateOptions): Promise<ModelAnswer>;
}
