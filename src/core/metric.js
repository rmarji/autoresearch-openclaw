import { exec } from 'child_process';

const DEFAULT_TIMEOUT = 60000;

export async function runMetric(command, cwd, timeout = DEFAULT_TIMEOUT) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd, timeout }, (error, stdout, stderr) => {
      if (error) {
        if (error.killed) {
          reject(new Error(`Metric command timed out after ${timeout / 1000}s`));
          return;
        }
        if (error.code === 'ENOENT' || (error.message && error.message.includes('ENOENT'))) {
          reject(new Error(`Metric command not found: ${command}`));
          return;
        }
        reject(new Error(`Metric command failed (exit ${error.code}): ${stderr.trim() || error.message}`));
        return;
      }

      const output = stdout.trim();
      if (!output) {
        reject(new Error('Metric command returned empty output'));
        return;
      }

      // Parse last line as float
      const lines = output.split('\n');
      const lastLine = lines[lines.length - 1].trim();
      const value = parseFloat(lastLine);

      if (isNaN(value) || !isFinite(value)) {
        reject(new Error(`Metric must return a single float, got: ${lastLine}`));
        return;
      }

      resolve(value);
    });
  });
}
