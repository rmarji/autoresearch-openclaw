import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runMetric } from '../src/core/metric.js';
import os from 'os';
import path from 'path';
import fs from 'fs';

const tmpDir = os.tmpdir();

describe('runMetric', () => {
  it('parses a valid float from command output', async () => {
    const result = await runMetric('echo "0.1234"', tmpDir);
    assert.equal(result, 0.1234);
  });

  it('parses an integer as float', async () => {
    const result = await runMetric('echo "42"', tmpDir);
    assert.equal(result, 42);
  });

  it('parses negative float', async () => {
    const result = await runMetric('echo "-0.5"', tmpDir);
    assert.equal(result, -0.5);
  });

  it('parses last line when multi-line output', async () => {
    const result = await runMetric('echo "debug info\nmore debug\n0.7890"', tmpDir);
    assert.equal(result, 0.789);
  });

  it('rejects empty output', async () => {
    await assert.rejects(
      () => runMetric('echo ""', tmpDir),
      { message: /empty output/ }
    );
  });

  it('rejects non-numeric output', async () => {
    await assert.rejects(
      () => runMetric('echo "not a number"', tmpDir),
      { message: /Metric must return a single float/ }
    );
  });

  it('rejects NaN', async () => {
    await assert.rejects(
      () => runMetric('echo "NaN"', tmpDir),
      { message: /Metric must return a single float/ }
    );
  });

  it('rejects Infinity', async () => {
    await assert.rejects(
      () => runMetric('echo "Infinity"', tmpDir),
      { message: /Metric must return a single float/ }
    );
  });

  it('handles non-zero exit code', async () => {
    await assert.rejects(
      () => runMetric('exit 1', tmpDir),
      { message: /Metric command failed/ }
    );
  });

  it('handles command not found', async () => {
    await assert.rejects(
      () => runMetric('nonexistent_command_xyz_12345', tmpDir),
      (err) => err.message.includes('not found') || err.message.includes('Metric command failed')
    );
  });

  it('handles timeout', async () => {
    await assert.rejects(
      () => runMetric('sleep 10', tmpDir, 500),
      { message: /timed out/ }
    );
  });
});
