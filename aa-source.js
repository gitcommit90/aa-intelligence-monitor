const AA_MODELS_URL = "https://artificialanalysis.ai/api/v2/language/models/free";
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
  if (raw.pricing && typeof raw.pricing === "object") {
    return { ...raw.pricing };
  }

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
    performance: raw.performance ? { ...raw.performance } : undefined,
    evaluations: buildEvaluations(raw),
  };
}

function parseMonitorSnapshot(json, { intelligenceIndexVersion = null } = {}) {
  const rawModels = json.data || json;
  if (!Array.isArray(rawModels)) {
    throw new Error("API response data is not an array");
  }

  return {
    tier: json.tier || "free",
    intelligence_index_version: json.intelligence_index_version ?? intelligenceIndexVersion,
    models: rawModels.map(normalizeModel),
  };
}

function withPage(url, page) {
  const next = new URL(url);
  next.searchParams.set("page", String(page));
  return next.toString();
}

/** @returns {{ label: string, key: string }[]} */
function getAaApiKeyCandidates() {
  const entries = [
    ["AA_API_KEY", process.env.AA_API_KEY],
    ["AA_FALLBACK_API_KEY", process.env.AA_FALLBACK_API_KEY],
    ["AA_FINAL_FALLBACK_API_KEY", process.env.AA_FINAL_FALLBACK_API_KEY],
  ];
  const seen = new Set();
  const out = [];
  for (const [label, value] of entries) {
    const key = typeof value === "string" ? value.trim() : "";
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ label, key });
  }
  return out;
}

async function fetchWithAaApiKeys(url, { fetchImpl, extraHeaders = {} } = {}) {
  const candidates = getAaApiKeyCandidates();
  if (!candidates.length) {
    throw new Error(
      "AA API key environment variable is missing (AA_API_KEY or fallbacks)",
    );
  }

  let lastStatus = null;
  for (let i = 0; i < candidates.length; i += 1) {
    const { label, key } = candidates[i];
    const res = await fetchImpl(url, {
      headers: {
        ...extraHeaders,
        "x-api-key": key,
        accept: "application/json",
      },
    });

    if (res.ok) {
      return res;
    }

    lastStatus = res.status;
    if (res.status === 429 && i < candidates.length - 1) {
      console.log(
        `[aa-source] AA API rate limited (429) on key ${label}; trying next key`,
      );
      continue;
    }

    throw new Error(`AA API error: ${res.status}`);
  }

  throw new Error(`AA API error: ${lastStatus ?? "unknown"}`);
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

  const allModels = [];
  let tier = "unknown";
  let intelligenceIndexVersion = null;
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const res = await fetchWithAaApiKeys(withPage(url, page), { fetchImpl });

    const json = await res.json();
    const rawModels = json.data || json;
    if (!Array.isArray(rawModels)) {
      throw new Error("API response data is not an array");
    }

    allModels.push(...rawModels);
    tier = json.tier || res.headers?.get?.("x-aa-tier") || tier;
    intelligenceIndexVersion = json.intelligence_index_version ?? intelligenceIndexVersion;

    hasMore = Boolean(json.pagination?.has_more);
    page += 1;
  }

  if (intelligenceIndexVersion === null) {
    try {
      intelligenceIndexVersion = await fetchIntelligenceIndexVersion({ url: versionUrl, fetchImpl });
    } catch (err) {
      // Keep official API model data even if page-only metadata is unavailable.
    }
  }

  return {
    ...parseMonitorSnapshot({ tier, intelligence_index_version: intelligenceIndexVersion, data: allModels }),
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
  fetchWithAaApiKeys,
  getAaApiKeyCandidates,
  scaledPercentOrNull,
  fetchMonitorSnapshot,
  normalizeModel,
  parseIntelligenceIndexVersion,
  parseMonitorSnapshot,
};
