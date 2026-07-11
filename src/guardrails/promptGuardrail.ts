import { z } from "zod";

import type { GuardrailConfig } from "../config/config.schema.js";

export class GuardrailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuardrailError";
  }
}

const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all|any )?(previous|prior|above) instructions/i,
  /disregard (all|any )?(previous|prior|above) instructions/i,
  /forget (everything|all|what) (you|i told)/i,
  /you are now/i,
  /new instructions\s*:/i,
  /system prompt/i,
  /reveal (your|the) (system )?prompt/i,
];

function containsSuspectedInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

/* Input Guardrail - Runs before the prompt is passed to the model */
export function validatePrompt(raw: string, guardrails: GuardrailConfig): string {
  const schema = z
    .string()
    .trim()
    .min(
      guardrails.minPromptLength,
      `Question is too short - minimum ${guardrails.minPromptLength} characters.`,
    )
    .max(
      guardrails.maxPromptLength,
      `Question is too long - keep it under ${guardrails.maxPromptLength} characters.`,
    );

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new GuardrailError(result.error.issues[0]?.message || "Invalid prompt");
  }

  if (guardrails.blockSuspectedInjection && containsSuspectedInjection(result.data)) {
    throw new GuardrailError(
      "This question looks like it's trying to override system instructions rather than ask something. Rephrase it as a genuine question.",
    );
  }

  return result.data;
}
