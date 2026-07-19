# Converge AI

Ask multiple AI models the same question, get one answer back that's actually better than any single one of them.

```
converge ask "What's the time complexity of merge sort?"
```

## What this is

Built for the "Self-Consistency Answer Engine" brief (GenAI with JS 2026), with one terminology nitpick worth stating up front: what the brief calls "self-consistency" - ask a few different models the same thing, then have a judge model synthesize is really multi-model ensembling. True self-consistency (Wang et al., 2022) means sampling _one_ model multiple times and voting on the results. Converge AI does the brief's actual flow by default, and supports real self-consistency as an opt-in (`--samples`, more below).

It's a CLI. No server, no deployment, nothing to host. Runs on your machine with your own API keys.

## How it works

You ask something, once. Converge AI fires the question at OpenAI, Claude, and Gemini in parallel, shows you what each one said, then hands all three answers to a judge (Claude) that actually reads them, figures out what's strongest in each, and writes one final answer and it's not a copy-paste of whichever model sounded most confident.

## Providers

| Role   | Provider | Model              |
| ------ | -------- | ------------------ |
| Answer | OpenAI   | `gpt-5.6`          |
| Answer | Claude   | `claude-sonnet-5`  |
| Answer | Gemini   | `gemini-3.5-flash` |
| Judge  | Claude   | `claude-sonnet-5`  |

All swappable in config, see below.

## Install

```bash
pnpm install
pnpm build
pnpm link --global
```

Now `converge` works from anywhere. Not on npm - this is a local tool for local use.

## Configuring it

Everything lives in `~/.config/converge/config.json`, auto-created with defaults the first time you touch the CLI.

```bash
converge config set-key <provider> <key>
converge config set-model <provider> <model>
converge config set-evaluator <provider>
converge config set-default <key> <value>
converge config list
converge config path
converge config edit
```

Keys can also come from env vars (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) if you'd rather not run a command for it. See `.env.example`. Config file wins if both are set.

## Using it

```bash
converge ask "What's the time complexity of merge sort?"
converge ask "..." --models openai,claude      # skip a provider
converge ask "..." --samples 3                 # real self-consistency, see below
converge ask "..." --save md                   # dump a transcript to a file
```

Or just run `converge` with nothing after it for an interactive prompt - same result, friendlier for one-off questions.

Ctrl+C cancels a run mid-flight instead of leaving you staring at a hung terminal. Hit it twice if something's really stuck and you want out immediately.

Every question is a fresh start and Converge AI doesn't remember what you asked five minutes ago.

## Self-consistency mode

`--samples 3` calls each provider three times at a higher temperature and votes on the most common answer, instead of asking once. This is the _actual_ self-consistency technique, layered on top of the ensembling the brief asks for. Off by default because it triples your API spend for a question that usually doesn't need it.

## On the guardrails, honestly

Two things are protecting this pipeline, and I'd rather be upfront about what they actually do than oversell them:

The input check screens for obviously injection-flavored phrasing ("ignore previous instructions" and the like) before a question ever reaches a model. It'll catch someone being lazy about it. It will not catch someone who's actually trying that's a keyword filter, not a security boundary, and I'm not going to pretend otherwise.

The part doing real work is that every model's raw answer gets wrapped in explicit tags before the judge sees it, with the judge's system prompt telling it flat out to treat that content as data, not instructions. The judge's own output is forced through a schema via tool-use, so even if something upstream tried to steer it, the response still has to come out in the shape we asked for. That's structural, not a filter, and it's the layer actually worth trusting.

One more thing worth knowing: Ctrl+C on the Gemini call only stops _you_ from waiting on it. Google's own docs say the request keeps running server-side and you still get billed. Doesn't apply to OpenAI or Claude, both of which cancel for real.

## How it's put together

Four things vary independently here, so each got its own interface instead of a pile of if-statements:

- `AnswerProvider` - one class per model
- `ConsistencySampler` - single-shot by default, majority-vote for `--samples`
- `Synthesizer` - the judge (just Claude for now, but swappable)
- `OutputFormatter` - terminal output vs. saved file

One `SelfConsistencyEngine` wires all three runtime pieces together and runs the actual flow: check the input, fan out to providers, tolerate whichever ones fail, hand survivors to the judge, tally up token usage.

```plaintext
src/
  cli.ts, interactive.ts       # where concrete classes actually get built
  engine/                      # the orchestrator + shared types
  providers/                   # one file per model
  sampling/                    # single-shot / majority-vote
  synthesis/                   # the judge
  schemas/                     # zod schemas for structured output
  guardrails/                  # input checks + delimiter wrapping
  output/                      # terminal / file formatting
  config/                      # everything config.json related
```

## License

This project is licensed under the MIT License. For more details, see the [LICENSE](LICENSE) file.
