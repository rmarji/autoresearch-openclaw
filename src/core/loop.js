import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { proposeChange } from './agent.js';
import { runMetric } from './metric.js';
import { isGitRepo, isDirty, commitChange, revertChange } from './git.js';
import { createSession, appendResult, appendHypothesis, writeReport, writeBest } from './results.js';
import { improvementPct } from '../utils/config.js';

export async function runLoop(options) {
  const {
    file,
    metricCmd,
    budget = 20,
    goal = 'maximize',
    session,
    skill = '',
    apiBase,
    apiKey,
    model,
    mockAgent = null
  } = options;

  const filePath = path.resolve(file);
  const cwd = path.dirname(filePath);
  const fileName = path.basename(filePath);

  // Pre-checks
  if (!await fs.pathExists(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  if (!await isGitRepo(cwd)) {
    throw new Error('Not a git repository. Run `git init` in your project directory first.');
  }

  if (await isDirty(fileName, cwd)) {
    throw new Error(`File "${fileName}" has uncommitted changes. Commit or stash them first.`);
  }

  // Measure baseline
  const spinner = ora('Measuring baseline metric...').start();
  let baseline;
  try {
    baseline = await runMetric(metricCmd, cwd);
    spinner.succeed(`Baseline metric: ${chalk.bold(baseline.toFixed(4))}`);
  } catch (error) {
    spinner.fail(`Baseline measurement failed: ${error.message}`);
    throw error;
  }

  // Create session
  const sessionDir = await createSession(session);

  // Track state
  let currentMetric = baseline;
  let bestMetric = baseline;
  let bestContent = await fs.readFile(filePath, 'utf8');
  const iterations = [];
  let interrupted = false;

  // SIGINT handler for graceful shutdown
  const cleanup = async () => {
    interrupted = true;
    console.log(chalk.yellow('\n\nInterrupted. Saving partial results...'));
    await finalize();
    process.exit(0);
  };
  process.on('SIGINT', cleanup);

  async function finalize() {
    if (iterations.length > 0) {
      await writeReport(sessionDir, {
        sessionName: session,
        file: filePath,
        metric: metricCmd,
        goal,
        budget,
        baseline,
        bestMetric,
        iterations
      });
      await writeBest(sessionDir, bestContent);
    }
  }

  // Main loop
  console.log(chalk.gray(`\nStarting optimization loop (${budget} iterations)...\n`));

  for (let i = 1; i <= budget; i++) {
    if (interrupted) break;

    const iterSpinner = ora(`Iteration ${i}/${budget}: Proposing change...`).start();

    // Read current file
    const currentContent = await fs.readFile(filePath, 'utf8');

    // Get proposed change
    let proposal;
    try {
      if (mockAgent) {
        proposal = mockAgent(currentContent, iterations, i);
      } else {
        proposal = await proposeChange(currentContent, iterations, {
          apiBase, apiKey, model, goal, skill
        });
      }
    } catch (error) {
      if (error.message.includes('API key invalid') || error.message.includes('unauthorized')) {
        iterSpinner.fail(error.message);
        await finalize();
        process.removeListener('SIGINT', cleanup);
        throw error;
      }
      iterSpinner.warn(`Iteration ${i}: ${error.message} — skipping`);
      continue;
    }

    if (!proposal) {
      iterSpinner.warn(`Iteration ${i}: No valid proposal — skipping`);
      continue;
    }

    if (proposal.content === currentContent) {
      iterSpinner.warn(`Iteration ${i}: No change proposed — skipping`);
      continue;
    }

    if (!proposal.content.trim()) {
      iterSpinner.warn(`Iteration ${i}: Empty proposal — skipping`);
      continue;
    }

    // Apply change
    iterSpinner.text = `Iteration ${i}/${budget}: Measuring metric...`;
    await fs.writeFile(filePath, proposal.content);

    // Measure new metric
    let newMetric;
    try {
      newMetric = await runMetric(metricCmd, cwd);
    } catch (error) {
      iterSpinner.warn(`Iteration ${i}: Metric failed (${error.message}) — reverting`);
      await revertChange(fileName, cwd);
      continue;
    }

    // Compare
    const improved = goal === 'maximize'
      ? newMetric > currentMetric
      : newMetric < currentMetric;

    const entry = {
      iteration: i,
      metricBefore: currentMetric,
      metricAfter: newMetric,
      kept: improved,
      hypothesis: proposal.hypothesis
    };

    if (improved) {
      await commitChange(fileName, `autoresearch iter ${i}: ${proposal.hypothesis}`, cwd);
      currentMetric = newMetric;

      const isBest = goal === 'maximize' ? newMetric > bestMetric : newMetric < bestMetric;
      if (isBest) {
        bestMetric = newMetric;
        bestContent = proposal.content;
      }

      const pct = improvementPct(entry.metricBefore, newMetric, goal);
      const pctStr = pct === Infinity ? '∞' : pct.toFixed(1);
      iterSpinner.succeed(
        `Iteration ${i}/${budget}: ${entry.metricBefore.toFixed(4)} → ${chalk.green(newMetric.toFixed(4))} (${pct > 0 ? '+' : ''}${pctStr}%) ${chalk.green('✓ kept')} — ${proposal.hypothesis}`
      );
    } else {
      await revertChange(fileName, cwd);
      iterSpinner.info(
        `Iteration ${i}/${budget}: ${entry.metricBefore.toFixed(4)} → ${chalk.red(newMetric.toFixed(4))} ${chalk.red('✗ reverted')} — ${proposal.hypothesis}`
      );
    }

    iterations.push(entry);
    await appendResult(sessionDir, entry);
    await appendHypothesis(sessionDir, entry);
  }

  // Finalize
  process.removeListener('SIGINT', cleanup);
  await finalize();

  // Print summary
  const kept = iterations.filter(i => i.kept).length;
  const improvement = improvementPct(baseline, bestMetric, goal);

  console.log('');
  console.log(chalk.bold('═══════════════════════════════════════════'));
  console.log(chalk.bold('  Optimization Complete'));
  console.log(chalk.bold('═══════════════════════════════════════════'));
  console.log(`  Baseline:     ${baseline.toFixed(4)}`);
  console.log(`  Best:         ${chalk.green(bestMetric.toFixed(4))}`);
  const improvStr = improvement === Infinity ? '∞' : improvement.toFixed(1);
  console.log(`  Improvement:  ${chalk.green(improvStr + '%')}`);
  console.log(`  Kept:         ${kept}/${iterations.length} changes`);
  console.log(`  Results:      ${chalk.cyan(sessionDir)}`);
  console.log(chalk.bold('═══════════════════════════════════════════'));
  console.log('');

  return { baseline, bestMetric, iterations, sessionDir };
}
