#!/usr/bin/env node
/**
 * AutoResearch CLI
 * 
 * Turn your AI agent into an autonomous optimizer.
 * Inspired by Karpathy's autoresearch loop.
 * 
 * Usage: npx autoresearch-openclaw <command> [options]
 */

import { Command } from 'commander';
import chalk from 'chalk';
import initCommand from './commands/init.js';
import runCommand from './commands/run.js';
import statusCommand from './commands/status.js';
import demoCommand from './commands/demo.js';
import skillsCommand from './commands/skills.js';
import sessionsCommand from './commands/sessions.js';

export async function run() {
  const program = new Command();

  program
    .name('autoresearch')
    .description('Autonomous optimization loop for any text asset with a scalar metric')
    .version('1.0.0');

  // Init command
  program
    .command('init')
    .description('Initialize autoresearch workspace (~/.autoresearch/)')
    .action(initCommand);

  // Run command
  program
    .command('run')
    .description('Run an optimization loop on a file')
    .requiredOption('--file <path>', 'Path to the mutable file to optimize')
    .requiredOption('--metric <cmd>', 'Shell command that outputs a single float')
    .option('--budget <n>', 'Max iterations', '20')
    .option('--session <name>', 'Session name for logs')
    .option('--goal <goal>', 'Optimization goal (maximize or minimize)', (value) => {
      if (!['maximize', 'minimize'].includes(value)) {
        console.error(`Error: --goal must be "maximize" or "minimize", got "${value}"`);
        process.exit(1);
      }
      return value;
    }, 'maximize')
    .option('--program <path>', 'Custom program.md for agent instructions')
    .option('--skill <name>', 'Use a bundled skill preset')
    .action(runCommand);

  // Status command
  program
    .command('status')
    .description('Show dashboard: active runs, session history, best results')
    .action(statusCommand);

  // Sessions command
  program
    .command('sessions')
    .description('Manage optimization sessions')
    .argument('[action]', 'list or show', 'list')
    .argument('[id]', 'session id for show')
    .action(sessionsCommand);

  // Demo command
  program
    .command('demo')
    .description('Run a one-command demo with a mock metric (no setup required)')
    .option('--budget <n>', 'Demo iterations', '5')
    .action(demoCommand);

  // Skills command
  program
    .command('skills')
    .description('List available skill presets')
    .action(skillsCommand);

  // Parse and run
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    console.error(chalk.red('Error:'), err.message);
    process.exit(1);
  }
}
