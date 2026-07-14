import { log } from "@clack/prompts";
import type { OutputFormatter } from "./OutputFormatter.js";
import type { EngineResult } from "../engine/types.js";

const PROVIDER_ICON: Record<string, string> = {
  openai: "O",
  claude: "C",
  gemini: "G",
};

export class TerminalFormatter implements OutputFormatter {
  readonly fileExtension = "txt";

  render(result: EngineResult): void {
    log.message(result.prompt, { symbol: "?" });

    for (const s of result.sampled) {
      const icon = PROVIDER_ICON[s.provider] ?? "Ai";
      log.message(`${s.provider}\n${s.finalAnswer}`, { symbol: icon });
      if (s.confidence !== undefined) {
        log.info(`confidence: ${(s.confidence * 100).toFixed(0)}% (${s.samples.length} samples)`);
      }
    }

    for (const f of result.failures) {
      log.warn(`${f.provider}: ${f.error}`);
    }

    log.success(result.final.text);
    if (result.final.reasoning) log.message(result.final.reasoning, { symbol: "·" });
    if (result.final.sourcesUsed?.length) {
      log.info(`Sources: ${result.final.sourcesUsed.join(", ")}`);
    }

    const usageLines = Object.entries(result.usage.perProvider)
      .map(
        ([name, u]) =>
          `${name.padEnd(8)} ${u.totalTokens} tokens (prompt ${u.promptTokens} / completion ${u.completionTokens})`,
      )
      .join("\n");
    log.info(`${usageLines}\n\nTotal: ${result.usage.totalTokens} tokens`);

    log.step(`${result.totalLatencyMs}ms total`);
  }

  format(result: EngineResult): string {
    // Plain-text fallback for interface conformance and --save uses FileFormatter and not this.
    const lines: string[] = [`Question: ${result.prompt}`, ""];
    for (const s of result.sampled) lines.push(`--- ${s.provider} ---`, s.finalAnswer, "");
    if (result.failures.length) {
      lines.push("Failures:", ...result.failures.map((f) => `  ${f.provider}: ${f.error}`), "");
    }
    lines.push("=== Synthesized answer ===", result.final.text);
    if (result.final.reasoning) lines.push("", `Reasoning: ${result.final.reasoning}`);
    return lines.join("\n");
  }
}
