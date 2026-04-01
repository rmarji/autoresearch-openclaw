import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';

// We test results.js functions by calling them against a temporary directory.
// Since results.js uses CONFIG_DIR (which points to ~/.autoresearch), the
// createSession/listSessions/getSession functions will write there. For tests
// that need isolation, we test the underlying logic directly.

import {
  createSession,
  appendResult,
  appendHypothesis,
  writeReport,
  writeBest,
  listSessions,
  getSession
} from '../src/core/results.js';

// Use unique session names to avoid test interference
const TEST_PREFIX = `test-${Date.now()}`;

describe('results persistence', () => {
  let sessionDir;
  const sessionName = `${TEST_PREFIX}-session`;

  after(async () => {
    // Cleanup test sessions
    if (sessionDir && fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
  });

  describe('createSession', () => {
    it('creates session directory with TSV header', async () => {
      sessionDir = await createSession(sessionName);

      assert.ok(fs.existsSync(sessionDir), 'Session directory should exist');
      const tsvPath = path.join(sessionDir, 'results.tsv');
      assert.ok(fs.existsSync(tsvPath), 'results.tsv should exist');

      const content = fs.readFileSync(tsvPath, 'utf8');
      assert.ok(content.startsWith('iteration\t'), 'TSV should have header');
    });

    it('rejects session names with path traversal', async () => {
      await assert.rejects(
        () => createSession('../malicious'),
        { message: /Invalid session name/ }
      );
    });

    it('rejects session names with slashes', async () => {
      await assert.rejects(
        () => createSession('foo/bar'),
        { message: /Invalid session name/ }
      );
    });

    it('rejects empty session name', async () => {
      await assert.rejects(
        () => createSession(''),
        { message: /Session name is required/ }
      );
    });
  });

  describe('appendResult', () => {
    it('appends a TSV line with correct format', async () => {
      const entry = {
        iteration: 1,
        metricBefore: 0.12,
        metricAfter: 0.14,
        kept: true,
        hypothesis: 'Shortened subject line'
      };
      await appendResult(sessionDir, entry);

      const content = fs.readFileSync(path.join(sessionDir, 'results.tsv'), 'utf8');
      const lines = content.trim().split('\n');
      assert.equal(lines.length, 2); // header + 1 entry

      const fields = lines[1].split('\t');
      assert.equal(fields[0], '1');
      assert.equal(fields[1], '0.1200');
      assert.equal(fields[2], '0.1400');
      assert.equal(fields[3], 'kept');
      assert.equal(fields[4], 'Shortened subject line');
    });

    it('appends multiple entries', async () => {
      const entry2 = {
        iteration: 2,
        metricBefore: 0.14,
        metricAfter: 0.13,
        kept: false,
        hypothesis: 'Added emoji'
      };
      await appendResult(sessionDir, entry2);

      const content = fs.readFileSync(path.join(sessionDir, 'results.tsv'), 'utf8');
      const lines = content.trim().split('\n');
      assert.equal(lines.length, 3); // header + 2 entries
      assert.ok(lines[2].includes('reverted'));
    });
  });

  describe('appendHypothesis', () => {
    it('writes valid JSONL entries', async () => {
      const entry = {
        iteration: 1,
        hypothesis: 'Test hypothesis',
        metricBefore: 0.10,
        metricAfter: 0.15,
        kept: true
      };
      await appendHypothesis(sessionDir, entry);

      const content = fs.readFileSync(
        path.join(sessionDir, 'hypothesis_log.jsonl'), 'utf8'
      );
      const parsed = JSON.parse(content.trim());
      assert.equal(parsed.iteration, 1);
      assert.equal(parsed.kept, true);
      assert.ok(parsed.timestamp, 'Should have timestamp');
    });
  });

  describe('writeReport', () => {
    it('generates markdown report with correct metrics', async () => {
      const data = {
        sessionName,
        file: '/tmp/test.txt',
        metric: 'echo 0.5',
        goal: 'maximize',
        budget: 10,
        baseline: 0.12,
        bestMetric: 0.14,
        iterations: [
          { iteration: 1, metricBefore: 0.12, metricAfter: 0.14, kept: true, hypothesis: 'Shortened subject' },
          { iteration: 2, metricBefore: 0.14, metricAfter: 0.13, kept: false, hypothesis: 'Added emoji' }
        ]
      };
      await writeReport(sessionDir, data);

      const content = fs.readFileSync(path.join(sessionDir, 'report.md'), 'utf8');
      assert.ok(content.includes(sessionName));
      assert.ok(content.includes('0.1200'));
      assert.ok(content.includes('0.1400'));
      assert.ok(content.includes('16.7%'));
      assert.ok(content.includes('Shortened subject'));
      assert.ok(content.includes('✓ kept'));
      assert.ok(content.includes('✗ reverted'));
    });

    it('handles zero baseline without division error', async () => {
      const zeroSession = `${TEST_PREFIX}-zero`;
      const zeroDir = await createSession(zeroSession);
      try {
        const data = {
          sessionName: zeroSession,
          file: '/tmp/test.txt',
          metric: 'echo 0',
          goal: 'maximize',
          budget: 1,
          baseline: 0,
          bestMetric: 0.5,
          iterations: [
            { iteration: 1, metricBefore: 0, metricAfter: 0.5, kept: true, hypothesis: 'test' }
          ]
        };
        await writeReport(zeroDir, data);
        const content = fs.readFileSync(path.join(zeroDir, 'report.md'), 'utf8');
        assert.ok(content.includes('∞'));
      } finally {
        fs.rmSync(zeroDir, { recursive: true, force: true });
      }
    });
  });

  describe('writeBest', () => {
    it('writes best file content', async () => {
      const bestContent = 'This is the best version.';
      await writeBest(sessionDir, bestContent);

      const content = fs.readFileSync(path.join(sessionDir, 'best.md'), 'utf8');
      assert.equal(content, bestContent);
    });
  });

  describe('listSessions', () => {
    it('returns sessions sorted by date (newest first)', async () => {
      const sessions = await listSessions();
      assert.ok(Array.isArray(sessions));

      // Our test session should be in the list
      const found = sessions.find(s => s.name === sessionName);
      assert.ok(found, 'Test session should be listed');
      assert.equal(found.iterations, 2);
      assert.ok(found.startMetric != null);
    });
  });

  describe('getSession', () => {
    it('returns session data with TSV and report', async () => {
      const session = await getSession(sessionName);
      assert.ok(session);
      assert.equal(session.name, sessionName);
      assert.ok(session.tsv, 'Should have TSV data');
      assert.ok(session.report, 'Should have report');
      assert.ok(session.best, 'Should have best content');
    });

    it('returns null for nonexistent session', async () => {
      const session = await getSession(`${TEST_PREFIX}-nonexistent`);
      assert.equal(session, null);
    });

    it('rejects path traversal in session name', async () => {
      await assert.rejects(
        () => getSession('../../../etc'),
        { message: /Invalid session name/ }
      );
    });
  });
});
