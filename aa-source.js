const AA_MODELS_URL = "https://artificialanalysis.ai/api/v2/data/llms/models";
const AA_MODELS_PAGE_URL = "https://artificialanalysis.ai/models";

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
  return { ...evals };
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

function parseMonitorSnapshot(json, { intelligenceIndexVersion = null } = {}) {
  const rawModels = json.data || json;
  if (!Array.isArray(rawModels)) {
    throw new Error("API response data is not an array");
  }

  return {
    tier: "free",
    intelligence_index_version: intelligenceIndexVersion,
    models: rawModels.map(normalizeModel),
  };
}

function parseIntelligenceIndexVersion(html) {
  if (typeof html !== "string") return null;

  const match = html.match(/Artificial Analysis Intelligence Index v([0-9]+(?:\.[0-9]+)?)/i)
    || html.match(/Intelligence Index v([0-9]+(?:\.[0-9]+)?)/i);
  return match ? match[1] : null;
}

async function fetchIntelligenceIndexVersion({
  url = AA_MODELS_PAGE_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is not available in this runtime");
  }

  const res = await fetchImpl(url, {
    headers: {
      "accept": "text/html,application/xhtml+xml",
    },
  });

  if (!res.ok) {
    throw new Error(`AA models page error: ${res.status}`);
  }

  return parseIntelligenceIndexVersion(await res.text());
}

async function fetchMonitorSnapshot({
  url = AA_MODELS_URL,
  versionUrl = AA_MODELS_PAGE_URL,
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
  let intelligenceIndexVersion = null;
  try {
    intelligenceIndexVersion = await fetchIntelligenceIndexVersion({ url: versionUrl, fetchImpl });
  } catch (err) {
    // The v2 API does not expose the index version. Keep model data from the API
    // even if the page-only metadata request fails, but do not hardcode a false version.
  }

  return {
    ...parseMonitorSnapshot(json, { intelligenceIndexVersion }),
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  AA_MODELS_URL,
  AA_MODELS_PAGE_URL,
  buildCreator,
  buildEvaluations,
  buildPricing,
  fetchIntelligenceIndexVersion,
  scaledPercentOrNull,
  fetchMonitorSnapshot,
  normalizeModel,
  parseIntelligenceIndexVersion,
  parseMonitorSnapshot,
};
