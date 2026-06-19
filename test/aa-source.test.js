const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AA_MODELS_URL,
  AA_MODELS_PAGE_URL,
  buildEvaluations,
  fetchMonitorSnapshot,
  parseIntelligenceIndexVersion,
  parseMonitorSnapshot,
  scaledPercentOrNull,
} = require('../aa-source');

function score(model, field) {
  const evals = model.evaluations || {};
  if (evals[field] !== undefined && evals[field] !== null) return evals[field];
  if (field === 'artificial_analysis_agentic_index') {
    const subs = ['ifbench', 'lcr', 'terminalbench_hard', 'tau2'];
    const values = subs.map((k) => evals[k]).filter((v) => typeof v === 'number' && Number.isFinite(v));
    if (values.length) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      return avg <= 1 ? avg * 100 : avg;
    }
  }
  return null;
}

test('parseMonitorSnapshot preserves raw AA v2 fields without livecodebench coding fallback', () => {
  const snapshot = parseMonitorSnapshot({
    data: [
      {
        id: 'model-1',
        name: 'Model 1',
        evaluations: {
          artificial_analysis_intelligence_index: 90,
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
  assert.equal(evals.artificial_analysis_intelligence_index, 90);
  assert.equal(evals.livecodebench, 0.85);
  assert.equal(evals.ifbench, 0.6);
  assert.equal(evals.lcr, 0.4);
  assert.equal(evals.terminalbench_hard, 0.1);
  assert.equal(evals.tau2, 0.5);
  assert.equal(evals.artificial_analysis_coding_index, undefined);
});

test('fetchMonitorSnapshot calls official AA v2 JSON API with x-api-key and page version metadata', async () => {
  const oldKey = process.env.AA_API_KEY;
  process.env.AA_API_KEY = 'test-key';

  try {
    const calls = [];
    const snapshot = await fetchMonitorSnapshot({
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        if (url === AA_MODELS_PAGE_URL) {
          return {
            ok: true,
            text: async () => '<html>Artificial Analysis Intelligence Index v4.1</html>',
          };
        }
        return {
          ok: true,
          json: async () => ({ data: [{ id: 'm1', name: 'Model 1', evaluations: {} }] }),
        };
      },
    });

    assert.equal(calls[0].url, AA_MODELS_URL);
    assert.equal(calls[0].options.headers['x-api-key'], 'test-key');
    assert.match(calls[0].options.headers.accept, /application\/json/);
    assert.equal(calls[1].url, AA_MODELS_PAGE_URL);
    assert.match(calls[1].options.headers.accept, /text\/html/);
    assert.equal(snapshot.intelligence_index_version, '4.1');
    assert.equal(snapshot.models.length, 1);
  } finally {
    if (oldKey === undefined) delete process.env.AA_API_KEY;
    else process.env.AA_API_KEY = oldKey;
  }
});

test('official coding population does not include livecodebench-only models', () => {
  const rawModels = Array.from({ length: 540 }, (_, i) => ({
    id: `m-${i}`,
    name: `Model ${i}`,
    evaluations: {
      artificial_analysis_intelligence_index: i + 1,
      livecodebench: 0.2 + (i / 1000),
      ...(i < 81 ? { artificial_analysis_coding_index: i + 1 } : {}),
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
  assert.equal(agentic, 540);
  assert.equal(models[100].evaluations.livecodebench > 0, true);
  assert.equal(models[100].evaluations.artificial_analysis_coding_index, undefined);
});

test('buildEvaluations preserves explicit zero composite coding index', () => {
  assert.equal(buildEvaluations({ evaluations: { artificial_analysis_coding_index: 0 } }).artificial_analysis_coding_index, 0);
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

test('parseIntelligenceIndexVersion reads current models page label', () => {
  assert.equal(
    parseIntelligenceIndexVersion('Artificial Analysis Intelligence Index v4.1'),
    '4.1',
  );
});
