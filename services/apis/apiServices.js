const axios = require("axios");

/* ===================== WIKIPEDIA ===================== */
const WIKI_HEADERS = {
  "User-Agent": "StudyMate/1.0 (https://example.com; contact@example.com)",
  "Accept": "application/json"
};

async function wikipedia(query, limit = 5) {
  const res = await axios.get("https://en.wikipedia.org/w/api.php", {
    params: {
      action: "query",
      generator: "search",
      gsrsearch: query,
      gsrlimit: limit,
      prop: "extracts|pageimages",
      explaintext: true,
      exlimit: "max",
      exintro: false,
      pithumbsize: 400,
      format: "json",
      origin: "*"
    },
    headers: WIKI_HEADERS
  });

  const pages = Object.values(res.data.query?.pages || {});

  return {
    source: "wikipedia",
    error: false,
    results: pages.map(p => ({
      id: `wiki-${p.pageid}`,
      source: "wikipedia",
      title: p.title,
      preview: p.extract?.slice(0, 200) || "",
      fullText: p.extract || "",
      image: p.thumbnail?.source || null,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title)}`,
      meta: {},
      pulledAt: Date.now()
    }))
  };
}

/* ===================== WIKIDATA ===================== */
async function wikidata(query, limit = 5) {
  const res = await axios.get("https://www.wikidata.org/w/api.php", {
    params: {
      action: "wbsearchentities",
      search: query,
      language: "en",
      limit,
      format: "json",
      origin: "*"
    }
  });

  return {
    source: "wikidata",
    error: false,
    results: res.data.search.map(e => {
      const text =
        `Concept: ${e.label}\n\n` +
        `Description: ${e.description || "No description"}\n\n` +
        `This content comes from Wikidata, which provides structured facts rather than full articles.`;

      return {
        id: `wikidata-${e.id}`,
        source: "wikidata",
        title: e.label,
        preview: e.description || "",
        fullText: text,
        image: null,
        url: `https://www.wikidata.org/wiki/${e.id}`,
        meta: { conceptId: e.id },
        pulledAt: Date.now()
      };
    })
  };
}

/* ===================== OPENALEX ===================== */
async function openalex(query, limit = 5) {
  const res = await axios.get("https://api.openalex.org/works", {
    params: { search: query, per_page: limit }
  });

  return {
    source: "openalex",
    error: false,
    results: res.data.results.map(p => {
      const authors = p.authorships?.map(a => a.author.display_name).join(", ");

      const text =
        `Title: ${p.title}\n\n` +
        `Year: ${p.publication_year}\n\n` +
        `Authors:\n${authors || "N/A"}\n\n` +
        `This is an academic reference from OpenAlex. Full papers may require publisher access.`;

      return {
        id: `openalex-${p.id}`,
        source: "openalex",
        title: p.title,
        preview: p.title,
        fullText: text,
        image: null,
        url: p.primary_location?.source?.homepage_url || p.id,
        meta: { year: p.publication_year, authors },
        pulledAt: Date.now()
      };
    })
  };
}

/* ===================== DUCKDUCKGO ===================== */
async function duckduckgo(query) {
  const res = await axios.get("https://api.duckduckgo.com/", {
    params: {
      q: query,
      format: "json",
      no_html: 1
    }
  });

  if (!res.data.AbstractText) {
    return { source: "duckduckgo", error: false, results: [] };
  }

  const text =
    `Summary:\n\n${res.data.AbstractText}\n\n` +
    `DuckDuckGo provides concise summaries, not full articles.`;

  return {
    source: "duckduckgo",
    error: false,
    results: [{
      id: `ddg-${query}`,
      source: "duckduckgo",
      title: res.data.Heading || query,
      preview: res.data.AbstractText.slice(0, 200),
      fullText: text,
      image: res.data.Image || null,
      url: res.data.AbstractURL || null,
      meta: {},
      pulledAt: Date.now()
    }]
  };
}
/* ===================== UNSPLASH ===================== */
async function unsplash(query, limit = 5) {
  const res = await axios.get("https://api.unsplash.com/search/photos", {
    params: {
      query,
      per_page: limit
    },
    headers: {
      Authorization: `Client-ID ${process.env.UNSPLASH_KEY}`
    }
  });

  return {
    source: "unsplash",
    error: false,
    results: res.data.results.map(img => ({
      id: `unsplash-${img.id}`,
      source: "unsplash",
      title: img.alt_description || query,
      preview: img.urls.small,
      fullText: `Photo by ${img.user.name} on Unsplash.`,
      image: img.urls.regular,
      url: img.links.html,
      meta: {
        photographer: img.user.name
      },
      pulledAt: Date.now()
    }))
  };
}
module.exports = {
  wikipedia,
  wikidata,
  openalex,
  duckduckgo,
  unsplash,
};
