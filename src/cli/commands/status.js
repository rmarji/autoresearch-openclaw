import chalk from 'chalk';
import boxen from 'boxen';
import { loadConfig, isInitialized } from '../../utils/config.js';
import { listSessions } from '../../core/results.js';

async function statusCommand() {
  if (!isInitialized()) {
    console.log(chalk.yellow('\n  AutoResearch not initialized.'));
    console.log(chalk.gray('   Run ') + chalk.cyan('autoresearch init') + chalk.gray(' first.\n'));
    return;
  }

  const config = await loadConfig();
  const sessions = await listSessions();

  // Compute aggregate stats
  let totalKept = 0;
  let totalIter = 0;
  let bestGain = 0;
  const recentSessions = sessions.slice(0, 5);

  for (const s of sessions) {
    totalIter += s.iterations || 0;
    totalKept += s.kept || 0;
    if (s.startMetric != null && s.endMetric != null && s.startMetric !== 0) {
      const pct = (s.endMetric - s.startMetric) / Math.abs(s.startMetric) * 100;
      if (pct > bestGain) bestGain = pct;
    }
  }

  // Dashboard
  const dashLines = [
    chalk.bold.white('AutoResearch Dashboard'),
    '',
    chalk.gray(`Sessions:     `) + chalk.white(`${sessions.length} total`),
    chalk.gray(`Iterations:   `) + chalk.white(`${totalIter} total, ${totalKept} kept`),
    chalk.gray(`Best gain:    `) + (bestGain > 0 ? chalk.green(`+${bestGain.toFixed(1)}%`) : chalk.white('—')),
    chalk.gray(`Model:        `) + chalk.white(config.model || 'not set'),
    chalk.gray(`Budget:       `) + chalk.white(`${config.defaultBudget || 20} iterations`)
  ];

  console.log('');
  console.log(boxen(dashLines.join('\n'), {
    padding: 1,
    borderStyle: 'round',
    borderColor: 'cyan'
  }));
  console.log('');

  if (recentSessions.length === 0) {
    console.log(chalk.gray('No sessions yet. Get started:'));
    console.log(chalk.cyan('  autoresearch demo'));
    console.log(chalk.cyan('  autoresearch run --file <path> --metric "command"'));
  } else {
    console.log(chalk.bold('Recent Sessions'));
    console.log(chalk.gray('─'.repeat(60)));
    for (const s of recentSessions) {
      const startStr = s.startMetric != null ? s.startMetric.toFixed(2) : '?';
      const endStr = s.endMetric != null ? s.endMetric.toFixed(2) : '?';
      let changeStr = '';
      if (s.startMetric != null && s.endMetric != null && s.startMetric !== 0) {
        const pct = (s.endMetric - s.startMetric) / Math.abs(s.startMetric) * 100;
        const pctStr = pct.toFixed(0);
        changeStr = pct >= 0 ? chalk.green(` (+${pctStr}%)`) : chalk.red(` (${pctStr}%)`);
      }
      const iterStr = `${s.iterations || 0} iters`;
      console.log(`  ${chalk.cyan(s.name.padEnd(30))} ${startStr} → ${endStr}${changeStr}  (${iterStr})`);
    }
  }
  console.log('');
}

export default statusCommand;
