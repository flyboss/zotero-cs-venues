var CSArxiv = {
  tail: Promise.resolve(),
  recognize(comments, references) {
    const refs = references.flatMap(text => CSMatcher.publicationMatches(text, true));
    const hints = comments.flatMap(text => CSMatcher.publicationMatches(text, false));
    const evidence = refs.length ? refs : hints;
    const venues = [...new Set(evidence.map(hit => hit.short))];
    if (venues.length !== 1) return null;
    const short = venues[0];
    const years = new Set(evidence.map(hit => hit.year).filter(Boolean));
    if (!years.size) {
      for (const hit of hints) if (hit.short === short && hit.year) years.add(hit.year);
    }
    return {short, year: years.size === 1 ? [...years][0] : ""};
  },
  local(data, notes = []) {
    const comments = [], references = [];
    for (const text of [data.extra, ...notes]) {
      for (const [, field, value] of String(text || "").matchAll(/^[\t ]*(?:arxiv[\t ]+)?(comments?|journal[ _-]+ref(?:erence)?)[\t ]*:[\t ]*(.+)$/gim)) {
        (/^journal/i.test(field) ? references : comments).push(value);
      }
    }
    return this.recognize(comments, references);
  },
  cacheKey(item, id) {
    return `csvenues.title.arxiv.${id ? `id.${id.toLowerCase()}` : `item.${item.libraryID}.${item.key}`}`;
  },
  cached(key) {
    try {
      return JSON.parse(Zotero.Prefs.get(key) || "null");
    } catch (_) { return null; }
  },
  result(item, data) {
    if (!CSMatcher.isArxiv(data)) return null;
    return this.local(data) || this.cached(this.cacheKey(item, CSMatcher.arxivID(data)));
  },
  store(key, result, active) {
    const value = JSON.stringify(result || {short: "arXiv"});
    if (Zotero.Prefs.get(key) === value) return;
    Zotero.Prefs.set(key, value);
    if (result && active()) Zotero.ItemTreeManager.refreshColumns();
  },
  async inspect(item, data, active) {
    const id = CSMatcher.arxivID(data);
    const key = this.cacheKey(item, id);
    const local = this.local(data);
    if (local) {
      this.store(key, local, active);
      return;
    }
    await item.loadDataType("childItems");
    const notes = await Zotero.Items.getAsync(item.getNotes());
    const texts = [];
    for (const note of notes.filter(Boolean)) {
      await note.loadDataType("note");
      texts.push(Zotero.Utilities.unescapeHTML(Zotero.Utilities.cleanTags(note.getNote())));
    }
    if (!active()) return;
    const result = this.local(data, texts);
    if (result || !id) this.store(key, result, active);
    else if (!this.cached(key)) this.enqueue(id, key, active);
  },
  enqueue(id, key, active) {
    this.tail = this.tail.then(async () => {
      if (!active() || this.cached(key)) return;
      // The legacy API requires one connection and at least three seconds between requests.
      const lastRequest = "csvenues.title.arxiv.lastRequest";
      const wait = Math.min(3000, Number(Zotero.Prefs.get(lastRequest) || 0) + 3000 - Date.now());
      if (wait > 0) await Zotero.Promise.delay(wait);
      if (!active() || this.cached(key)) return;
      Zotero.Prefs.set(lastRequest, String(Date.now()));
      let result;
      try {
        result = await this.query(id);
      } catch (e) {
        Zotero.debug(`CS Title: arXiv lookup failed for ${id}: ${e.message || String(e)}`);
      }
      if (!this.cached(key)) this.store(key, result, active);
    }).catch(e => Zotero.logError(e));
  },
  async query(id) {
    const url = `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`;
    const response = await Zotero.HTTP.request("GET", url, {
      responseType: "document", timeout: 10000, errorDelayMax: 0,
      anon: true, followRedirects: false
    });
    const atomNS = "http://www.w3.org/2005/Atom", arxivNS = "http://arxiv.org/schemas/atom";
    const entries = response.responseXML?.getElementsByTagNameNS(atomNS, "entry") || [];
    for (const entry of entries) {
      const url = entry.getElementsByTagNameNS(atomNS, "id")[0]?.textContent.trim();
      if (CSMatcher.arxivID({url}).toLowerCase() !== id.toLowerCase()) continue;
      const text = name => Array.from(entry.getElementsByTagNameNS(arxivNS, name), node => node.textContent);
      return this.recognize(text("comment"), text("journal_ref"));
    }
    return null;
  }
};
