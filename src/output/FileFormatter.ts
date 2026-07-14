import type { OutputFormatter } from "./OutputFormatter.js";
import type { EngineResult } from "../engine/types.js";

export type SaveFormat = "md" | "json";

export class FileFormatter implements OutputFormatter {
  readonly fileExtension: string;

  constructor(private readonly saveFormat: SaveFormat = "md") {
    this.fileExtension = saveFormat;
  }

  render(): void {
    // No-op by design - FileFormatter only ever serializes for disk via format(); rendering to the terminal is TerminalFormatter's job.
  }

  format(result: EngineResult): string {
    return this.saveFormat === "json" ? this.toJson(result) : this.toMarkdown(result);
  }

  private toJson(result: EngineResult): string {
    return JSON.stringify(result, null, 2);
  }

  private toMarkdown(result: EngineResult): string {
    const lines: string[] = [
      "# Converge run",
      "",
      `**Question:** ${result.prompt}`,
      "",
      "## Model answers",
      "",
    ];

    for (const s of result.sampled) lines.push(`### ${s.provider}`, s.finalAnswer, "");

    if (result.failures.length) {
      lines.push("## Failures", "");
      for (const f of result.failures) lines.push(`- **${f.provider}**: ${f.error}`);
      lines.push("");
    }

    lines.push("## Synthesized answer", "", result.final.text);
    if (result.final.reasoning) lines.push("", `> ${result.final.reasoning}`);
    if (result.final.sourcesUsed?.length)
      lines.push("", `_Sources: ${result.final.sourcesUsed.join(", ")}_`);

    lines.push("", "## Usage", "");
    for (const [provider, usage] of Object.entries(result.usage.perProvider)) {
      lines.push(
        `- **${provider}**: ${usage.totalTokens} tokens (prompt ${usage.promptTokens} / completion ${usage.completionTokens})`,
      );
    }
    lines.push(
      "",
      `**Total tokens:** ${result.usage.totalTokens}`,
      `**Total time:** ${result.totalLatencyMs}ms`,
    );

    return lines.join("\n");
  }
}
