const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AA_MODELS_URL,
  buildEvaluations,
  fetchMonitorSnapshot,
  parseIntelligenceIndexVersion,
  parseMonitorSnapshot,
  scaledPercentOrNull,
} = require('../aa-source');

function score(model, field) {
  const evals = model.evaluations || {};
  if (evals[field] !== undefined && evals[field] !== null) return evals[field];
  return null;
}

test('parseMonitorSnapshot preserves official AA index fields without local proxy fallbacks', () => {
  const snapshot = parseMonitorSnapshot({
    tier: 'free',
    intelligence_index_version: 4.1,
    data: [
      {
        id: 'model-1',
        name: 'Model 1',
        evaluations: {
          artificial_analysis_intelligence_index: 90,
          artificial_analysis_coding_index: 70,
          artificial_analysis_agentic_index: 50,
          livecodebench: 0.85,
          ifbench: 0.6,
          lcr: 0.4,
          terminalbench_hard: 0.1,
          tau2: 0.5,
        },
      },
    ],
  });

  const evals = snapshot.models[0].evaluations;
  assert.equal(snapshot.tier, 'free');
  assert.equal(snapshot.intelligence_index_version, 4.1);
  assert.equal(evals.artificial_analysis_intelligence_index, 90);
  assert.equal(evals.artificial_analysis_coding_index, 70);
  assert.equal(evals.artificial_analysis_agentic_index, 50);
  assert.equal(evals.livecodebench, 0.85);
  assert.equal(evals.ifbench, 0.6);
  assert.equal(evals.lcr, 0.4);
  assert.equal(evals.terminalbench_hard, 0.1);
  assert.equal(evals.tau2, 0.5);
});

test('parseMonitorSnapshot leaves official Agentic Index empty when only proxy fields exist', () => {
  const snapshot = parseMonitorSnapshot({
    data: [
      {
        id: 'model-1',
        name: 'Model 1',
        evaluations: {
          artificial_analysis_intelligence_index: 90,
          artificial_analysis_coding_index: 70,
          livecodebench: 0.85,
          ifbench: 0.6,
          lcr: 0.4,
          terminalbench_hard: 0.1,
          tau2: 0.5,
        },
      },
    ],
  });

  const evals = snapshot.models[0].evaluations;
  assert.equal(evals.artificial_analysis_agentic_index, undefined);
  assert.equal(score(snapshot.models[0], 'artificial_analysis_agentic_index'), null);
});

test('fetchMonitorSnapshot calls official AA language models free API with x-api-key and pagination', async () => {
  const oldKey = process.env.AA_API_KEY;
  process.env.AA_API_KEY = 'test-key';

  try {
    const calls = [];
    const snapshot = await fetchMonitorSnapshot({
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        const page = new URL(url).searchParams.get('page');
        return {
          ok: true,
          headers: { get: (name) => (name.toLowerCase() === 'x-aa-tier' ? 'free' : null) },
          json: async () => ({
            tier: 'free',
            intelligence_index_version: 4.1,
            pagination: { page: Number(page), page_size: 1, total_pages: 2, has_more: page === '1' },
            data: [
              {
                id: `m${page}`,
                name: `Model ${page}`,
                evaluations: {
                  artificial_analysis_intelligence_index: Number(page),
                  artificial_analysis_coding_index: Number(page),
                  artificial_analysis_agentic_index: Number(page),
                },
                pricing: { price_1m_input_tokens: 1, price_1m_output_tokens: 2 },
              },
            ],
          }),
        };
      },
    });

    assert.equal(new URL(calls[0].url).origin + new URL(calls[0].url).pathname, AA_MODELS_URL);
    assert.equal(new URL(calls[0].url).searchParams.get('page'), '1');
    assert.equal(calls[0].options.headers['x-api-key'], 'test-key');
    assert.match(calls[0].options.headers.accept, /application\/json/);
    assert.equal(new URL(calls[1].url).searchParams.get('page'), '2');
    assert.equal(snapshot.tier, 'free');
    assert.equal(snapshot.intelligence_index_version, 4.1);
    assert.equal(snapshot.models.length, 2);
    assert.equal(snapshot.models[1].evaluations.artificial_analysis_agentic_index, 2);
    assert.deepEqual(snapshot.models[0].pricing, { price_1m_input_tokens: 1, price_1m_output_tokens: 2 });
  } finally {
    if (oldKey === undefined) delete process.env.AA_API_KEY;
    else process.env.AA_API_KEY = oldKey;
  }
});

test('official index populations do not include local proxy-only models', () => {
  const rawModels = Array.from({ length: 540 }, (_, i) => ({
    id: `m-${i}`,
    name: `Model ${i}`,
    evaluations: {
      artificial_analysis_intelligence_index: i + 1,
      livecodebench: 0.2 + (i / 1000),
      ...(i < 81 ? { artificial_analysis_coding_index: i + 1 } : {}),
      ...(i < 47 ? { artificial_analysis_agentic_index: i + 1 } : {}),
      ifbench: 0.3,
      lcr: 0.4,
      terminalbench_hard: 0.1,
      tau2: 0.5,
    },
  }));

  const models = parseMonitorSnapshot({ data: rawModels }).models;
  const intelligence = models.filter((m) => score(m, 'artificial_analysis_intelligence_index') !== null).length;
  const coding = models.filter((m) => score(m, 'artificial_analysis_coding_index') !== null).length;
  const agentic = models.filter((m) => score(m, 'artificial_analysis_agentic_index') !== null).length;

  assert.equal(intelligence, 540);
  assert.equal(coding, 81);
  assert.equal(agentic, 47);
  assert.equal(models[100].evaluations.livecodebench > 0, true);
  assert.equal(models[100].evaluations.artificial_analysis_coding_index, undefined);
  assert.equal(models[100].evaluations.artificial_analysis_agentic_index, undefined);
});

test('buildEvaluations preserves explicit zero composite coding index', () => {
  assert.equal(buildEvaluations({ evaluations: { artificial_analysis_coding_index: 0 } }).artificial_analysis_coding_index, 0);
});

test('buildEvaluations preserves explicit zero composite agentic index', () => {
  assert.equal(buildEvaluations({ evaluations: { artificial_analysis_agentic_index: 0 } }).artificial_analysis_agentic_index, 0);
});

test('scaledPercentOrNull utility scales values without clobbering zero values', () => {
  assert.equal(scaledPercentOrNull(0), 0);
  assert.equal(scaledPercentOrNull(0.777), 77.7);
  assert.equal(scaledPercentOrNull(77.7), 77.7);
});

test('buildEvaluations leaves livecodebench-only coding index empty even for zero scores', () => {
  const evals = buildEvaluations({ evaluations: { livecodebench: 0 } });
  assert.equal(evals.livecodebench, 0);
  assert.equal(evals.artificial_analysis_coding_index, undefined);
});

test('buildEvaluations leaves proxy-only agentic index empty even for zero scores', () => {
  const evals = buildEvaluations({ evaluations: { ifbench: 0, lcr: 0, terminalbench_hard: 0, tau2: 0 } });
  assert.equal(evals.ifbench, 0);
  assert.equal(evals.artificial_analysis_agentic_index, undefined);
});

test('parseIntelligenceIndexVersion reads current models page label', () => {
  assert.equal(
    parseIntelligenceIndexVersion('Artificial Analysis Intelligence Index v4.1'),
    '4.1',
  );
});
