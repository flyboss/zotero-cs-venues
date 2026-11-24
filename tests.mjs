import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read = name => fs.readFile(new URL(name, import.meta.url), 'utf8');
export async function runTests() {
  const timers = [], registrations = [], unregisteredColumns = [], notices = [], requests = [];
  const prefs = new Map([['csvenues.auto', true]]);
  const items = new Map();
  let observer, mockResponse, saves = 0, undo = 0, errors = 0, refreshes = 0, now = 100000;
  const TestDate = class extends Date {static now() {return now;}};
  const Zotero = {
    Prefs: {get: k => prefs.get(k), set: (k, v) => prefs.set(k, v)},
    Libraries: {userLibraryID: 1, get: id => ({editable: id === 1})},
    Items: {get: id => items.get(id), getAsync: async ids => ids.map(id => items.get(id)), getAll: async () => [...items.values()]},
    ftl: {addResourceIds() {}, removeResourceIds() {}},
    getMainWindows: () => [], logError: () => errors++, debug() {},
    ItemTreeManager: {registerColumn: o => { registrations.push(o); return o.dataKey; },
      unregisterColumn: key => unregisteredColumns.push(key), refreshColumns: () => refreshes++},
    MenuManager: {registerMenu: o => {registrations.push(o); return o.menuID;}, unregisterMenu() {}},
    Notifier: {registerObserver: o => {observer = o; return 'observer';}, unregisterObserver: () => {observer = null;}},
    DB: {executeTransaction: async fn => fn()},
    UndoHistory: {stageAction: () => undo++},
    Promise: {delay: async ms => {now += ms;}},
    Utilities: {cleanTags: text => text.replace(/<[^>]+>/g, ''), unescapeHTML: text => text.replaceAll('&amp;', '&')},
    HTTP: {request: async (method, url, options) => {
      requests.push({method, url, options, now});
      return mockResponse(url);
    }}
  };
  const Components = {classes: {'@mozilla.org/timer;1': {createInstance: () => ({
    cancel() {this.cancelled = true;}, initWithCallback(fn) {this.fn = fn; timers.push(this);}
  })}}, interfaces: {nsITimer: {TYPE_ONE_SHOT: 0}}};
  const Services = {prompt: {alert: (_, title, msg) => notices.push(msg)}};
  const ctx = vm.createContext({Zotero, Components, Services, Date: TestDate});
  vm.runInContext(await read('config.js'), ctx, {filename: 'config.js'});
  ctx.CS_VENUES = ctx.CSVenueConfig.parse(JSON.parse(await read('venues.json')));
  for (const name of ['matcher.js', 'arxiv.js', 'main.js']) vm.runInContext(await read(name), ctx, {filename: name});
  const M = ctx.CSMatcher, A = ctx.CSArxiv, app = ctx.CSVenueApp;
  const plugin = JSON.parse(await read('manifest.json')).applications.zotero;
  let checks = 0;
  const eq = (actual, expected, message) => {assert.equal(actual, expected, message); checks++;};
  const customConfig = {conferences: {EXCONF: ['Example Conference on Computing']}, journals: {EXJ: {abbreviation:'Ex. J. Comput.', aliases:['Example Journal of Computing']}}};
  const parsed = ctx.CSVenueConfig.parse(customConfig);
  eq(parsed[0].short, 'EXCONF'); eq(parsed[0].aliases.includes('EXCONF'), true);
  eq(parsed[1].abbr, 'Ex. J. Comput.');
  const customContext = vm.createContext({CS_VENUES: parsed});
  vm.runInContext(await read('matcher.js'), customContext);
  eq(customContext.CSMatcher.display({itemType:'conferencePaper', proceedingsTitle:'Example Conference on Computing', date:'2026'}), 'EXCONF 2026');
  eq(customContext.CSMatcher.display({itemType:'journalArticle', publicationTitle:'Example Journal of Computing', date:'2026'}), 'EXJ 2026');
  eq(customContext.CSMatcher.plan({itemType:'journalArticle', publicationTitle:'Example Journal of Computing'}).after, 'Ex. J. Comput.');
  for (const invalid of [null, {conferences:[],journals:{}}, {conferences:{BAD:'not an array'},journals:{}}, {conferences:{BAD:['']},journals:{}}, {conferences:{},journals:{BAD:{aliases:[]}}}]) {
    assert.throws(() => ctx.CSVenueConfig.parse(invalid)); checks++;
  }
  const conference = (proceedingsTitle, conferenceName = '') => ({itemType: 'conferencePaper', proceedingsTitle, conferenceName});
  const journal = publicationTitle => ({itemType: 'journalArticle', publicationTitle});
  const cases = [
    [conference('The Twelfth International Conference on Learning Representations'), 'ICLR'],
    [conference('Proceedings of ACL 2025'), 'ACL'],
    [conference('Proceedings of the KDD 2024 Conference'), 'KDD'],
    [conference('International Conference on Computer Vision and Pattern Recognition'), 'CVPR'],
    [conference('Forty-second International Conference on Machine Learning'), 'ICML'],
    [conference('', 'International Conference on Learning Representations'), 'ICLR'],
    [conference('Proceedings of the 62nd Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers)'), 'ACL'],
    [conference('Findings of the Association for Computational Linguistics: EMNLP 2025'), 'Findings of EMNLP'],
    [conference('Findings of the Association for Computational Linguistics: EACL 2026'), 'Findings of EACL'],
    [conference('Proceedings of the 2025 Conference of the Nations of the Americas Chapter of the Association for Computational Linguistics: Human Language Technologies'), 'NAACL'],
    [conference('Proceedings of the 2024 Conference on Empirical Methods in Natural Language Processing: Industry Track'), 'EMNLP Industry Track'],
    [conference('ICLR 2024 Workshop on Reliable and Responsible Foundation Models'), 'ICLR Workshop'],
    [conference('NeurIPS 2023 Workshop: New Frontiers in Graph Learning'), 'NeurIPS Workshop'],
    [conference('Companion Proceedings of the ACM on Web Conference 2025'), 'WWW Companion'],
    [conference('Proceedings of the 2025 Annual International ACM SIGIR Conference on Research and Development in Information Retrieval in the Asia Pacific Region', 'SIGIR-AP 2025:Annual International ACM SIGIR Conference on Research and Development in Information Retrieval in the Asia Pacific Region'), 'SIGIR-AP'],
    [conference('Proceedings of the 13th Joint Conference on Lexical and Computational Semantics (*SEM 2024)'), '*SEM'],
    [conference('2025 IEEE/ACM 47th International Conference on Software Engineering (ICSE)'), 'ICSE'],
    [conference('ACM SIGGRAPH Asia 2025'), 'SIGGRAPH Asia'],
    [conference('Proceedings of LREC-COLING 2024'), 'LREC-COLING'],
    [journal('ACM Trans. Inf. Syst.'), 'TOIS'],
    [journal('IEEE Transactions on Knowledge and Data Engineering'), 'TKDE'],
    [journal('Pattern Recognition Letters'), 'PRL'],
    [journal('Transactions of the Association for Computational Linguistics'), 'TACL'],
    [journal('Proceedings of the VLDB Endowment'), 'PVLDB'],
    [journal('ACM Computing Surveys'), 'CSUR'],
    [conference('Unknown Conference on Machine Learning Applications'), null],
    [conference('A workshop about the date of fast computers'), null],
    [journal('Advances in Machine Learning Applications'), null],
    [{itemType: 'preprint', publicationTitle: 'ICLR', title: 'Published at ICML'}, null],
    [{itemType: 'conferencePaper', title: 'A survey of ICML papers'}, null],
    [conference('ICLR Workshop 2024', 'Findings of the Association for Computational Linguistics ACL 2024'), null],
    [conference('Proceedings of ICML and ICLR 2025'), null]
  ];
  for (const [input, expected] of cases) eq(M.match(input)?.short ?? null, expected, JSON.stringify(input));
  eq(M.display({...conference('ACL'), date: '2026-07-12'}), 'ACL 2026');
  eq(M.display(conference('The Twelfth International Conference on Learning Representations', 'ICLR 2024')), 'ICLR 2024');
  eq(M.display({...conference('ICML 2024'), date: '2025'}), 'ICML 2025', 'date takes priority');
  eq(M.display(conference('Proceedings of ACL 2026', 'ACL 2026')), 'ACL 2026');
  eq(M.display(conference('ACL 2026', 'ACL 2025')), 'ACL', 'ambiguous fallback omits year');
  eq(M.display({...conference('ACL 2026'), date: '2024-2025'}), 'ACL', 'date range is ambiguous');
  eq(M.display(conference('ICLR')), 'ICLR');
  eq(M.display({...journal('ACM Computing Surveys'), date: 'May 2024'}), 'CSUR 2024');
  eq(M.display({...conference('Unknown'), extra: 'shortConferenceName: Custom 2024', date: '2024'}), 'Custom 2024');
  eq(M.display({...conference('Unknown'), date: '2026'}), '');
  eq(M.display({...conference('ICLR'), date: '2026年5月'}), 'ICLR 2026');
  eq(M.plan({...conference('ACL 2026'), date: '2026'}).after, 'shortConferenceName: ACL', 'year must not enter stored abbreviation');
  eq(M.display({itemType:'preprint', repository:'arXiv', date:'2026-05-06'}), 'arXiv 2026');
  eq(M.display({itemType:'preprint', url:'https://arxiv.org/abs/2605.12345', date:'2026'}), 'arXiv 2026');
  eq(M.display({itemType:'preprint', DOI:'10.48550/arXiv.2605.12345', date:'2026'}), 'arXiv 2026');
  eq(M.display({itemType:'preprint', archiveID:'2605.12345v2', date:'2026'}), 'arXiv 2026');
  eq(M.display({itemType:'preprint', extra:'arXiv: cs/9901001', date:'1999'}), 'arXiv 1999');
  eq(M.display({itemType:'preprint', repository:'arXiv'}), 'arXiv', 'no invented year');
  eq(M.display({itemType:'preprint', repository:'bioRxiv', date:'2026'}), '');
  eq(M.display({itemType:'preprint', url:'https://arxiv.org.example.com/abs/2605.12345'}), '');
  eq(M.display({...conference('ACL 2026'), url:'https://arxiv.org/abs/2605.12345'}), 'ACL 2026', 'published venue wins');
  eq(M.display({...journal('Unlisted Published Journal'), url:'https://arxiv.org/abs/2605.12345'}), '', 'unknown publication is not arXiv-only');
  eq(M.display({...journal('arXiv e-prints'), date:'2026'}), 'arXiv 2026');
  const title = 'Understanding Systems';
  for (const [data, expected] of [
    [{...conference('ICLR'), date:'2026-05-06'}, '[26 ICLR]'],
    [conference('2025 IEEE/ACM International Conference on Software Engineering'), '[25 ICSE]'],
    [{...journal('IEEE Transactions on Dependable and Secure Computing'), date:'2026'}, '[26 TDSC]'],
    [{...conference('Unknown'), date:'2004'}, '[04]'],
    [conference('ICSE'), '[ICSE]'],
    [journal('Unknown'), ''],
    [{itemType:'book', date:'1999'}, '[99]'],
    [{itemType:'preprint', repository:'arXiv', date:'2026'}, '[26 arXiv]'],
    [{...conference('ICSE'), date:'2025', extra:'csVenueOverride: Custom 2027'}, '[27 Custom]'],
    [{...conference('ICSE'), date:'2025', extra:'csVenueOverride: 2027'}, '[27]'],
    [{...conference('ICSE'), date:'2025', extra:'csVenueOverride: Custom (2027)'}, '[27 Custom]']
  ]) eq(M.displayTitle({...data, title}), expected ? `${expected} ${title}` : title, JSON.stringify(data));
  const iclr = {...conference('ICLR'), date:'2026'};
  for (const [data, input, output] of [
    [iclr, '[26 ICLR] Existing title', '[26 ICLR] Existing title'],
    [iclr, '[25 ICSE] Existing title', '[26 ICLR] Existing title'],
    [iclr, '[26 ICLR] [26 ICLR] Existing title', '[26 ICLR] Existing title'],
    [iclr, '[26] Existing title', '[26 ICLR] Existing title'],
    [iclr, '[ICLR] Existing title', '[26 ICLR] Existing title'],
    [iclr, '[26 ICLR] [Survey] Existing title', '[26 ICLR] [Survey] Existing title'],
    [iclr, '[26 Findings of ACL] Existing title', '[26 ICLR] Existing title'],
    [iclr, '[25] Existing title', '[26 ICLR] [25] Existing title'],
    [iclr, '[26 Samples] Existing title', '[26 ICLR] [26 Samples] Existing title'],
    [journal('Unknown'), '[26 ICLR] Existing title', '[26 ICLR] Existing title'],
    [conference('ICLR'), '[26 ICLR] Existing title', '[26 ICLR] Existing title'],
    [{...journal('Unknown'), date:'2027'}, '[26 ICLR] Existing title', '[27 ICLR] Existing title'],
    [{...iclr, extra:'csVenueOverride: Custom 2027'}, '[26 ICLR] Existing title', '[27 Custom] Existing title'],
    [{...iclr, extra:'csVenueOverride: Custom 2027'}, '[27 Custom] Existing title', '[27 Custom] Existing title']
  ]) eq(M.displayTitle({...data, title:input}), output, input);
  eq(M.displayTitle({...conference('ICSE'), date:'2025'}), '', 'missing title does not render a prefix on its own');
  for (const [data, expected] of [
    [{archiveID:'arXiv:2605.12345v2'}, '2605.12345'],
    [{archiveID:'HEP-EX/0307015v3'}, 'hep-ex/0307015'],
    [{url:'https://arxiv.org/pdf/0706.0001v1.pdf?download=1'}, '0706.0001'],
    [{url:'https://arxiv.org/html/2605.12345v2#sec-1'}, '2605.12345'],
    [{url:'https://export.arxiv.org/abs/math.gt/0307015/'}, 'math.GT/0307015'],
    [{DOI:'https://doi.org/10.48550/arXiv.2605.12345'}, '2605.12345'],
    [{extra:'Citation Key: keep\narXiv:2605.12345 [cs.SE]'}, '2605.12345'],
    [{number:'arXiv:2605.12345'}, '2605.12345'],
    [{number:'2605.12345'}, ''],
    [{url:'https://arxiv.org.example.com/abs/2605.12345'}, ''],
    [{archiveID:'2613.12345'}, ''],
    [{archiveID:'2605.12345vX'}, ''],
    [{DOI:'10.5555/arxiv.2605.12345'}, '']
  ]) eq(M.arxivID(data), expected, JSON.stringify(data));
  const draft = {itemType:'preprint', repository:'arXiv', date:'2026', title};
  for (const [comment, reference, expected] of [
    ['ICLR 2026', '', '[26 ICLR]'],
    ['Accepted to ICSE 2027', '', '[27 ICSE]'],
    ['To appear in ACM CCS 2026', '', '[26 CCS]'],
    ['Published in IEEE TSE, 2025', '', '[25 TSE]'],
    ['Accepted at ICML', '', '[26 ICML]'],
    ['23 pages, accepted for presentation at ICSE 2027', '', '[27 ICSE]'],
    ['Accepted to ICSE (code released in 2025)', '', '[26 ICSE]'],
    ['Submitted to ICML 2026', '', '[26 arXiv]'],
    ['', 'Under Review at ICML 2026', '[26 arXiv]'],
    ['Not accepted at ICLR 2026', '', '[26 arXiv]'],
    ['To be submitted to ICML 2026', '', '[26 arXiv]'],
    ['12 pages, 5 figures', '', '[26 arXiv]'],
    ['ICLR 2026 reviewer response', '', '[26 arXiv]'],
    ['', '', '[26 arXiv]'],
    ['', 'IEEE Trans. Softw. Eng., 51(3):123–131 (2025)', '[25 TSE]'],
    ['Accepted to ICSE 2027', 'IEEE Transactions on Software Engineering (2025)', '[25 TSE]'],
    ['Accepted to ICSE 2027', 'ICSE', '[27 ICSE]'],
    ['Submitted to ICML 2026. Accepted at ICLR 2027', '', '[27 ICLR]'],
    ['Accepted to ICSE 2027; accepted at ICLR 2026', '', '[26 arXiv]'],
    ['Accepted to ICSE 2025 or 2027', '', '[26 ICSE]']
  ]) eq(M.displayTitle(draft, A.recognize([comment], [reference])), `${expected} ${title}`, `${comment} | ${reference}`);
  const mixed = {...conference('ICLR 2024 Workshop on Reliable and Responsible Foundation Models', 'Findings of the Association for Computational Linguistics ACL 2024'), date:'2024'};
  const confirmed = {...mixed, DOI:'10.18653/v1/2024.findings-acl.212'};
  eq(M.display(confirmed), 'Findings of ACL 2024');
  eq(M.plan(confirmed).after, 'shortConferenceName: Findings of ACL');
  eq(M.plan(confirmed).explanation.includes('依据 ACL Findings DOI'), true);
  eq(M.display(mixed), '⚠ 会议冲突：Findings of ACL / ICLR Workshop 2024');
  eq(M.plan(mixed).status, 'unknown');
  eq(M.display({...mixed, extra:'shortConferenceName: ICLR'}), M.display(mixed), 'stale saved abbreviation must not hide conflict');
  eq(M.display({...confirmed, DOI:'https://doi.org/10.18653/v1/2024.findings-acl.212'}), 'Findings of ACL 2024');
  eq(M.display({...confirmed, date:'2023'}), 'Findings of ACL 2024', 'resolved version uses publisher DOI year');
  eq(M.analyze({...confirmed, DOI:'10.18653/v1/2024.findings-emnlp.212'}).hit, null, 'unrelated DOI cannot resolve candidates');
  eq(M.analyze({...confirmed, DOI:'10.9999/v1/2024.findings-acl.212'}).hit, null, 'publisher namespace must match');
  eq(M.analyze({...confirmed, DOI:'10.18653/v1/2024.findings-acl.212junk'}).hit, null, 'malformed identifier rejected');
  eq(M.match(conference('ICLR 2024 Workshop on Reliable Models', 'International Conference on Learning Representations')).short, 'ICLR Workshop');
  eq(M.match(conference('Findings of the Association for Computational Linguistics ACL 2024', 'Annual Meeting of the Association for Computational Linguistics')).short, 'Findings of ACL');
  eq(M.analyze(conference('ACL 2024 Workshop on Robust Models', 'Findings of the Association for Computational Linguistics ACL 2024')).conflict, true, 'same base but different tracks conflict');
  eq(M.match(conference('Findings of the Association for Computational Linguistics ACL 2024', 'Unrecognized Workshop')).short, 'Findings of ACL', 'unknown field must not contaminate a recognized track');
  eq(M.plan({...confirmed, extra:'shortConferenceName: Manual'}).status, 'preserved');
  eq(M.display({...mixed, extra:'csVenueOverride: ICLR Workshop'}), 'ICLR Workshop 2024', 'manual choice wins over conflict');
  eq(M.display({...confirmed, extra:'csVenueOverride: My Venue 2026'}), 'My Venue 2026', 'manual choice wins over DOI and date');
  eq(M.plan({...confirmed, extra:'csVenueOverride: My Venue'}).status, 'preserved', 'automatic filling honors manual choice');
  eq(M.display({itemType:'preprint', repository:'arXiv', date:'2026', extra:'csVenueOverride: Working paper'}), 'Working paper 2026');
  eq(M.manualValue('csVenueOverride: \nDOI: 10.1/example'), '', 'empty override cannot swallow following field');
  eq(M.manualValue('CSVENUEOVERRIDE: Custom'), 'Custom');
  eq(M.setManual('Citation Key: keep\nshortConferenceName: ACL\ncsVenueOverride: Old', ' New 2026 '), 'Citation Key: keep\nshortConferenceName: ACL\ncsVenueOverride: New 2026');
  eq(M.setManual('csVenueOverride: Old\nCitation Key: keep\nCSVENUEOVERRIDE: Duplicate', ''), 'Citation Key: keep');
  eq(M.setManual('', 'ACL'), 'csVenueOverride: ACL');
  assert.throws(() => M.setManual('', 'ACL\nDOI: changed')); checks++;
  assert.throws(() => M.setManual('', 'x'.repeat(201))); checks++;
  for (const venue of ctx.CS_VENUES) {
    for (const alias of venue.aliases) {
      const input = venue.kind === 'journalArticle' ? journal(alias) : conference(alias);
      eq(M.match(input)?.base, venue.short, `catalog alias ${alias}`);
    }
  }
  eq(M.plan({...conference('ICLR'), extra: 'Citation Key: abc\nDOI: 10.1/example'}).after,
    'Citation Key: abc\nDOI: 10.1/example\nshortConferenceName: ICLR', 'preserve unrelated Extra');
  eq(M.plan({...conference('ICLR'), extra: 'shortConferenceName: Custom'}).status, 'preserved');
  eq(M.plan({...journal('ACM Computing Surveys'), journalAbbreviation: 'Custom'}).status, 'preserved');
  eq(M.setExtra('shortConferenceName: \nCitation Key: k\nshortConferenceName: ', 'ICML'), 'Citation Key: k\nshortConferenceName: ICML');
  eq(M.plan(conference('ICLR', 'ICML')).conflict, true);
  function makeItem(id, data, libraryID = 1) {
    const item = {id, key: `item-${id}`, libraryID, itemType: data.itemType, data: {...data}, deleted: false,
      getField: f => item.data[f] || '', setField: (f, v) => {item.data[f] = v;},
      loadDataType: async () => {}, getNotes: () => item.data.notes || [], getNote: () => item.data.note,
      save: async () => {saves++; observer?.notify('modify', 'item', [id]);},
      saveTx: async options => {await item.save(); if (options?.undoAction) undo++;}
    };
    items.set(id, item); return item;
  }
  await app.start(plugin.id);
  eq(registrations.length, 4, 'two native columns and two menus registered');
  const [venueColumn, titleColumn] = registrations;
  eq(titleColumn.label, 'CS Title'); eq(titleColumn.showInColumnPicker, true); eq(titleColumn.hidden, true);
  eq(venueColumn.label, 'CS 缩写');
  const existingPrefixed = makeItem(200, {...iclr, title:'[25 ICSE] Existing title'});
  eq(titleColumn.dataProvider(existingPrefixed), '[26 ICLR] Existing title');
  eq(existingPrefixed.getField('title'), '[25 ICSE] Existing title');
  eq(saves, 0, 'display deduplication must not write Zotero items');
  eq(plugin.id === 'cs-venues@local.tools', false);
  eq(plugin.strict_min_version, '10.0'); eq(plugin.strict_max_version, '10.0.*');
  eq(plugin.update_url, 'https://raw.githubusercontent.com/flyboss/zotero-cs-venues/main/updates.json',
    'Zotero requires an update URL and it must target the fork');
  const updateManifest = JSON.parse(await read('updates.json'));
  assert.deepEqual(updateManifest.addons, {[plugin.id]: {updates: []}}); checks++;
  const a = makeItem(1, {...conference('ICLR'), extra: 'Citation Key: keep'});
  const b = makeItem(2, journal('IEEE Transactions on Knowledge and Data Engineering'));
  const c = makeItem(3, {...conference('ICML'), extra: 'shortConferenceName: Manual'});
  const d = makeItem(4, conference('Unknown venue'));
  const e = makeItem(5, conference('ACL'), 2);
  let result = await app.apply([a, b, c, d, e, a], true);
  eq(result.filled, 2); eq(result.preserved, 1); eq(result.unknown, 1); eq(result.skipped, 1);
  eq(saves, 2); eq(undo, 1); eq(app.pending.size, 0, 'own notifications do not loop');
  eq(b.data.journalAbbreviation, 'IEEE Trans. Knowl. Data Eng.');
  eq(app.display(b), 'TKDE');
  b.data.date = '2026-09-23'; eq(app.display(b), 'TKDE 2026');
  b.data.date = '2025'; eq(app.display(b), 'TKDE 2025', 'date edits update display');
  const preprint = makeItem(80, {itemType:'preprint', repository:'arXiv', date:'2026'});
  eq(app.display(preprint), 'arXiv 2026');
  eq((await app.apply([preprint], true)).skipped, 1, 'arXiv display does not write metadata');
  eq(a.data.extra, 'Citation Key: keep\nshortConferenceName: ICLR');
  await app.apply([a, b], true); eq(saves, 2, 'idempotent'); eq(undo, 1);
  a.data.extra = 'Citation Key: keep'; // Simulate undo (or Linter clearing Extra).
  observer.notify('modify', 'item', [a.id]);
  eq(app.pending.size, 0, 'undo must not be filled back automatically');
  const added = makeItem(6, conference('Forty-second International Conference on Machine Learning'));
  observer.notify('add', 'item', [added.id]);
  eq(app.pending.size, 1);
  timers.at(-1).fn(); await app.tail;
  eq(added.data.extra, 'shortConferenceName: ICML');
  const mixedItem = makeItem(81, mixed);
  eq((await app.apply([mixedItem], false)).conflicts, 1);
  mixedItem.data.DOI = confirmed.DOI;
  observer.notify('modify', 'item', [mixedItem.id]);
  eq(app.pending.size, 1, 'adding DOI must trigger reevaluation');
  timers.at(-1).fn(); await app.tail;
  eq(mixedItem.data.extra, 'shortConferenceName: Findings of ACL');
  prefs.set('csvenues.auto', false);
  const paused = makeItem(7, conference('ICLR'));
  observer.notify('add', 'item', [paused.id]); eq(app.pending.size, 0);
  const manualItem = makeItem(90, {...mixed, title:'Manual editing test', extra:'Citation Key: preserve\nshortConferenceName: Legacy'});
  const beforeManualSaves = saves, beforeManualUndo = undo;
  let suppliedPrompt;
  Services.prompt.prompt = (win, title, text, input) => {suppliedPrompt = input.value; input.value = 'ICLR Workshop'; return true;};
  await app.editManual(null, [manualItem]);
  eq(suppliedPrompt, 'Legacy', 'initial edit uses existing abbreviation when conflict cannot be resolved');
  eq(app.display(manualItem), 'ICLR Workshop 2024');
  eq(titleColumn.dataProvider(manualItem), '[24 ICLR Workshop] Manual editing test');
  eq(manualItem.data.extra, 'Citation Key: preserve\nshortConferenceName: Legacy\ncsVenueOverride: ICLR Workshop');
  eq(saves, beforeManualSaves + 1); eq(undo, beforeManualUndo + 1);
  eq((await app.apply([manualItem], false)).preserved, 1);
  Services.prompt.prompt = (win, title, text, input) => {suppliedPrompt = input.value; input.value = 'Ignored'; return false;};
  await app.editManual(null, [manualItem]);
  eq(suppliedPrompt, 'ICLR Workshop', 'existing manual value is editable');
  eq(saves, beforeManualSaves + 1, 'cancel does not save');
  await app.editManual(null, [manualItem, a]); eq(saves, beforeManualSaves + 1, 'multi-selection rejected');
  await app.editManual(null, [e]); eq(saves, beforeManualSaves + 1, 'read-only item rejected');
  await app.resetManual(null, [manualItem]);
  eq(manualItem.data.extra, 'Citation Key: preserve\nshortConferenceName: Legacy');
  eq(app.display(manualItem).startsWith('⚠ 会议冲突'), true, 'reset restores original conflict');
  eq(titleColumn.dataProvider(manualItem), '[24] Manual editing test');
  eq(undo, beforeManualUndo + 2);
  await app.resetManual(null, [manualItem]); eq(saves, beforeManualSaves + 2, 'reset is idempotent');
  await app.saveManual(preprint, 'Draft 2027'); eq(app.display(preprint), 'Draft 2027');
  app.preview(null, [preprint]); eq(notices.at(-1).includes('Draft 2027；手工设置优先'), true);
  await app.saveManual(preprint, ''); eq(app.display(preprint), 'arXiv 2026');
  const failedItem = makeItem(91, {...conference('ACL'), extra:'Citation Key: original'});
  failedItem.saveTx = async () => {throw new Error('simulated storage failure');};
  await assert.rejects(app.saveManual(failedItem, 'Custom'), /simulated storage failure/); checks++;
  eq(failedItem.data.extra, 'Citation Key: original', 'failed save restores in-memory Extra');
  eq(app.writing.size, 0);
  const atom = 'http://www.w3.org/2005/Atom', arxiv = 'http://arxiv.org/schemas/atom';
  function atomResponse(id, comment, reference) {
    const fields = new Map([
      [`${atom} id`, `http://arxiv.org/abs/${id}v1`], [`${arxiv} comment`, comment], [`${arxiv} journal_ref`, reference]
    ]);
    const entry = {getElementsByTagNameNS: (ns, name) => {
      const textContent = fields.get(`${ns} ${name}`);
      return textContent ? [{textContent}] : [];
    }};
    return {responseXML: {getElementsByTagNameNS: (ns, name) => ns === atom && name === 'entry' ? [entry] : []}};
  }
  let finishFirstRequest;
  const networkStarted = new Promise(resolve => {finishFirstRequest = resolve;});
  let releaseFirstRequest;
  mockResponse = url => {
    const id = new URL(url).searchParams.get('id_list');
    if (id === '2605.00001') return new Promise(resolve => {
      releaseFirstRequest = () => resolve(atomResponse(id, 'Submitted to ICML 2026', 'IEEE TSE, 2025'));
      finishFirstRequest();
    });
    if (id === '2605.00002') throw new Error('simulated offline');
    if (id === '2605.00008') return atomResponse('2605.99999', 'Accepted to ICSE 2027', '');
    if (id === '2605.00009') return {responseXML: null};
    if (id === '2605.00010') return atomResponse(id, 'Accepted to ICSE 2027', '');
    throw new Error(`Unexpected lookup for ${id}`);
  };
  const preprintWithID = (itemID, id, fields = {}) => makeItem(itemID, {...draft, archiveID:id, ...fields});
  const fromAPI = preprintWithID(100, '2605.00001');
  const offline = preprintWithID(101, '2605.00002');
  const duplicate = preprintWithID(102, '2605.00001v2');
  const withExtra = preprintWithID(103, '2605.00003', {extra:'arXiv Comments: ICLR 2026'});
  const withNote = preprintWithID(104, '2605.00004', {notes:[105]});
  const note = makeItem(105, {itemType:'note', note:'<div><p>Comment: Accepted to ICSE 2027</p></div>'});
  const existing = preprintWithID(106, '2605.00005');
  const synced = preprintWithID(107, '2605.00006');
  const wrongEntry = preprintWithID(108, '2605.00008');
  const malformed = preprintWithID(109, '2605.00009');
  const fromAPIComment = preprintWithID(110, '2605.00010');
  const withoutID = preprintWithID(111, '', {extra:'Journal Reference: ICSE 2027'});
  const beforeImport = structuredClone(fromAPI.data), beforeImportSaves = saves;
  observer.notify('modify', 'item', [existing.id]);
  observer.notify('add', 'item', [synced.id], {skipAutoSync:true});
  eq(app.pendingArxiv.size, 0, 'existing items and remote sync do not queue a lookup');
  eq(titleColumn.dataProvider(fromAPI), `[26 arXiv] ${title}`);
  eq(titleColumn.dataProvider(withExtra), `[26 ICLR] ${title}`);
  eq(requests.length, 0, 'rendering reads only local data');
  eq(observer.notify('add', 'item', [fromAPI.id, offline.id, duplicate.id, withExtra.id, withNote.id, note.id,
    wrongEntry.id, malformed.id, fromAPIComment.id, withoutID.id]), undefined, 'notifier does not await background work');
  timers.at(-1).fn();
  await networkStarted;
  await app.arxivInspection;
  eq(requests.length, 1, 'requests are serialized');
  eq(titleColumn.dataProvider(withNote), `[27 ICSE] ${title}`, 'translator note is used before network lookup');
  eq(titleColumn.dataProvider(withoutID), `[27 ICSE] ${title}`, 'local evidence works without an ID');
  releaseFirstRequest();
  await A.tail;
  eq(requests.length, 5, 'one lookup per uncached ID');
  eq(requests[0].method, 'GET');
  eq(requests[0].url, 'https://export.arxiv.org/api/query?id_list=2605.00001');
  eq(requests[0].options.errorDelayMax, 0, 'Zotero must not retry failed HTTP requests');
  eq(requests.slice(1).every((request, i) => request.now - requests[i].now >= 3000), true);
  eq(titleColumn.dataProvider(fromAPI), `[25 TSE] ${title}`);
  eq(venueColumn.dataProvider(fromAPI), 'TSE 2025');
  eq(titleColumn.dataProvider(duplicate), `[25 TSE] ${title}`);
  eq(titleColumn.dataProvider(fromAPIComment), `[27 ICSE] ${title}`);
  eq(titleColumn.dataProvider(offline), `[26 arXiv] ${title}`);
  eq(titleColumn.dataProvider(wrongEntry), `[26 arXiv] ${title}`);
  eq(titleColumn.dataProvider(malformed), `[26 arXiv] ${title}`);
  eq(refreshes, 5, 'successful results refresh both native columns');
  assert.deepEqual(fromAPI.data, beforeImport); checks++;
  eq(saves, beforeImportSaves, 'automatic arXiv processing writes no Zotero item fields');
  await app.saveManual(fromAPI, 'Custom');
  eq(titleColumn.dataProvider(fromAPI), `[25 Custom] ${title}`);
  await app.saveManual(fromAPI, 'Custom 2027');
  eq(titleColumn.dataProvider(fromAPI), `[27 Custom] ${title}`);
  await app.resetManual(null, [fromAPI]);
  eq(titleColumn.dataProvider(fromAPI), `[25 TSE] ${title}`);
  await app.stop(); eq(observer, null); eq(app.active, false); eq(errors, 0);
  eq(unregisteredColumns.join(','), 'csVenue,csTitle');
  // Exercise the real bootstrap loader so JSON packaging changes cannot silently break startup.
  const scripts = Object.fromEntries(await Promise.all(['config.js', 'matcher.js', 'arxiv.js', 'main.js'].map(async file => [file, await read(file)])));
  const rootURI = `jar:file:///test/extensions/${plugin.id}.xpi!/`;
  let loadedJSON;
  Zotero.File = {getResourceAsync: async uri => {loadedJSON = uri; return read('venues.json');}};
  const bootServices = {...Services, scriptloader: {loadSubScript(uri, target) {
    const file = uri.slice(rootURI.length);
    assert.ok(scripts[file], `unexpected bootstrap resource: ${uri}`);
    vm.runInNewContext(scripts[file], target, {filename: file});
  }}};
  const boot = vm.createContext({Zotero, Services: bootServices, Components});
  vm.runInContext(await read('bootstrap.js'), boot);
  await boot.startup({id:plugin.id, rootURI});
  eq(loadedJSON, rootURI + 'venues.json'); eq(boot.app.active, true);
  eq(boot.app.display(added), 'ICML', 'bootstrap loads JSON-backed matcher');
  eq(boot.app.display(fromAPI, true), `[25 TSE] ${title}`, 'cache survives a fresh plugin scope');
  const retry = preprintWithID(112, '2605.00002v2');
  observer.notify('modify', 'item', [existing.id]);
  observer.notify('add', 'item', [retry.id]);
  timers.at(-1).fn();
  await boot.app.arxivInspection;
  eq(requests.length, 5, 'persisted failure prevents retry after restart');
  eq(boot.app.display(retry, true), `[26 arXiv] ${title}`);
  const reimported = preprintWithID(113, '2605.00002v3', {notes:[note.id]});
  observer.notify('add', 'item', [reimported.id]);
  timers.at(-1).fn();
  await boot.app.arxivInspection;
  eq(boot.app.display(reimported, true), `[27 ICSE] ${title}`, 'new local evidence can replace a saved fallback');
  eq(requests.length, 5);
  await boot.shutdown(); eq(boot.app, null); eq(observer, null);
  for (const name of ['bootstrap.js', 'prefs.js']) new vm.Script(await read(name), {filename: name});
  return {passed: checks, venues: ctx.CS_VENUES.length, conferences: ctx.CS_VENUES.filter(v => v.kind === 'conferencePaper').length, journals: ctx.CS_VENUES.filter(v => v.kind === 'journalArticle').length};
}
console.log(JSON.stringify(await runTests()));
