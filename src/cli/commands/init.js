import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import { CONFIG_DIR, CONFIG_FILE } from '../../utils/config.js';

async function initCommand() {
  console.log('');
  console.log(chalk.cyan('╔══════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.white.bold('        AutoResearch — Autonomous Optimization Loop') + '        ' + chalk.cyan('║'));
  console.log(chalk.cyan('╚══════════════════════════════════════════════════════════════╝'));
  console.log('');

  // Check if already initialized
  if (await fs.pathExists(CONFIG_FILE)) {
    const config = await fs.readJson(CONFIG_FILE);
    console.log(chalk.yellow('  Already initialized. Current config:'));
    console.log('');
    console.log(chalk.gray('  Config:    ') + chalk.white(CONFIG_FILE));
    console.log(chalk.gray('  API Base:  ') + chalk.white(config.apiBase || 'https://api.openai.com/v1'));
    console.log(chalk.gray('  Model:     ') + chalk.white(config.model || 'gpt-4o'));
    console.log(chalk.gray('  Budget:    ') + chalk.white((config.defaultBudget || 20) + ' iterations'));
    console.log('');
    console.log(chalk.gray('API key: set via ') + chalk.cyan('AUTORESEARCH_API_KEY') + chalk.gray(' env var'));
    console.log(chalk.gray('Run ') + chalk.cyan('autoresearch status') + chalk.gray(' to see session history.'));
    return;
  }

  // Prompt for config using inquirer
  const inquirer = (await import('inquirer')).default;
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'apiBase',
      message: 'API base URL (OpenAI-compatible):',
      default: 'https://api.openai.com/v1'
    },
    {
      type: 'input',
      name: 'model',
      message: 'Default model:',
      default: 'gpt-4o'
    },
    {
      type: 'number',
      name: 'defaultBudget',
      message: 'Default iteration budget:',
      default: 20
    }
  ]);

  // Create config directory
  await fs.ensureDir(CONFIG_DIR);
  await fs.ensureDir(path.join(CONFIG_DIR, 'results'));

  // Create config
  const config = {
    version: '1.0.0',
    apiBase: answers.apiBase,
    model: answers.model,
    defaultBudget: answers.defaultBudget,
    defaultGoal: 'maximize',
    metricTimeout: 60000,
    resultsDir: path.join(CONFIG_DIR, 'results'),
    createdAt: new Date().toISOString()
  };

  await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });

  // Print success
  console.log('');
  console.log(chalk.green('✓') + ' Created workspace: ' + chalk.white(CONFIG_DIR));
  console.log(chalk.green('✓') + ' Config saved:       ' + chalk.white(CONFIG_FILE));
  console.log(chalk.green('✓') + ' Results directory:  ' + chalk.white(config.resultsDir));
  console.log('');
  console.log(chalk.gray('Set your API key:'));
  console.log(chalk.cyan('  export AUTORESEARCH_API_KEY=sk-...'));
  console.log('');

  // Print dashboard
  const dashboard = boxen(
    chalk.white.bold('AutoResearch Dashboard') + '\n\n' +
    chalk.gray('Sessions:    ') + chalk.white('0 total\n') +
    chalk.gray('API Base:    ') + chalk.white(config.apiBase + '\n') +
    chalk.gray('Model:       ') + chalk.white(config.model + '\n') +
    chalk.gray('Budget:      ') + chalk.white(config.defaultBudget + ' iterations') + '\n\n' +
    chalk.gray('Quick start:\n') +
    chalk.cyan('  autoresearch demo') + '\n' +
    chalk.cyan('  autoresearch run --file template.md --metric "bash measure.sh"'),
    { padding: 1, borderStyle: 'round', borderColor: 'cyan' }
  );
  console.log(dashboard);
  console.log('');
}

export default initCommand;
