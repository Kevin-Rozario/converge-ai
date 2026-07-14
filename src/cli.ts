#!/usr/bin/env node
import { Command } from "commander";
import { spinner, log } from "@clack/prompts";
import fs from "node:fs";
import type { ProviderName } from "./engine/types.js";
import type { SaveFormat } from "./output/FileFormatter.js";
import { ConfigManager } from "./config/ConfigManager.js";
import { buildEngine } from "./buildEngine.js";
import { TerminalFormatter } from "./output/TerminalFormatter.js";
import { FileFormatter } from "./output/FileFormatter.js";
import { printCliError } from "./cliErrorHandler.js";
import { runInteractive } from "./interactive.js";

const program = new Command();

program
  .name("converge")
  .description("Multi-model AI ensembling and self-consistency framework")
  .version("1.0.0");

program
  .command("ask")
  .argument("<question>", "the question to ask")
  .option("-m, --models <list>", "comma-separated: openai,claude,gemini (default: all configured)")
  .option("-s, --samples <n>", "samples per provider (true self-consistency)")
  .option("--save <format>", "save transcript: md or json")
  .action(async (question: string, opts) => {
    const config = new ConfigManager();
    const only = opts.models
      ? (opts.models.split(",").map((p: string) => p.trim()) as ProviderName[])
      : undefined;
    const samples = opts.samples ? parseInt(opts.samples, 10) : undefined;

    // First Ctrl+C aborts in-flight calls cleanly; a second one force-exits in case a request is hung and never resolves after the abort.
    let aborted = false;
    const controller = new AbortController();
    const onSigint = () => {
      if (aborted) {
        console.log("\nForce exiting.");
        process.exit(130);
      }
      aborted = true;
      controller.abort();
    };
    process.on("SIGINT", onSigint);

    const s = spinner();

    try {
      const { engine, samplesPerProvider } = buildEngine(config, only, samples);
      s.start(`Asking ${only?.join(", ") ?? "configured"} model(s)...`);

      const result = await engine.run(question, { samplesPerProvider }, controller.signal);
      s.stop("Done");

      new TerminalFormatter().render(result);

      if (opts.save) {
        const formatter = new FileFormatter(opts.save as SaveFormat);
        const filename = `converge-${Date.now()}.${formatter.fileExtension}`;
        fs.writeFileSync(filename, formatter.format(result), "utf-8");
        log.info(`Saved to ${filename}`);
      }
    } catch (error) {
      s.stop("Failed");
      const wasCancelled = printCliError(error);
      process.exitCode = wasCancelled ? 130 : 1;
    } finally {
      process.off("SIGINT", onSigint);
    }
  });

const configCmd = program.command("config").description("manage configuration");

configCmd
  .command("set-key")
  .argument("<provider>")
  .argument("<key>")
  .action((provider: ProviderName, key: string) => {
    try {
      new ConfigManager().setKey(provider, key);
      log.success(`Saved key for ${provider}.`);
    } catch (error) {
      printCliError(error);
      process.exitCode = 1;
    }
  });

configCmd
  .command("set-model")
  .argument("<provider>")
  .argument("<model>")
  .action((provider: ProviderName, model: string) => {
    try {
      new ConfigManager().setModel(provider, model);
      log.success(`Set ${provider} model to ${model}.`);
    } catch (error) {
      printCliError(error);
      process.exitCode = 1;
    }
  });

configCmd
  .command("set-evaluator")
  .argument("<provider>")
  .action((provider: ProviderName) => {
    try {
      new ConfigManager().setEvaluator(provider);
      log.success(`Evaluator set to ${provider}.`);
    } catch (error) {
      printCliError(error);
      process.exitCode = 1;
    }
  });

configCmd
  .command("set-default")
  .argument("<key>")
  .argument("<value>")
  .action((key: string, value: string) => {
    try {
      const parsed = /^\d+(\.\d+)?$/.test(value) ? Number(value) : value === "null" ? null : value;
      // @ts-expect-error - narrowed against RunDefaults' actual keys at runtime by setDefault's own validation
      new ConfigManager().setDefault(key, parsed);
      log.success(`Set default ${key} to ${value}.`);
    } catch (error) {
      printCliError(error);
      process.exitCode = 1;
    }
  });

configCmd.command("list").action(() => {
  console.log(JSON.stringify(new ConfigManager().getMaskedConfig(), null, 2));
});

configCmd.command("path").action(() => {
  console.log(new ConfigManager().getConfigPath());
});

configCmd.command("edit").action(() => {
  try {
    new ConfigManager().openInEditor();
  } catch (error) {
    printCliError(error);
    process.exitCode = 1;
  }
});

if (process.argv.length <= 2) {
  runInteractive();
} else {
  program.parse();
}
