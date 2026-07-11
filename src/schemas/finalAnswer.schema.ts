import { z } from "zod";

/**
 * Single source of truth for the judge's output shape. Used two ways:
 * 1. Converted to a JSON schema and handed to Claude as a forced tool call,
 *    so the model is structurally constrained at generation time.
 * 2. Re-validated with .safeParse() on the response, as a guardrail in case
 *    the model still produces something off-shape (defense in depth).
 */
export const FinalAnswerSchema = z.object({
  text: z.string().min(1, "Synthesized answer cannot be empty."),
  reasoning: z
    .string()
    .max(500, "Reasoning should be a short justification, not another essay.")
    .optional(),
  sourcesUsed: z
    .array(z.enum(["openai", "claude", "gemini"]))
    .optional()
    .describe("Which provider answers meaningfully contributed to the final answer."),
});

export type FinalAnswer = z.infer<typeof FinalAnswerSchema>;
