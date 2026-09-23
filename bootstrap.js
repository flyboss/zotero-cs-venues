var app;
function install() {}
function uninstall() {}
async function startup({id, rootURI}) {
  const scope = {Zotero, Services, Components};
  Services.scriptloader.loadSubScript(rootURI + "config.js", scope);
  const config = JSON.parse(await Zotero.File.getContentsFromURLAsync(rootURI + "venues.json"));
  scope.CS_VENUES = scope.CSVenueConfig.parse(config);
  Services.scriptloader.loadSubScript(rootURI + "matcher.js", scope);
  Services.scriptloader.loadSubScript(rootURI + "main.js", scope);
  app = scope.CSVenueApp;
  await app.start(id);
}
function onMainWindowLoad({window}) { app?.attach(window); }
function onMainWindowUnload({window}) { app?.detach(window); }
async function shutdown() { if (app) await app.stop(); app = null; }
