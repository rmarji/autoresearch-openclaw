import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseResponse, buildUserMessage } from '../src/core/agent.js';

describe('parseResponse', () => {
  it('extracts content and hypothesis from valid response', () => {
    const text = `Here's my proposal:

<updated_file>
Hello world, this is the updated content.
Line two of the file.
</updated_file>

<hypothesis>Shortened the greeting for conciseness</hypothesis>`;

    const result = parseResponse(text);
    assert.equal(result.content, 'Hello world, this is the updated content.\nLine two of the file.');
    assert.equal(result.hypothesis, 'Shortened the greeting for conciseness');
  });

  it('returns null when no updated_file tags found', () => {
    const text = 'Here is my suggestion: just change the title.';
    assert.equal(parseResponse(text), null);
  });

  it('returns null when updated_file is empty', () => {
    const text = '<updated_file></updated_file>\n<hypothesis>test</hypothesis>';
    assert.equal(parseResponse(text), null);
  });

  it('returns null when updated_file has only whitespace', () => {
    const text = '<updated_file>   \n  \n  </updated_file>\n<hypothesis>test</hypothesis>';
    assert.equal(parseResponse(text), null);
  });

  it('provides default hypothesis when tags missing', () => {
    const text = '<updated_file>some content</updated_file>';
    const result = parseResponse(text);
    assert.equal(result.content, 'some content');
    assert.equal(result.hypothesis, 'No hypothesis provided');
  });

  it('handles multiline file content correctly', () => {
    const content = 'Line 1\nLine 2\nLine 3\n\nLine 5 after blank';
    const text = `<updated_file>\n${content}\n</updated_file>\n<hypothesis>multi-line change</hypothesis>`;
    const result = parseResponse(text);
    assert.equal(result.content, content);
  });

  it('handles content with special characters', () => {
    const content = 'Price: $100 & <bold>important</bold>';
    const text = `<updated_file>${content}</updated_file><hypothesis>added price</hypothesis>`;
    const result = parseResponse(text);
    assert.equal(result.content, content);
  });
});

describe('buildUserMessage', () => {
  it('includes file content and goal', () => {
    const msg = buildUserMessage('hello world', [], { goal: 'maximize' });
    assert.ok(msg.includes('hello world'));
    assert.ok(msg.includes('MAXIMIZE'));
  });

  it('includes minimize goal', () => {
    const msg = buildUserMessage('test', [], { goal: 'minimize' });
    assert.ok(msg.includes('MINIMIZE'));
  });

  it('includes skill instructions when provided', () => {
    const msg = buildUserMessage('test', [], { goal: 'maximize', skill: 'Focus on brevity' });
    assert.ok(msg.includes('Focus on brevity'));
    assert.ok(msg.includes('Optimization Instructions'));
  });

  it('includes iteration history', () => {
    const history = [
      { iteration: 1, metricBefore: 0.1, metricAfter: 0.15, kept: true, hypothesis: 'shortened title' },
      { iteration: 2, metricBefore: 0.15, metricAfter: 0.12, kept: false, hypothesis: 'added emoji' }
    ];
    const msg = buildUserMessage('test', history, { goal: 'maximize' });
    assert.ok(msg.includes('shortened title'));
    assert.ok(msg.includes('✓ kept'));
    assert.ok(msg.includes('✗ reverted'));
    assert.ok(msg.includes('Previous Iterations'));
  });

  it('omits history section when empty', () => {
    const msg = buildUserMessage('test', [], { goal: 'maximize' });
    assert.ok(!msg.includes('Previous Iterations'));
  });
});
