const SYSTEM_PROMPT = `You are an optimization agent. Your job is to improve a text file to maximize (or minimize) a scalar metric.

Rules:
1. Propose exactly ONE targeted change per iteration.
2. Each change should have a clear hypothesis for why it will improve the metric.
3. Return the COMPLETE updated file content between <updated_file> and </updated_file> tags.
4. State your hypothesis between <hypothesis> and </hypothesis> tags.
5. Do NOT make multiple changes at once — one focused change per iteration.
6. Learn from previous iteration results to avoid repeating failed approaches.`;

export function buildUserMessage(fileContent, history, options) {
  const { goal = 'maximize', skill = '' } = options;

  let message = `## Current File\n\`\`\`\n${fileContent}\n\`\`\`\n\n`;
  message += `## Goal\n${goal === 'maximize' ? 'MAXIMIZE' : 'MINIMIZE'} the metric score.\n\n`;

  if (skill) {
    message += `## Optimization Instructions\n${skill}\n\n`;
  }

  if (history.length > 0) {
    message += `## Previous Iterations\n`;
    for (const h of history) {
      const arrow = h.kept ? '✓ kept' : '✗ reverted';
      message += `- Iter ${h.iteration}: ${h.metricBefore.toFixed(4)} → ${h.metricAfter.toFixed(4)} (${arrow}) — ${h.hypothesis}\n`;
    }
    message += '\n';
  }

  message += `Propose ONE change. Return the complete updated file between <updated_file> tags and your hypothesis between <hypothesis> tags.`;

  return message;
}

export function parseResponse(text) {
  const fileMatch = text.match(/<updated_file>([\s\S]*?)<\/updated_file>/);
  if (!fileMatch) return null;

  const content = fileMatch[1].trim();
  if (!content) return null;

  const hypMatch = text.match(/<hypothesis>([\s\S]*?)<\/hypothesis>/);
  const hypothesis = hypMatch ? hypMatch[1].trim() : 'No hypothesis provided';

  return { content, hypothesis };
}

async function fetchWithRetry(url, options, retries = 2, delay = 2000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 401 || response.status === 403) {
        throw new Error(`API key invalid or unauthorized (HTTP ${response.status}). Check AUTORESEARCH_API_KEY.`);
      }

      if (response.status === 429) {
        if (attempt < retries) {
          const wait = delay * 2.5;
          console.log(`  Rate limited. Waiting ${wait / 1000}s...`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        throw new Error('Rate limited by API. Try again later.');
      }

      if (response.status >= 500) {
        if (attempt < retries) {
          console.log(`  API error (${response.status}). Retrying in ${delay / 1000}s...`);
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
          continue;
        }
        throw new Error(`API server error (HTTP ${response.status})`);
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`API error (HTTP ${response.status}): ${body.substring(0, 200)}`);
      }

      return await response.json();
    } catch (error) {
      if (error.message.includes('API key invalid') || error.message.includes('Rate limited')) {
        throw error;
      }
      if (attempt < retries && (error.name === 'TypeError' || error.code === 'ECONNREFUSED')) {
        console.log(`  Network error. Retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      if (attempt === retries) throw error;
    }
  }
}

export async function proposeChange(fileContent, history, options) {
  const { apiBase, apiKey, model } = options;

  const url = `${apiBase.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserMessage(fileContent, history, options) }
    ],
    max_tokens: 4096,
    temperature: 0.7
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  const data = await fetchWithRetry(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  const text = data.choices?.[0]?.message?.content;
  if (!text) return null;

  return parseResponse(text);
}

export { SYSTEM_PROMPT, fetchWithRetry };
