import type { AnswerProvider } from "./AnswerProvider.js";
import type { ConfigManager } from "../config/ConfigManager.js";
import type { ProviderName } from "../engine/types.js";

import { OpenAIProvider } from "./OpenAIProvider.js";
import { ClaudeProvider } from "./ClaudeProvider.js";
import { GeminiProvider } from "./GeminiProvider.js";

/* Builds AnswerProvider instances from whichever providers are configured, keyed, and enabled. */
export class ProviderFactory {
  static build(config: ConfigManager, only?: ProviderName[]): AnswerProvider[] {
    const wanted: ProviderName[] = only ?? ["openai", "claude", "gemini"];
    const providers: AnswerProvider[] = [];

    for (const name of wanted) {
      if (!config.isEnabled(name)) continue;

      const key = config.getKey(name);
      if (!key) continue; // no key → skip silently; engine reports if the resulting list is empty

      const model = config.getModel(name);

      switch (name) {
        case "openai":
          providers.push(new OpenAIProvider(key, model));
          break;
        case "claude":
          providers.push(new ClaudeProvider(key, model));
          break;
        case "gemini":
          providers.push(new GeminiProvider(key, model));
          break;
      }
    }

    return providers;
  }
}
