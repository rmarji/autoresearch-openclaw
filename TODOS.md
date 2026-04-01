# AutoResearch OpenClaw — Future Work

## TODO 1: Resume Interrupted Sessions (P2, Medium)

Add `autoresearch run --resume <session>` to continue from where Ctrl+C/crash left off.

**What:** Persist full session state (iteration count, metric history, current file snapshot) to a JSON file in the session directory. On resume, read state and continue the loop from the last iteration.

**Why:** Long runs (budget=50+) are expensive. Losing progress to a network blip or accidental Ctrl+C wastes time and API credits.

**Depends on:** Core loop (complete).

## TODO 2: Cross-Run Learning (P2, Medium)

Use `hypothesis_log.jsonl` from past sessions to prime the agent with what worked/failed, avoiding repeat experiments.

**What:** Read past hypothesis logs and inject a summary into the agent prompt. The data collection is already built into v1 (hypothesis_log.jsonl).

**Why:** Without this, each session starts from zero. The agent might re-propose changes that failed in previous sessions.

**Depends on:** Core loop + results persistence (complete).
