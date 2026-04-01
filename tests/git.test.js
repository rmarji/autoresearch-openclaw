import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { isGitRepo, isDirty, commitChange, revertChange } from '../src/core/git.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

let tmpDir;

function setup() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoresearch-git-test-'));
  execSync('git init', { cwd: tmpDir });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir });
  execSync('git config user.name "Test"', { cwd: tmpDir });
  fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'initial content');
  execSync('git add test.txt && git commit -m "initial"', { cwd: tmpDir });
}

function cleanup() {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe('git operations', () => {
  before(setup);
  after(cleanup);

  describe('isGitRepo', () => {
    it('returns true for a git repo', async () => {
      assert.equal(await isGitRepo(tmpDir), true);
    });

    it('returns false for a non-git directory', async () => {
      const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoresearch-nogit-'));
      try {
        assert.equal(await isGitRepo(nonGitDir), false);
      } finally {
        fs.rmSync(nonGitDir, { recursive: true, force: true });
      }
    });
  });

  describe('isDirty', () => {
    it('returns false for a clean file', async () => {
      assert.equal(await isDirty('test.txt', tmpDir), false);
    });

    it('returns true for a modified file', async () => {
      fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'modified content');
      assert.equal(await isDirty('test.txt', tmpDir), true);
      // Reset for next tests
      execSync('git checkout -- test.txt', { cwd: tmpDir });
    });
  });

  describe('commitChange', () => {
    it('commits a file change', async () => {
      fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'committed content');
      await commitChange('test.txt', 'test commit', tmpDir);

      const log = execSync('git log --oneline -1', { cwd: tmpDir }).toString();
      assert.ok(log.includes('test commit'));

      const content = fs.readFileSync(path.join(tmpDir, 'test.txt'), 'utf8');
      assert.equal(content, 'committed content');
    });
  });

  describe('revertChange', () => {
    it('reverts a file to last committed state', async () => {
      fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'bad change');
      await revertChange('test.txt', tmpDir);

      const content = fs.readFileSync(path.join(tmpDir, 'test.txt'), 'utf8');
      assert.equal(content, 'committed content');
    });
  });
});
