import os from 'os';
import path from 'path';
import fs from 'fs-extra';

export const CONFIG_DIR = path.join(os.homedir(), '.autoresearch');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
export const SESSIONS_DIR = path.join(CONFIG_DIR, 'sessions');

export const DEFAULTS = {
  version: '1.0.0',
  model: 'gpt-4o',
  apiBase: 'https://api.openai.com/v1',
  defaultBudget: 20,
  defaultGoal: 'maximize',
  metricTimeout: 60000,
  outputDir: SESSIONS_DIR,
};

export async function loadConfig() {
  if (!fs.pathExistsSync(CONFIG_FILE)) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...await fs.readJson(CONFIG_FILE) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function getConfig() {
  try {
    if (fs.pathExistsSync(CONFIG_FILE)) {
      return { ...DEFAULTS, ...fs.readJsonSync(CONFIG_FILE) };
    }
  } catch {}
  return { ...DEFAULTS };
}

export async function saveConfig(config) {
  await fs.ensureDir(CONFIG_DIR);
  await fs.ensureDir(SESSIONS_DIR);
  await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });
}

export function isInitialized() {
  return fs.pathExistsSync(CONFIG_FILE);
}

export async function ensureConfig() {
  if (!isInitialized()) {
    const chalk = (await import('chalk')).default;
    console.log(chalk.yellow('\n⚠️  AutoResearch not initialized.'));
    console.log(chalk.gray('   Run ') + chalk.cyan('npx autoresearch init') + chalk.gray(' first.\n'));
    process.exit(1);
  }
}

export function getSessionsDir() {
  return SESSIONS_DIR;
}

export function formatDate(date) {
  return date.toISOString().split('T')[0];
}

export function formatNumber(num) {
  return Number.isInteger(num) ? num.toString() : num.toFixed(4);
}

export function improvementPct(baseline, best, goal = 'maximize') {
  if (baseline === 0) return Infinity;
  const delta = goal === 'maximize' ? best - baseline : baseline - best;
  return parseFloat((delta / Math.abs(baseline) * 100).toFixed(1));
}
