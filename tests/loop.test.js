import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { runLoop } from '../src/core/loop.js';

let tmpDir;

function setup() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoresearch-loop-test-'));
  execSync('git init', { cwd: tmpDir });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir });
  execSync('git config user.name "Test"', { cwd: tmpDir });

  // Create a simple test file
  fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'Hello world, this is a test file with some words in it.');

  // Create a metric script that rewards shorter files
  fs.writeFileSync(path.join(tmpDir, 'metric.sh'), `#!/bin/bash
WORDS=$(wc -w < test.txt | tr -d ' ')
echo "scale=4; 1 - ($WORDS / 100)" | bc
`);
  fs.chmodSync(path.join(tmpDir, 'metric.sh'), '755');

  execSync('git add . && git commit -m "initial"', { cwd: tmpDir });
}

function cleanup() {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe('runLoop', () => {
  before(setup);
  after(cleanup);

  it('runs a full optimization loop with mock agent', async () => {
    let callCount = 0;
    const mockAgent = (content, history, iteration) => {
      callCount++;
      if (iteration === 1) {
        return {
          content: 'Shorter test file.',
          hypothesis: 'Made the file shorter'
        };
      }
      if (iteration === 2) {
        // This change makes it longer (worse for our metric)
        return {
          content: 'This is a much longer test file with many more words added to it for testing purposes.',
          hypothesis: 'Made the file longer'
        };
      }
      return null; // No more proposals
    };

    const result = await runLoop({
      file: path.join(tmpDir, 'test.txt'),
      metricCmd: 'bash metric.sh',
      budget: 3,
      goal: 'maximize',
      session: `loop-test-${Date.now()}`,
      mockAgent
    });

    // Should have called mock agent at least for iterations 1 and 2
    assert.ok(callCount >= 2);

    // Baseline was based on initial word count
    assert.ok(typeof result.baseline === 'number');

    // At least iteration 1 should have been kept (shorter = higher metric)
    const keptCount = result.iterations.filter(i => i.kept).length;
    assert.ok(keptCount >= 1, 'At least one iteration should be kept');

    // Iteration 2 should have been reverted (longer = lower metric)
    if (result.iterations.length >= 2) {
      assert.equal(result.iterations[1].kept, false, 'Longer file should be reverted');
    }

    // Best metric should be better than baseline
    assert.ok(result.bestMetric >= result.baseline, 'Best metric should be >= baseline');

    // Session directory should exist with results
    assert.ok(fs.existsSync(result.sessionDir));
    assert.ok(fs.existsSync(path.join(result.sessionDir, 'results.tsv')));
    assert.ok(fs.existsSync(path.join(result.sessionDir, 'report.md')));
    assert.ok(fs.existsSync(path.join(result.sessionDir, 'best.md')));
    assert.ok(fs.existsSync(path.join(result.sessionDir, 'hypothesis_log.jsonl')));
  });

  it('rejects when file does not exist', async () => {
    await assert.rejects(
      () => runLoop({
        file: path.join(tmpDir, 'nonexistent.txt'),
        metricCmd: 'echo 0.5',
        budget: 1,
        session: 'test',
        mockAgent: () => null
      }),
      { message: /File not found/ }
    );
  });

  it('rejects when not a git repo', async () => {
    const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoresearch-nogit-'));
    fs.writeFileSync(path.join(nonGitDir, 'test.txt'), 'content');
    try {
      await assert.rejects(
        () => runLoop({
          file: path.join(nonGitDir, 'test.txt'),
          metricCmd: 'echo 0.5',
          budget: 1,
          session: 'test',
          mockAgent: () => null
        }),
        { message: /Not a git repository/ }
      );
    } finally {
      fs.rmSync(nonGitDir, { recursive: true, force: true });
    }
  });

  it('handles mock agent returning null (skip iteration)', async () => {
    // Reset file for clean test
    fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'Shorter test file.');
    execSync('git add test.txt && git commit -m "reset" --allow-empty', { cwd: tmpDir });

    const result = await runLoop({
      file: path.join(tmpDir, 'test.txt'),
      metricCmd: 'bash metric.sh',
      budget: 2,
      goal: 'maximize',
      session: `skip-test-${Date.now()}`,
      mockAgent: () => null
    });

    // No iterations should have been recorded (all skipped)
    assert.equal(result.iterations.length, 0);
  });
});
