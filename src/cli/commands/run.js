import chalk from 'chalk';
import boxen from 'boxen';
import path from 'path';
import fs from 'fs';
import { loadConfig } from '../../utils/config.js';
import { runLoop } from '../../core/loop.js';

const SKILL_INSTRUCTIONS = {
  'prompt-optimizer': `You are optimizing a system prompt for an AI model.
Focus on: clarity of instructions, specificity of constraints, effective examples, and tone calibration.
Changes that tend to help: removing ambiguity, adding edge case handling, tightening output format specs.
Changes that tend to hurt: making the prompt too verbose, adding contradictory instructions.`,

  'outreach-optimizer': `You are optimizing a cold outreach email/DM template for reply rates.
Focus on: subject line impact, personalization hooks, clear value proposition, concise CTA.
Changes that tend to help: shorter subject lines, specific value props, easy-to-answer CTAs, personalization tokens.
Changes that tend to hurt: generic greetings, multiple CTAs, walls of text, pushy language.`,

  'content-optimizer': `You are optimizing content (blog post, landing page copy) for engagement.
Focus on: headline impact, opening hook, readability, clear structure, compelling CTA.
Changes that tend to help: stronger headlines, shorter paragraphs, active voice, specific numbers.
Changes that tend to hurt: clickbait, keyword stuffing, removing substance for brevity.`,

  'config-tuner': `You are tuning a configuration file to optimize benchmark performance.
Focus on: parameter values that affect the target metric. Make small, targeted adjustments.
Changes that tend to help: systematic exploration of parameter ranges, one parameter at a time.
Changes that tend to hurt: changing multiple parameters at once, extreme values.`,

  'prediction-optimizer': `You are optimizing a prediction market strategy to minimize Brier score (lower is better).
Focus on: calibration accuracy, confidence levels, reasoning quality, edge case handling.
Changes that tend to help: more nuanced probability estimates, better base rate usage, explicit uncertainty.
Changes that tend to hurt: overconfident predictions, ignoring base rates.`
};

async function runCommand(options) {
  // Validate inputs
  if (!options.file) {
    console.error(chalk.red('Error: --file is required'));
    console.log('Usage: autoresearch run --file <path> --metric "command" [--budget 20]');
    process.exit(1);
  }

  if (!options.metric) {
    console.error(chalk.red('Error: --metric is required'));
    process.exit(1);
  }

  // Resolve file path
  const filePath = path.resolve(options.file);
  if (!fs.existsSync(filePath)) {
    console.error(chalk.red(`Error: File not found: ${filePath}`));
    process.exit(1);
  }

  // Load config
  const config = await loadConfig();
  const budget = parseInt(options.budget) || config.defaultBudget || 20;
  const goal = options.goal || config.defaultGoal || 'maximize';
  const session = options.session || generateSessionName();

  // Resolve API settings
  const apiBase = process.env.AUTORESEARCH_API_BASE || config.apiBase || 'https://api.openai.com/v1';
  const apiKey = process.env.AUTORESEARCH_API_KEY || config.apiKey;
  const model = process.env.AUTORESEARCH_MODEL || config.model || 'gpt-4o';

  if (!apiKey) {
    console.error(chalk.red('Error: No API key configured.'));
    console.log(chalk.gray('Set the AUTORESEARCH_API_KEY environment variable:'));
    console.log(chalk.cyan('  export AUTORESEARCH_API_KEY=sk-...'));
    process.exit(1);
  }

  // Resolve skill instructions
  let skillInstructions = '';
  if (options.program) {
    const programPath = path.resolve(options.program);
    if (!fs.existsSync(programPath)) {
      console.error(chalk.red(`Error: Program file not found: ${programPath}`));
      process.exit(1);
    }
    skillInstructions = fs.readFileSync(programPath, 'utf8');
  } else if (options.skill) {
    skillInstructions = SKILL_INSTRUCTIONS[options.skill];
    if (!skillInstructions) {
      console.error(chalk.red(`Error: Unknown skill: ${options.skill}`));
      console.log(chalk.gray('Available skills: ' + Object.keys(SKILL_INSTRUCTIONS).join(', ')));
      process.exit(1);
    }
  }

  // Print banner
  console.log(boxen(
    chalk.bold.blue('AutoResearch Loop') + '\n' +
    chalk.gray('OpenClaw Autonomous Optimization\n') +
    chalk.dim(`Session: ${session}`),
    { padding: 1, borderStyle: 'round', borderColor: 'blue' }
  ));

  console.log(chalk.gray('\nConfiguration:'));
  console.log(`  File:    ${chalk.cyan(filePath)}`);
  console.log(`  Metric:  ${chalk.cyan(options.metric.substring(0, 60))}${options.metric.length > 60 ? '...' : ''}`);
  console.log(`  Budget:  ${chalk.cyan(budget)} iterations`);
  console.log(`  Goal:    ${chalk.cyan(goal)}`);
  console.log(`  Model:   ${chalk.cyan(model)}`);
  if (options.skill) console.log(`  Skill:   ${chalk.cyan(options.skill)}`);
  if (options.program) console.log(`  Program: ${chalk.cyan(options.program)}`);

  try {
    await runLoop({
      file: filePath,
      metricCmd: options.metric,
      budget,
      goal,
      session,
      skill: skillInstructions,
      apiBase,
      apiKey,
      model
    });
  } catch (error) {
    console.error(chalk.red(`\nError: ${error.message}`));
    process.exit(1);
  }
}

function generateSessionName() {
  const now = new Date();
  const date = now.toISOString().split('T')[0].replace(/-/g, '');
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '').substring(0, 6);
  return `autoresearch-${date}-${time}`;
}

export default runCommand;
