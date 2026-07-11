import { z } from "zod";

export const ProviderConfigSchema = z.object({
  apiKey: z.string().optional(),
  model: z.string(),
  enabled: z.boolean().default(true),
});

export const ChaiblendConfigSchema = z.object({
  providers: z.object({
    openai: ProviderConfigSchema,
    claude: ProviderConfigSchema,
    gemini: ProviderConfigSchema,
  }),
  evaluator: z.object({
    provider: z.enum(["openai", "claude", "gemini"]),
    model: z.string(),
  }),
  defaults: z.object({
    samplesPerProvider: z.number().int().min(1).default(1),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().int().positive().default(1024),
    saveFormat: z.enum(["md", "json"]).nullable().default(null),
  }),
  guardrails: z.object({
    minPromptLength: z.number().int().min(1).default(3),
    maxPromptLength: z.number().int().positive().default(4000),
    blockSuspectedInjection: z.boolean().default(true),
  }),
});

export type ChaiblendConfig = z.infer<typeof ChaiblendConfigSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type RunDefaults = ChaiblendConfig["defaults"];
export type GuardrailConfig = ChaiblendConfig["guardrails"];

/** Output-only shape for `config list`- keys redacted, never round-trips to disk. */
export type MaskedConfig = Omit<ChaiblendConfig, "providers"> & {
  providers: Record<string, Omit<ProviderConfig, "apiKey"> & { apiKey: string | null }>;
};
