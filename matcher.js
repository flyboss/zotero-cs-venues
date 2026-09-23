var CSMatcher = (() => {
  function normalize(value) {
    return String(value || "").normalize("NFKC").toLowerCase()
      .replace(/&amp;|&/g, " and ").replace(/[’']/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
  }
  function clean(value) {
    return normalize(value).replace(/\b(?:19|20)\d{2}\b/g, " ")
      .replace(/\b\d+(?:st|nd|rd|th)\b/g, " ")
      .replace(/\b(?:(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\s+)?(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth)\b/g, " ")
      .replace(/\s+/g, " ").trim();
  }
  const contains = (text, part) => (` ${text} `).includes(` ${part} `);
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const catalog = CS_VENUES.map(v => ({...v, names: v.aliases.map(normalize)}));
  function one(text, kind) {
    const raw = String(text || "");
    const norm = normalize(raw), stripped = clean(raw);
    if (!norm) return null;
    const bare = kind === "conferencePaper" ? stripped.replace(/^(?:proceedings of (?:the )?|the )/, "").replace(/\s+(?:conference|symposium)$/, "") : stripped;
    const exact = catalog.filter(v => v.kind === kind && v.names.some(n => n === norm || n === stripped || n === bare));
    if (exact.length === 1) return exact[0];
    if (exact.length > 1 || kind === "journalArticle") return null;
    // An explicit venue acronym outranks a generic full name (e.g. Findings ... EACL).
    const acronyms = catalog.filter(v => v.kind === kind && v.aliases.some(alias => {
      if (!/^[A-Za-z0-9* &-]{2,18}$/.test(alias) || alias.split(/\s+/).length > 2) return false;
      const isShort = alias === v.short || ["NIPS", "ACMMM"].includes(alias);
      if (!isShort) return false;
      // Short common words such as SC/CHI/DATE only match exact names or explicit parentheses.
      if (alias.length <= 3 || ["DATE", "FAST", "MICRO"].includes(alias)) {
        return new RegExp(`(?:^|\\()${esc(alias)}(?:\\s+(?:19|20)\\d{2})?(?:$|\\)|\\s*['’]\\d{2}\\b|\\s+(?:workshops?|conference|symposium)\\b)`, "i").test(raw)
          || /findings/i.test(raw) && new RegExp(`\\b${esc(alias)}\\b`, "i").test(raw);
      }
      return new RegExp(`(?:^|[^A-Za-z0-9])${esc(alias)}(?:$|[^A-Za-z0-9])`, "i").test(raw);
    }));
    // Specific joint/regional venue wins over its parent token.
    for (const [specific, parents] of [["SIGIR-AP", ["SIGIR"]], ["LREC-COLING", ["LREC", "COLING"]]]) {
      if (acronyms.some(v => v.short === specific)) {
        for (let i = acronyms.length - 1; i >= 0; i--) if (parents.includes(acronyms[i].short)) acronyms.splice(i, 1);
      }
    }
    const full = [];
    for (const v of catalog.filter(v => v.kind === kind)) {
      const matches = v.names.filter(n => n.split(" ").length >= 3 && contains(stripped, n));
      for (const name of matches) full.push({v, name});
    }
    const specific = full.filter(a => !full.some(b => b.v.short !== a.v.short && b.name.length > a.name.length && contains(b.name, a.name)));
    let names = [...new Set(specific.map(x => x.v.short))];
    for (const [child, parents] of [["SIGIR-AP", ["SIGIR"]], ["LREC-COLING", ["LREC", "COLING"]]]) {
      if (names.includes(child) || acronyms.some(v => v.short === child)) {
        names = names.filter(n => !parents.includes(n));
        for (let i = acronyms.length - 1; i >= 0; i--) if (parents.includes(acronyms[i].short)) acronyms.splice(i, 1);
      }
    }
    if (acronyms.length === 1) {
      const winner = acronyms[0];
      // ACL's organization name appears in NAACL/EACL/Findings titles.
      const others = names.filter(n => n !== winner.short && !(n === "ACL" && ["NAACL", "EACL", "AACL", "EMNLP", "COLING"].includes(winner.short)));
      if (others.length) return null;
      return winner;
    }
    if (acronyms.length > 1 || names.length !== 1) return null;
    return specific.find(x => x.v.short === names[0]).v;
  }
  function describe(text, kind) {
    const hit = one(text, kind);
    if (!hit) return null;
    let short = hit.short;
    if (kind === "conferencePaper") {
      if (/\bfindings\s+of\b/i.test(text)) short = `Findings of ${short}`;
      if (/\bworkshops?\b/i.test(text) && hit.short !== "SemEval") short += " Workshop";
      else if (/\bindustry\s+track\b/i.test(text)) short += " Industry Track";
      else if (/\bcompanion\b/i.test(text)) short += " Companion";
      else if (/\bdemonstrations?\b|\bsystem\s+demos?\b/i.test(text)) short += " Demo";
      if (hit.short === "SIGGRAPH" && /\basia\b/i.test(text)) short = "SIGGRAPH Asia";
    }
    return {short, abbr: kind === "conferencePaper" ? short : hit.abbr, base: hit.short};
  }
  function findingsDOI(item) {
    // Only decode this documented, explicit publisher namespace; no arbitrary DOI guessing.
    const doi = String(item.DOI || "").trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
    const found = doi.match(/^10\.18653\/v1\/(20\d{2})\.findings-(acl|emnlp|naacl|eacl|aacl)\.[1-9]\d*$/i);
    if (!found) return null;
    const base = found[2].toUpperCase();
    const short = `Findings of ${base}`;
    return {base, short, abbr: short, verifiedYear: found[1]};
  }
  function analyze(item) {
    const kind = item.itemType;
    if (!["conferencePaper", "journalArticle"].includes(kind)) return {hit: null, candidates: [], conflict: false};
    const fields = kind === "conferencePaper" ? ["conferenceName", "proceedingsTitle"] : ["publicationTitle"];
    const candidates = fields.map(field => ({...describe(item[field] || "", kind), field})).filter(h => h.short);
    if (!candidates.length) return {hit: null, candidates, conflict: false};
    const unique = [...new Map(candidates.map(h => [h.short, h])).values()];
    if (unique.length === 1) return {hit: unique[0], candidates, conflict: false};
    // A generic meeting name plus its more specific proceedings is not a conflict.
    const bases = new Set(unique.map(h => h.base));
    const specific = unique.filter(h => h.short !== h.base);
    if (bases.size === 1 && specific.length === 1) return {hit: specific[0], candidates, conflict: false};
    const reason = candidates.map(h => (h.field === "conferenceName" ? "会议名称：" : "论文集标题：") + h.short).join("；");
    const evidence = findingsDOI(item);
    if (evidence && candidates.some(h => h.short === evidence.short || h.base === evidence.base && h.short === h.base)) {
      return {hit: evidence, candidates, conflict: true, resolvedBy: "DOI", reason: reason + "；依据 ACL Findings DOI 选择 " + evidence.short};
    }
    return {hit: null, candidates, conflict: true, reason: reason + "；缺少可判定的依据，跳过填充"};
  }
  function match(item) { return analyze(item).hit; }
  function year(item) {
    const years = value => [...new Set(String(value || "").match(/\b(?:18|19|20)\d{2}\b/g) || [])];
    const dated = years(item.date);
    if (dated.length === 1) return dated[0];
    if (dated.length > 1) return "";
    if (item.itemType !== "conferencePaper") return "";
    const named = years(`${item.conferenceName || ""} ${item.proceedingsTitle || ""}`);
    return named.length === 1 ? named[0] : "";
  }
  function display(item) {
    if (!["conferencePaper", "journalArticle", "preprint"].includes(item.itemType)) return "";
    const override = manualValue(item.extra);
    if (override) {
      const value = year(item);
      return value && !/\b(?:18|19|20)\d{2}\b/.test(override) ? `${override} ${value}` : override;
    }
    const decision = analyze(item);
    if (decision.conflict && !decision.hit) {
      const suffix = year(item);
      return `⚠ 会议冲突：${decision.candidates.map(h => h.short).join(" / ")}${suffix ? " " + suffix : ""}`;
    }
    const short = decision.hit?.short || (item.itemType === "conferencePaper" ? extraValue(item.extra) : item.journalAbbreviation) || (isArxiv(item) ? "arXiv" : "");
    if (!short) return "";
    const value = decision.hit?.verifiedYear || year(item);
    // Preserve a year already present in a manually supplied abbreviation.
    return value && !/\b(?:18|19|20)\d{2}\b/.test(short) ? `${short} ${value}` : short;
  }
  function isArxiv(item) {
    // A real, unrecognized publication venue must not be replaced by an arXiv link.
    const venues = [item.conferenceName, item.proceedingsTitle, item.publicationTitle].filter(Boolean);
    if (venues.some(v => !/^arxiv\b/i.test(String(v).trim()))) return false;
    if (/^arxiv(?:\.org)?$/i.test(String(item.repository || "").trim())) return true;
    if (/^https?:\/\/(?:export\.)?arxiv\.org\/(?:abs|pdf|html)\//i.test(item.url || "")) return true;
    if (/^(?:https?:\/\/(?:dx\.)?doi\.org\/)?10\.48550\/arxiv\./i.test(item.DOI || "")) return true;
    if (/^\s*arxiv\s*:\s*\S+/im.test(item.extra || "")) return true;
    if (item.itemType === "preprint" && /^(?:arxiv\s*:\s*)?(?:\d{2}(?:0[1-9]|1[0-2])\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?$/i.test(String(item.archiveID || "").trim())) return true;
    return venues.some(v => /^arxiv\b/i.test(String(v).trim()));
  }
  function extraValue(extra) {
    return String(extra || "").match(/^\s*shortConferenceName\s*:\s*(.*?)\s*$/im)?.[1] || "";
  }
  function manualValue(extra) {
    return String(extra || "").match(/^[\t ]*csVenueOverride[\t ]*:[\t ]*([^\r\n]*)/im)?.[1].trim() || "";
  }
  function setManual(extra, value) {
    if (typeof value !== "string" || /[\r\n\u0000-\u001f\u007f]/.test(value) || value.trim().length > 200) {
      throw new Error("缩写须为不超过 200 字的单行文字。");
    }
    const text = value.trim();
    const lines = String(extra || "").split(/\r?\n/).filter(line => !/^[\t ]*csVenueOverride[\t ]*:/i.test(line));
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    if (text) lines.push(`csVenueOverride: ${text}`);
    return lines.join("\n");
  }
  function setExtra(extra, value) {
    const lines = String(extra || "").split(/\r?\n/);
    const out = lines.filter(line => !/^\s*shortConferenceName\s*:/i.test(line));
    while (out.length && !out[out.length - 1].trim()) out.pop();
    out.push(`shortConferenceName: ${value}`);
    return out.join("\n");
  }
  function plan(item) {
    const override = manualValue(item.extra);
    if (override) return {status: "preserved", hit: {short: override}, current: override, explanation: "此条目已手工设置 CS 缩写，自动填充不会修改它。"};
    const decision = analyze(item);
    const hit = decision.hit;
    if (!hit) {
      return {status: "unknown", reason: decision.reason || "词库未命中或名称有歧义", conflict: decision.conflict};
    }
    const field = item.itemType === "conferencePaper" ? "extra" : "journalAbbreviation";
    const current = field === "extra" ? extraValue(item.extra) : String(item[field] || "").trim();
    const explanation = decision.resolvedBy ? decision.reason : "";
    if (current) return {status: "preserved", hit, current, explanation};
    return {status: "fill", hit, field, explanation, before: item[field] || "", after: field === "extra" ? setExtra(item.extra, hit.abbr) : hit.abbr};
  }
  return {normalize, clean, match, one, analyze, plan, year, display, isArxiv, manualValue, setManual, extraValue, setExtra, count: catalog.length};
})();
