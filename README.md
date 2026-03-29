# AutoResearch OpenClaw

> **Autonomous optimization loop for any text asset with a scalar metric.**
> 
> Inspired by [Karpathy's autoresearch](https://github.com/karpathy/autoresearch). Packaged for OpenClaw.

[![GitHub stars](https://img.shields.io/github/stars/rmarji/autoresearch-openclaw.svg?style=social)](https://github.com/rmarji/autoresearch-openclaw)
[![npm version](https://img.shields.io/npm/v/autoresearch-openclaw.svg?style=flat-square)](https://www.npmjs.com/package/autoresearch-openclaw)
[![license](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![built for OpenClaw](https://img.shields.io/badge/built%20for-OpenClaw-brightgreen?style=flat-square)](https://github.com/openclaw/openclaw)

> ⭐ **If this saves you time, a star helps others find it.**

## What It Does

Give AutoResearch a file and a metric command:

```bash
autoresearch run \
  --file ./my-prompt.md \
  --metric "python eval-prompt.py" \
  --budget 30
```

It runs a loop:

1. **Read** your current file
2. **Agent proposes** ONE targeted change
3. **Measure** the metric after applying it
4. **Keep** if improved, **revert** if worse
5. **Repeat** until budget exhausted

Wake up to a report showing which experiments worked, what changed, and the best version found.

## Quick Start

### 1. Install

```bash
npm install -g autoresearch-openclaw
# or
npx autoresearch-openclaw init
```

### 2. Initialize workspace

```bash
autoresearch init
```

Creates `~/.autoresearch/config.json` and prints your dashboard.

### 3. Try the demo

```bash
autoresearch demo --budget 5
```

Optimizes a sample cold outreach template (no setup required).

### 4. Run on your own file

```bash
# First, set up git in your project directory
cd my-project && git init && git add . && git commit -m "initial"

# Then run autoresearch
autoresearch run \
  --file ./outreach-template.md \
  --metric "bash measure-reply-rate.sh" \
  --budget 20
```

## How It Works

```
┌──────────────────────────────────────────────────────────────┐
│                    AutoResearch Loop                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Baseline metric    → Read file, measure starting point   │
│                                                              │
│  2. Iteration (1..N)   → For each iteration:                 │
│     - Read current file                                      │
│     - Agent proposes ONE change                              │
│     - Apply change, measure metric                           │
│     - If improved → git commit (keep)                        │
│     - If worse   → git checkout (revert)                     │
│     - Log to results.tsv                                     │
│                                                              │
│  3. Final report       → Summary of all experiments          │
│                        → Best version snapshot               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

The AI agent receives:
- The current file content
- Optimization instructions (domain-specific)
- History of previous iterations (to avoid retry loops)

The agent must propose exactly ONE change with a clear hypothesis.

## Commands

```
autoresearch init                          Initialize workspace
autoresearch run --file <path> \
  --metric "command" [--budget 20]         Run optimization
autoresearch status                        Show dashboard
autoresearch sessions list                 List all past runs
autoresearch sessions show <id>            Show session details
autoresearch demo [--budget 5]             Try the demo
autoresearch skills                        List bundled skills
```

## Bundled Skills

### prompt-optimizer
Optimize system prompts against evaluation scores.
```bash
autoresearch run --skill prompt-optimizer \
  --file system-prompt.md \
  --metric "python eval.py"
```

### outreach-optimizer
Optimize cold email templates for reply rates.
```bash
autoresearch run --skill outreach-optimizer \
  --file outreach.md \
  --metric "bash measure-reply-rate.sh"
```

### content-optimizer
Optimize blog posts and landing copy.
```bash
autoresearch run --skill content-optimizer \
  --file blog-post.md \
  --metric "python score-engagement.py"
```

### config-tuner
Tune YAML/JSON config files against benchmarks.
```bash
autoresearch run --skill config-tuner \
  --file config.yaml \
  --metric "bash benchmark.sh" \
  --goal minimize
```

### prediction-optimizer
Optimize prediction market strategies.
```bash
autoresearch run --skill prediction-optimizer \
  --file strategy.md \
  --metric "python evaluate-brier.py" \
  --goal minimize
```

## Config

Located at `~/.autoresearch/config.json`:

```json
{
  "version": "1.0.0",
  "model": "claude",
  "defaultBudget": 20,
  "resultsDir": "/home/user/.autoresearch/results"
}
```

## Results

Each session creates:
- `results.tsv` — Experiment log: iteration, before/after metrics, kept/reverted, change description
- `report.md` — Human-readable summary
- `best.md` — Snapshot of best-performing file version
- `hypothesis_log.jsonl` — Agent hypotheses (for learning across runs)

Example `results.tsv`:
```
iteration   metric_before   metric_after   kept     change_desc
1           0.12           0.14           kept     Shortened subject line from 12 to 8 words
2           0.14           0.13           reverted Increased emotional appeal score
3           0.14           0.17           kept     Added personalization tokens {{first_name}}
```

## Dashboard

```
═════════════════════════════════════════════════════════════
                  AutoResearch Dashboard
───────────────────────────────────────────────────────────────
Today:     3 sessions, best gain +42%
All time:  18 sessions, avg gain +28%

Active Runs
───────────────────────────────────────────────────────────────
outreach-mar27   iter 12/30   0.23 → 0.41  (+78%)  ⏳ running
prompt-v2        iter 5/20    0.60 → 0.67  (+12%)  ⏳ running

Recent Sessions
───────────────────────────────────────────────────────────────
prediction-mar25  0.35 → 0.67  (+91%)   (30 iters)
outreach-mar24    0.12 → 0.28  (+133%)  (30 iters)
═════════════════════════════════════════════════════════════
```

## OpenClaw Integration

AutoResearch works with OpenClaw agents. Bundled skills are auto-discovered:

1. Install autoresearch-openclaw
2. Skills appear in OpenClaw agent menus
3. Agents trigger with: "optimize my prompt", "improve this template", etc.

## Safety

✅ **Budget cap enforced** — loop never exceeds specified iterations  
✅ **Git-based revert** — every bad change is instantly reversed  
✅ **No file deletion** — only edits to specified file  
✅ **Atomic commits** — each improvement committed separately  
✅ **Reversible** — full experiment history in git log  

## Architecture

```
autoresearch-openclaw (npm package)
├── bin/autoresearch.js          CLI entry
├── src/cli/
│   ├── index.js                 Command router
│   └── commands/
│       ├── init.js
│       ├── run.js
│       ├── status.js
│       ├── demo.js
│       ├── skills.js
│       └── sessions.js
└── src/utils/
    ├── config.js
    └── version.js
```

## Examples

### Optimize an outreach template

```bash
# 1. Create template
cat > outreach.md << 'EOF'
Subject: Quick idea for {{company}}

Hi {{first_name}},

I help SaaS teams save 10+ hours per week with automation.

Would you be open to a 15-min call?

Best,
Rayo
EOF

# 2. Create metric script
cat > measure.sh << 'EOF'
#!/bin/bash
# Return mock reply rate (0-1)
python3 -c "
import hashlib
with open('$1') as f:
    h = hashlib.md5(f.read().encode()).hexdigest()
    base = 0.10 + (int(h[:8], 16) % 1000) / 4000
    # Reward conciseness
    if len(open('$1').read().split()) < 100:
        base += 0.05
    print(f'{min(0.4, base):.4f}')
"
EOF
chmod +x measure.sh

# 3. Run autoresearch
git init && git add . && git commit -m "initial"
autoresearch run \
  --file outreach.md \
  --metric "bash measure.sh" \
  --budget 20 \
  --session "outreach-jan"

# 4. Check results
autoresearch sessions show outreach-jan
cat ~/.autoresearch/results/outreach-jan/best.md
```

### Optimize a system prompt

```bash
# Create eval script that scores your prompt
cat > eval.py << 'EOF'
import json
from anthropic import Anthropic

def score_prompt(prompt_file):
    with open(prompt_file) as f:
        prompt = f.read()
    
    # Test the prompt against a few cases
    client = Anthropic()
    score = 0
    for test in ["simple math", "logic puzzle", "creative writing"]:
        response = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=100,
            system=prompt,
            messages=[{"role": "user", "content": f"Try this: {test}"}]
        )
        # Score based on response quality (simplified)
        score += 0.3 if len(response.content[0].text) > 50 else 0.1
    
    return score / 3

if __name__ == "__main__":
    import sys
    print(f"{score_prompt(sys.argv[1]):.4f}")
EOF

# Run autoresearch
autoresearch run \
  --file system-prompt.md \
  --metric "python eval.py" \
  --budget 25 \
  --skill prompt-optimizer
```

## Limitations

- Requires a scalar metric command (returns one float)
- Works best with small files (<10KB)
- AI agent calls are sequential (not parallel)
- Metric evaluation can be slow (budget × metric_time)

## Requirements

- Node.js >=18
- Git (for safe revert)
- Claude CLI or OpenAI API (for the agent)

## Contributing

Issues and PRs welcome at [github.com/rmarji/autoresearch-openclaw](https://github.com/rmarji/autoresearch-openclaw).

## License

MIT — see [LICENSE](LICENSE)

---

**Built with ❤️ by [@rmarji](https://twitter.com/rmarji)** — [OpenClaw](https://github.com/openclaw/openclaw) founder
