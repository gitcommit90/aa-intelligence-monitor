const test = require('node:test');
const assert = require('node:assert/strict');

const {
  decodeEscapedJson,
  extractEscapedDefaultDataArray,
  extractIndexVersion,
  fetchMonitorSnapshot,
  parseMonitorSnapshot,
} = require('../aa-source');

function buildFixture() {
  const rawModels = [
    {
      id: 'm1',
      name: 'Claude Fable 5 (Adaptive Reasoning, Max Effort, Opus 4.8 Fallback)',
      slug: 'claude-fable-5',
      release_date: '2026-05-10',
      model_creators: {
        id: 'anthropic',
        name: 'Anthropic',
        slug: 'anthropic',
        color: '#ff7a00',
        logo: 'anthropic.svg',
        logo_small: 'anthropic-small.svg',
      },
      intelligence_index: 59.861,
      coding_index: 61.981,
      agentic_index: 80.595,
      price_1m_input_tokens: 0.15,
      price_1m_output_tokens: 0.6,
      cache_hit_price: 0.015,
    },
    {
      id: 'm2',
      name: 'GPT-5.5 (xhigh)',
      slug: 'gpt-5-5',
      release_date: '2026-05-20',
      model_creators: {
        id: 'openai',
        name: 'OpenAI',
        slug: 'openai',
        color: '#1f1f1f',
        logo: 'openai.svg',
        logo_small: 'openai-small.svg',
      },
      intelligence_index: 54.838,
      coding_index: 59.115,
      agentic_index: null,
    },
  ];

  const escapedModels = JSON.stringify(rawModels).replace(/"/g, '\\"');
  return String.raw`<!doctype html><html><body>
    Artificial Analysis Intelligence Index v4.1
    self.__next_f.push([1,"{\"selectModelsByDefault\":\"$undefined\",\"addToSelectedModels\":\"$undefined\",\"defaultData\":[${escapedModels.slice(1, -1)}],\"tail\":true}"])
  </body></html>`;
}

test('extractEscapedDefaultDataArray finds embedded AA array', () => {
  const html = buildFixture();
  const rawArray = extractEscapedDefaultDataArray(html);
  assert.ok(rawArray.startsWith('['));
  assert.ok(rawArray.endsWith(']'));

  const data = decodeEscapedJson(rawArray);
  assert.equal(data.length, 2);
  assert.equal(data[0].name, 'Claude Fable 5 (Adaptive Reasoning, Max Effort, Opus 4.8 Fallback)');
});

test('decodeEscapedJson handles AA double-escaped payloads', () => {
  const raw = String.raw`[{\\"a\\":1,\\"b\\":\\"x\\"}]`;
  assert.deepEqual(decodeEscapedJson(raw), [{ a: 1, b: 'x' }]);
});

test('parseMonitorSnapshot normalizes score + pricing fields', () => {
  const snapshot = parseMonitorSnapshot(buildFixture());
  assert.equal(snapshot.tier, 'free');
  assert.equal(snapshot.intelligence_index_version, '4.1');
  assert.equal(snapshot.models.length, 2);

  const first = snapshot.models[0];
  assert.equal(first.creator, 'Anthropic');
  assert.equal(first.model_creator.slug, 'anthropic');
  assert.equal(first.evaluations.artificial_analysis_intelligence_index, 59.861);
  assert.equal(first.evaluations.artificial_analysis_coding_index, 61.981);
  assert.equal(first.evaluations.artificial_analysis_agentic_index, 80.595);
  assert.equal(first.pricing.price_1m_input_tokens, 0.15);
  assert.equal(first.pricing.price_1m_output_tokens, 0.6);
  assert.equal(first.pricing.price_1m_cache_hit_tokens, 0.015);

  const second = snapshot.models[1];
  assert.equal(second.creator, 'OpenAI');
  assert.equal(second.evaluations.artificial_analysis_agentic_index, null);
  assert.equal(second.pricing, undefined);
});

test('fetchMonitorSnapshot uses page source and fetches HTML', async () => {
  let called = 0;
  const fakeFetch = async (url, opts) => {
    called += 1;
    assert.equal(url, 'https://artificialanalysis.ai/models');
    assert.equal(opts.headers['user-agent'], 'Mozilla/5.0');
    return {
      ok: true,
      status: 200,
      text: async () => buildFixture(),
    };
  };

  const snapshot = await fetchMonitorSnapshot({ fetchImpl: fakeFetch });
  assert.equal(called, 1);
  assert.equal(snapshot.models.length, 2);
  assert.equal(snapshot.models[0].name, 'Claude Fable 5 (Adaptive Reasoning, Max Effort, Opus 4.8 Fallback)');
  assert.equal(snapshot.models[0].evaluations.artificial_analysis_agentic_index, 80.595);
});
