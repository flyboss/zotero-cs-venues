/* Convert editable JSON data into the matcher catalog. No code belongs in venues.json. */
var CSVenueConfig = {
  parse(config) {
    const object = value => value && typeof value === "object" && !Array.isArray(value);
    const text = (value, where) => {
      if (typeof value !== "string" || !value.trim() || /[\r\n\u0000-\u001f]/.test(value)) {
        throw new Error(`venues.json: ${where} must be non-empty, single-line text`);
      }
      return value.trim();
    };
    const aliases = (value, where) => {
      if (!Array.isArray(value)) throw new Error(`venues.json: ${where} must be an array of names`);
      return value.map((name, i) => text(name, `${where}[${i}]`));
    };
    if (!object(config) || !object(config.conferences) || !object(config.journals)) {
      throw new Error("venues.json must contain conferences and journals objects");
    }
    const result = [];
    for (const [key, names] of Object.entries(config.conferences)) {
      const short = text(key, "conference abbreviation");
      result.push({kind: "conferencePaper", short, abbr: short,
        aliases: [...new Set([...aliases(names, `conferences.${key}`), short])]});
    }
    for (const [key, value] of Object.entries(config.journals)) {
      const short = text(key, "journal acronym");
      if (!object(value)) throw new Error(`venues.json: journals.${key} must be an object`);
      const abbr = text(value.abbreviation, `journals.${key}.abbreviation`);
      result.push({kind: "journalArticle", short, abbr,
        aliases: [...new Set([...aliases(value.aliases, `journals.${key}.aliases`), short, abbr])]});
    }
    return result;
  }
};
