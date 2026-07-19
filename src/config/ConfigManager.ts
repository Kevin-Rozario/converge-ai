import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import type {
  ConvergeConfig,
  GuardrailConfig,
  MaskedConfig,
  ProviderConfig,
  RunDefaults,
} from "./config.schema.js";
import type { ProviderName } from "../engine/types.js";

import { ConvergeConfigSchema } from "./config.schema.js";

export class ConfigError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ConfigError";
  }
}

export class ConfigManager {
  private readonly configDir: string;
  private readonly configPath: string;
  private cache: ConvergeConfig | null;

  constructor(configDir?: string) {
    this.configDir = configDir ?? path.join(os.homedir(), ".config", "converge");
    this.configPath = path.join(this.configDir, "config.json");
    this.cache = null;
  }

  // Core load/save
  private load(): ConvergeConfig {
    if (this.cache) return this.cache;

    if (!fs.existsSync(this.configPath)) {
      const defaultConfig = this.createDefaultConfig();
      this.save(defaultConfig);
      return defaultConfig;
    }

    let raw: string;
    try {
      raw = fs.readFileSync(this.configPath, "utf-8");
    } catch (error) {
      throw new ConfigError(`Failed to read config file at ${this.configPath}`, { cause: error });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new ConfigError(
        `Config file at ${this.configPath} is not valid JSON. Fix it manually, or delete it to regenerate defaults.`,
        { cause: error },
      );
    }

    return this.validate(parsed);
  }

  private save(config: ConvergeConfig): void {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), "utf-8");
      this.cache = config;
    } catch (error) {
      throw new ConfigError(`Failed to write config file at ${this.configPath}`, { cause: error });
    }
  }

  private createDefaultConfig(): ConvergeConfig {
    return {
      providers: {
        openai: { model: "gpt-5.6", enabled: true },
        claude: { model: "claude-sonnet-5", enabled: true },
        gemini: { model: "gemini-3.5-flash", enabled: true },
      },
      evaluator: { provider: "claude", model: "claude-sonnet-5" },
      defaults: {
        samplesPerProvider: 1,
        temperature: 0.7,
        maxTokens: 1024,
        saveFormat: null,
      },
      guardrails: {
        minPromptLength: 3,
        maxPromptLength: 4000,
        blockSuspectedInjection: true,
      },
    };
  }

  private validate(raw: unknown): ConvergeConfig {
    const result = ConvergeConfigSchema.safeParse(raw);

    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      throw new ConfigError(
        `Config file at ${this.configPath} is invalid:\n${issues}\nFix it manually, or run \`converge config edit\`.`,
      );
    }

    this.cache = result.data;
    return result.data;
  }

  // Keys
  getKey(provider: ProviderName): string | undefined {
    const config = this.load();
    const stored = config.providers[provider].apiKey;
    if (stored) return stored;

    const envVarMap: Record<ProviderName, string> = {
      openai: "OPENAI_API_KEY",
      claude: "ANTHROPIC_API_KEY",
      gemini: "GEMINI_API_KEY",
    };

    return process.env[envVarMap[provider]];
  }

  setKey(provider: ProviderName, key: string): void {
    const trimmed = key.trim();
    if (!trimmed) {
      throw new ConfigError(`Cannot set an empty API key for ${provider}.`);
    }

    const config = this.load();
    config.providers[provider].apiKey = trimmed;
    this.save(config);
  }

  // Models
  getModel(provider: ProviderName): string {
    return this.load().providers[provider].model;
  }

  setModel(provider: ProviderName, model: string): void {
    const trimmed = model.trim();
    if (!trimmed) {
      throw new ConfigError(`Cannot set an empty model name for ${provider}.`);
    }

    const config = this.load();
    config.providers[provider].model = trimmed;

    // Keep evaluator.model in sync if this provider is the current evaluator -
    // otherwise it silently points at a stale model string.
    if (config.evaluator.provider === provider) {
      config.evaluator.model = trimmed;
    }

    this.save(config);
  }

  // Provider enable/disable
  isEnabled(provider: ProviderName): boolean {
    return this.load().providers[provider].enabled;
  }

  setEnabled(provider: ProviderName, enabled: boolean): void {
    const config = this.load();

    if (!enabled && config.evaluator.provider === provider) {
      throw new ConfigError(
        `Cannot disable ${provider} — it's the current evaluator. Run \`converge config set-evaluator <provider>\` first.`,
      );
    }

    config.providers[provider].enabled = enabled;
    this.save(config);
  }

  // Evaluator
  getEvaluator(): { provider: ProviderName; model: string } {
    const { evaluator } = this.load();
    return { provider: evaluator.provider, model: evaluator.model };
  }

  setEvaluator(provider: ProviderName): void {
    const config = this.load();

    if (!config.providers[provider].enabled) {
      throw new ConfigError(
        `Cannot set ${provider} as evaluator — it's currently disabled. Run \`converge config set-enabled ${provider} true\` first.`,
      );
    }

    config.evaluator = { provider, model: config.providers[provider].model };
    this.save(config);
  }

  // Run defaults
  getDefaults(): RunDefaults {
    return this.load().defaults;
  }

  setDefault<K extends keyof RunDefaults>(key: K, value: RunDefaults[K]): void {
    const config = this.load();
    const next = { ...config, defaults: { ...config.defaults, [key]: value } };
    const validated = this.validate(next);
    this.save(validated);
  }

  // Guardrails

  getGuardrailConfig(): GuardrailConfig {
    return this.load().guardrails;
  }

  // CLI introspection support
  listConfiguredProviders(): ProviderName[] {
    const providers: ProviderName[] = ["openai", "claude", "gemini"];
    return providers.filter((provider) => Boolean(this.getKey(provider)));
  }

  getMaskedConfig(): MaskedConfig {
    const config = this.load();

    const maskKey = (key: string | undefined): string | null => {
      if (!key) return null;
      if (key.length <= 4) return "****";
      return `${key.slice(0, 3)}...${key.slice(-4)}`;
    };

    const maskProvider = (p: ProviderConfig) => ({
      model: p.model,
      enabled: p.enabled,
      apiKey: maskKey(p.apiKey),
    });

    return {
      ...config,
      providers: {
        openai: maskProvider(config.providers.openai),
        claude: maskProvider(config.providers.claude),
        gemini: maskProvider(config.providers.gemini),
      },
    };
  }

  getConfigPath(): string {
    return this.configPath;
  }

  openInEditor(): void {
    this.load();

    const editor = process.env.EDITOR ?? process.env.VISUAL;
    if (!editor) {
      throw new ConfigError(
        `No $EDITOR set. Run \`export EDITOR=vim\` (or nano/code/etc.), or edit the file directly at ${this.configPath}.`,
      );
    }

    const result = spawnSync(editor, [this.configPath], { stdio: "inherit" });
    if (result.error) {
      throw new ConfigError(`Failed to launch editor "${editor}".`, { cause: result.error });
    }

    this.cache = null;
  }
}
