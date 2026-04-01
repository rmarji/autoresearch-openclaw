import chalk from 'chalk';
import boxen from 'boxen';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { runLoop } from '../../core/loop.js';

const SAMPLE_TEMPLATE = `Subject: Quick idea for {{company}}

Hi {{first_name}},

I noticed that your team at {{company}} has been growing rapidly this year. Congratulations on the recent milestones you have achieved.

I help SaaS teams save 10+ hours per week with workflow automation. We have worked with companies similar to yours and have seen great results in terms of productivity improvements.

Would you be open to a quick 15-minute call sometime this week to discuss how we might be able to help your team as well?

Looking forward to hearing from you.

Best regards,
The AutoResearch Team
`;

// Deterministic mock agent: applies pre-defined optimizations
function createMockAgent() {
  const transforms = [
    {
      hypothesis: 'Shortened subject line to under 8 words for higher open rate',
      apply: (content) => content.replace(
        'Subject: Quick idea for {{company}}',
        'Subject: {{company}} + automation?'
      )
    },
    {
      hypothesis: 'Removed generic congratulations filler to get to value prop faster',
      apply: (content) => content.replace(
        /I noticed that your team.*milestones you have achieved\.\n\n/s,
        ''
      )
    },
    {
      hypothesis: 'Made value proposition more specific with concrete number',
      apply: (content) => content.replace(
        'I help SaaS teams save 10+ hours per week with workflow automation.',
        'I help SaaS teams cut manual reporting from 12 hours/week to under 2.'
      )
    },
    {
      hypothesis: 'Simplified CTA from open-ended to yes/no question',
      apply: (content) => content.replace(
        'Would you be open to a quick 15-minute call sometime this week to discuss how we might be able to help your team as well?',
        'Worth a 10-min chat Tuesday or Wednesday?'
      )
    },
    {
      hypothesis: 'Removed filler sentence about similar companies for conciseness',
      apply: (content) => content.replace(
        /We have worked with companies similar.*productivity improvements\.\n\n/s,
        ''
      )
    },
    {
      hypothesis: 'Replaced generic sign-off with personal name for authenticity',
      apply: (content) => content.replace(
        'Looking forward to hearing from you.\n\nBest regards,\nThe AutoResearch Team',
        'Best,\nRayo'
      )
    }
  ];

  return function mockAgent(currentContent, history, iteration) {
    const idx = (iteration - 1) % transforms.length;
    const transform = transforms[idx];
    const newContent = transform.apply(currentContent);

    // If transform didn't change anything, return null
    if (newContent === currentContent) return null;

    return { content: newContent, hypothesis: transform.hypothesis };
  };
}

function runGit(args, cwd) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr.trim() || error.message));
      else resolve(stdout.trim());
    });
  });
}

async function demoCommand(options) {
  const budget = parseInt(options.budget) || 5;

  console.log('');
  console.log(boxen(
    chalk.bold.cyan('AutoResearch Demo') + '\n' +
    chalk.gray('Optimizing a cold outreach template with mock agent'),
    { padding: 1, borderStyle: 'round', borderColor: 'cyan' }
  ));
  console.log(chalk.gray('\n[mock mode — no API key required]\n'));

  // Create temp directory
  const tmpDir = path.join(os.tmpdir(), `autoresearch-demo-${Date.now()}`);
  await fs.ensureDir(tmpDir);

  const templatePath = path.join(tmpDir, 'outreach.md');
  const metricPath = path.join(tmpDir, 'measure.sh');

  try {
    // Write sample template
    await fs.writeFile(templatePath, SAMPLE_TEMPLATE);

    // Write mock metric script (deterministic: rewards conciseness + personalization)
    const metricScript = `#!/bin/bash
FILE="outreach.md"
WORDS=$(wc -w < "$FILE" | tr -d ' ')
LINES=$(wc -l < "$FILE" | tr -d ' ')
TOKENS=$(grep -o '{{[^}]*}}' "$FILE" | wc -l | tr -d ' ')
# Score: base 0.10 + conciseness bonus + personalization bonus
# Fewer words = higher score (max bonus 0.50 at 20 words)
WORD_SCORE=$(echo "scale=4; if ($WORDS < 20) 0.50 else 0.50 * 20 / $WORDS" | bc)
# More personalization tokens = higher score (0.03 per token)
TOKEN_SCORE=$(echo "scale=4; $TOKENS * 0.03" | bc)
# Fewer lines = higher score (max bonus 0.20 at 5 lines)
LINE_SCORE=$(echo "scale=4; if ($LINES < 5) 0.20 else 0.20 * 5 / $LINES" | bc)
SCORE=$(echo "scale=4; 0.10 + $WORD_SCORE + $TOKEN_SCORE + $LINE_SCORE" | bc)
echo "$SCORE"
`;
    await fs.writeFile(metricPath, metricScript);
    await fs.chmod(metricPath, '755');

    // Initialize git repo
    await runGit(['init'], tmpDir);
    await runGit(['add', '.'], tmpDir);
    await runGit(['commit', '-m', 'initial template'], tmpDir);

    // Run optimization loop with mock agent
    await runLoop({
      file: templatePath,
      metricCmd: 'bash measure.sh',
      budget,
      goal: 'maximize',
      session: `demo-${Date.now()}`,
      skill: '',
      mockAgent: createMockAgent()
    });

    console.log(chalk.gray('Demo complete. Try it on your own files:'));
    console.log(chalk.cyan('  autoresearch run --file template.md --metric "bash measure.sh" --budget 20\n'));

  } finally {
    // Cleanup temp directory
    await fs.remove(tmpDir).catch(() => {});
  }
}

export default demoCommand;
