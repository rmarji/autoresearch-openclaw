import chalk from 'chalk';
import Table from 'cli-table3';
import { listSessions, getSession } from '../../core/results.js';
import { ensureConfig } from '../../utils/config.js';

async function sessionsCommand(action, id) {
  await ensureConfig();

  if (action === 'show' && id) {
    await showSession(id);
  } else {
    await listAllSessions();
  }
}

async function listAllSessions() {
  const sessions = await listSessions();

  if (sessions.length === 0) {
    console.log(chalk.gray('\nNo sessions yet. Run:'));
    console.log(chalk.cyan('  autoresearch run --file <path> --metric "command"'));
    console.log(chalk.cyan('  autoresearch demo\n'));
    return;
  }

  const table = new Table({
    head: [
      chalk.cyan('Session'),
      chalk.cyan('Date'),
      chalk.cyan('Iterations'),
      chalk.cyan('Start'),
      chalk.cyan('End'),
      chalk.cyan('Change')
    ],
    style: { head: [], border: ['gray'] }
  });

  for (const s of sessions) {
    const date = s.date.toISOString().split('T')[0];
    const startMetric = s.startMetric != null ? s.startMetric.toFixed(4) : '—';
    const endMetric = s.endMetric != null ? s.endMetric.toFixed(4) : '—';
    let change = '—';
    if (s.startMetric != null && s.endMetric != null && s.startMetric !== 0) {
      const pct = (s.endMetric - s.startMetric) / Math.abs(s.startMetric) * 100;
      const pctStr = pct.toFixed(1);
      change = pct >= 0 ? chalk.green(`+${pctStr}%`) : chalk.red(`${pctStr}%`);
    }

    table.push([
      chalk.bold(s.name),
      date,
      `${s.iterations || 0} (${s.kept || 0} kept)`,
      startMetric,
      endMetric,
      change
    ]);
  }

  console.log('');
  console.log(chalk.bold('AutoResearch Sessions'));
  console.log(table.toString());
  console.log('');
}

async function showSession(name) {
  const session = await getSession(name);

  if (!session) {
    console.error(chalk.red(`Session not found: ${name}`));
    console.log(chalk.gray('Run `autoresearch sessions list` to see available sessions.'));
    return;
  }

  // Show report if available, otherwise show TSV
  if (session.report) {
    console.log(session.report);
  } else if (session.tsv) {
    console.log(chalk.bold(`\nSession: ${name}\n`));
    console.log(session.tsv);
  } else {
    console.log(chalk.gray(`\nSession ${name} has no results yet.\n`));
  }

  if (session.best) {
    console.log(chalk.bold('\nBest version:'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(session.best);
    console.log(chalk.gray('─'.repeat(60)));
  }

  console.log(chalk.gray(`\nResults directory: ${session.path}\n`));
}

export default sessionsCommand;
