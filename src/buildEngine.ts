import type { ProviderName } from "./engine/types.js";
import type { ConsistencySampler } from "./sampling/ConsistencySampler.js";
import type { Synthesizer } from "./synthesis/Synthesizer.js";
import { ConfigManager } from "./config/ConfigManager.js";
import { ProviderFactory } from "./providers/ProviderFactory.js";
import { SingleShotSampler } from "./sampling/SingleShotSampler.js";
import { MajorityVoteSampler } from "./sampling/MajorityVoteSampler.js";
import { ClaudeSynthesizer } from "./synthesis/ClaudeSynthesizer.js";
import { SelfConsistencyEngine } from "./engine/SelfConsistencyEngine.js";

export function buildEngine(
  config: ConfigManager,
  only?: ProviderName[],
  samplesOverride?: number,
): { engine: SelfConsistencyEngine; samplesPerProvider: number } {
  const providers = ProviderFactory.build(config, only);

  const samplesPerProvider = samplesOverride ?? config.getDefaults().samplesPerProvider;
  const sampler: ConsistencySampler =
    samplesPerProvider > 1 ? new MajorityVoteSampler() : new SingleShotSampler();

  const evaluator = config.getEvaluator();
  if (evaluator.provider !== "claude") {
    // Only ClaudeSynthesizer exists right now. The interface supports other judges, but nothing implements them yet.
    // Fail clearly rather than silently ignoring the configured evaluator.
    throw new Error(
      `Evaluator "${evaluator.provider}" has no Synthesizer implementation yet. Run \`converge config set-evaluator claude\`.`,
    );
  }

  const evaluatorKey = config.getKey("claude");
  if (!evaluatorKey) {
    throw new Error(
      "The evaluator needs a Claude key. Run `converge config set-key claude <key>`.",
    );
  }

  const synthesizer: Synthesizer = new ClaudeSynthesizer(evaluatorKey, evaluator.model);
  const guardrails = config.getGuardrailConfig();

  return {
    engine: new SelfConsistencyEngine(providers, sampler, synthesizer, guardrails),
    samplesPerProvider,
  };
}
