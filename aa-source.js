const AA_MODELS_URL = "https://artificialanalysis.ai/api/v2/data/llms/models";

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildCreator(raw) {
  const creator = raw.model_creator || raw.model_creators;
  if (!creator || typeof creator !== "object") {
    return undefined;
  }

  return {
    id: creator.id ?? null,
    name: creator.name ?? null,
    slug: creator.slug ?? null,
    color: creator.color ?? null,
    logo: creator.logo ?? null,
    logo_small: creator.logo_small ?? null,
  };
}

function buildPricing(raw) {
  const pricing = {};
  const set = (key, value) => {
    if (value !== undefined && value !== null) {
      pricing[key] = value;
    }
  };

  set("price_1m_input_tokens", raw.price_1m_input_tokens ?? null);
  set("price_1m_output_tokens", raw.price_1m_output_tokens ?? null);
  set("price_1m_cache_hit_tokens", raw.cache_hit_price ?? raw.price_1m_cache_hit_tokens ?? null);
  set("price_1m_cache_write_tokens", raw.cacheWritePrice ?? raw.price_1m_cache_write_tokens ?? null);

  return Object.keys(pricing).length ? pricing : undefined;
}

function scaledPercentOrNull(value) {
  const numeric = numberOrNull(value);
  if (numeric === null) return null;
  return numeric <= 1 ? numeric * 100 : numeric;
}

function buildEvaluations(raw) {
  const evals = raw.evaluations || raw;
  const ret = { ...evals };

  if (ret.artificial_analysis_coding_index === undefined || ret.artificial_analysis_coding_index === null) {
    ret.artificial_analysis_coding_index = scaledPercentOrNull(evals.coding_index ?? evals.livecodebench);
  }

  return ret;
}

function normalizeModel(raw) {
  const model_creator = buildCreator(raw);
  return {
    id: raw.id ?? null,
    name: raw.name ?? null,
    slug: raw.slug ?? null,
    release_date: raw.release_date ?? null,
    creator: model_creator?.name ?? null,
    model_creator,
    pricing: buildPricing(raw),
    evaluations: buildEvaluations(raw),
  };
}

function parseMonitorSnapshot(json) {
  const rawModels = json.data || json;
  if (!Array.isArray(rawModels)) {
    throw new Error("API response data is not an array");
  }

  return {
    tier: "free",
    intelligence_index_version: "2.0", // Fallback version as API v2 doesn't expose it directly
    models: rawModels.map(normalizeModel),
  };
}

async function fetchMonitorSnapshot({
  url = AA_MODELS_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is not available in this runtime");
  }

  const apiKey = process.env.AA_API_KEY;
  if (!apiKey) {
    throw new Error("AA_API_KEY environment variable is missing");
  }

  const res = await fetchImpl(url, {
    headers: {
      "x-api-key": apiKey,
      "accept": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`AA API error: ${res.status}`);
  }

  const json = await res.json();
  return {
    ...parseMonitorSnapshot(json),
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  AA_MODELS_URL,
  buildCreator,
  buildEvaluations,
  buildPricing,
  scaledPercentOrNull,
  fetchMonitorSnapshot,
  normalizeModel,
  parseMonitorSnapshot,
};
