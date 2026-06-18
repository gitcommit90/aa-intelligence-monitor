const AA_MODELS_URL = "https://artificialanalysis.ai/models";

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function decodeEscapedJson(rawText) {
  const text = String(rawText ?? "");

  try {
    return JSON.parse(text);
  } catch {}

  let normalized = text;
  for (let i = 0; i < 3; i += 1) {
    const next = normalized
      .replace(/\\\\/g, '\\')
      .replace(/\\"/g, '"');
    if (next === normalized) break;
    normalized = next;
    try {
      return JSON.parse(normalized);
    } catch {}
  }

  const jsonText = JSON.parse(
    `"${text
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n")}"`,
  );
  return JSON.parse(jsonText);
}

function extractEscapedDefaultDataArray(html) {
  const marker = "defaultData";
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) {
    throw new Error("defaultData marker not found");
  }

  const start = html.indexOf("[", markerIdx);
  if (start === -1) {
    throw new Error("defaultData array start not found");
  }

  let depth = 0;
  let inString = false;
  let end = -1;

  for (let i = start; i < html.length; i += 1) {
    const ch = html[i];

    if (ch === '"') {
      let backslashes = 0;
      for (let j = i - 1; j >= 0 && html[j] === "\\"; j -= 1) {
        backslashes += 1;
      }
      if (backslashes % 2 === 1) {
        inString = !inString;
      }
    }

    if (inString) {
      continue;
    }

    if (ch === "[") {
      depth += 1;
    } else if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) {
    throw new Error("defaultData array end not found");
  }

  return html.slice(start, end + 1);
}

function extractIndexVersion(html) {
  const match = html.match(/Artificial Analysis Intelligence Index v([0-9]+(?:\.[0-9]+)*)/i);
  return match ? match[1] : null;
}

function buildCreator(raw) {
  const creator = raw.model_creators;
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

function buildEvaluations(raw) {
  return {
    artificial_analysis_intelligence_index: numberOrNull(raw.intelligence_index),
    artificial_analysis_coding_index: numberOrNull(raw.coding_index),
    artificial_analysis_agentic_index: numberOrNull(raw.agentic_index),
  };
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

function parseMonitorSnapshot(html) {
  const rawModels = decodeEscapedJson(extractEscapedDefaultDataArray(html));
  if (!Array.isArray(rawModels)) {
    throw new Error("defaultData is not an array");
  }

  return {
    tier: "free",
    intelligence_index_version: extractIndexVersion(html),
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

  const res = await fetchImpl(url, {
    headers: {
      "user-agent": "Mozilla/5.0",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!res.ok) {
    throw new Error(`AA models page error: ${res.status}`);
  }

  const html = await res.text();
  return {
    ...parseMonitorSnapshot(html),
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  AA_MODELS_URL,
  buildCreator,
  buildEvaluations,
  buildPricing,
  decodeEscapedJson,
  extractEscapedDefaultDataArray,
  extractIndexVersion,
  fetchMonitorSnapshot,
  normalizeModel,
  parseMonitorSnapshot,
};
