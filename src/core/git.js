import { execFile } from 'child_process';

function run(args, cwd) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`git: ${stderr.trim() || error.message}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

export async function isGitRepo(cwd) {
  try {
    await run(['rev-parse', '--is-inside-work-tree'], cwd);
    return true;
  } catch {
    return false;
  }
}

export async function isDirty(file, cwd) {
  try {
    const output = await run(['status', '--porcelain', '--', file], cwd);
    return output.length > 0;
  } catch {
    return false;
  }
}

export async function commitChange(file, message, cwd) {
  await run(['add', '--', file], cwd);
  await run(['commit', '-m', message], cwd);
}

export async function revertChange(file, cwd) {
  await run(['checkout', '--', file], cwd);
}
