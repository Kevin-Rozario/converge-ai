import { intro, outro, text, spinner, isCancel, cancel } from "@clack/prompts";
import { ConfigManager } from "./config/ConfigManager.js";
import { buildEngine } from "./buildEngine.js";
import { TerminalFormatter } from "./output/TerminalFormatter.js";
import { printCliError } from "./cliErrorHandler.js";

export async function runInteractive(): Promise<void> {
  intro("converge");

  const question = await text({ message: "What do you want to ask?" });

  if (isCancel(question)) {
    cancel("Cancelled.");
    process.exit(130);
  }

  const config = new ConfigManager();

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
    const { engine, samplesPerProvider } = buildEngine(config);
    s.start("Asking configured models...");

    const result = await engine.run(question, { samplesPerProvider }, controller.signal);
    s.stop("Done");

    new TerminalFormatter().render(result);
    outro("Done.");
  } catch (error) {
    s.stop("Failed");
    const wasCancelled = printCliError(error);
    process.exitCode = wasCancelled ? 130 : 1;
  } finally {
    process.off("SIGINT", onSigint);
  }
}
