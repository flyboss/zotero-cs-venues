var CSVenueApp = {
  active: false,
  pending: new Set(),
  writing: new Set(),
  seen: new Map(),
  menus: [],
  tail: Promise.resolve(),
  read(item) {
    const kind = item.itemType;
    if (!["conferencePaper", "journalArticle", "preprint"].includes(kind)) return {itemType: kind};
    const fields = kind === "conferencePaper" ? ["conferenceName", "proceedingsTitle", "extra", "date", "DOI", "url"]
      : kind === "journalArticle" ? ["publicationTitle", "journalAbbreviation", "date", "DOI", "url", "extra"]
      : ["repository", "archiveID", "date", "DOI", "url", "extra"];
    const result = {itemType: kind};
    for (const f of fields) result[f] = item.getField(f) || "";
    return result;
  },
  signature(item) {
    const data = this.read(item);
    return JSON.stringify([data.itemType, data.conferenceName, data.proceedingsTitle, data.publicationTitle, data.DOI]);
  },
  display(item) {
    try {
      const data = this.read(item);
      return CSMatcher.display(data);
    } catch (_) { return ""; }
  },
  attach(win) { win.MozXULElement.insertFTLIfNeeded("cs-venues.ftl"); },
  detach(win) { win.document.querySelector('[href="cs-venues.ftl"]')?.remove(); },
  async start(id) {
    this.id = id;
    this.active = true;
    Zotero.ftl.addResourceIds(["cs-venues.ftl"]);
    for (const win of Zotero.getMainWindows()) this.attach(win);
    this.column = Zotero.ItemTreeManager.registerColumn({
      pluginID: id, dataKey: "csVenue", label: "CS 缩写", width: "140",
      hidden: false, showInColumnPicker: true,
      dataProvider: item => this.display(item)
    });
    if (!this.column) throw new Error("CS 缩写列注册失败，请查看 Zotero 错误日志。");
    const command = (label, fn) => ({menuType: "menuitem", l10nID: label,
      onCommand: (event, context) => {
        const win = event.target.ownerGlobal || Zotero.getMainWindow();
        this.enqueue(() => fn(win, context)).catch(e => this.error(win, e));
      }
    });
    this.menus.push(Zotero.MenuManager.registerMenu({pluginID: id, menuID: "cs-venues-items", target: "main/library/item", menus: [
      command("cs-venues-preview", (win, ctx) => this.preview(win, ctx.items || win.ZoteroPane.getSelectedItems())),
      command("cs-venues-manual", (win, ctx) => this.editManual(win, ctx.items || win.ZoteroPane.getSelectedItems())),
      command("cs-venues-reset", (win, ctx) => this.resetManual(win, ctx.items || win.ZoteroPane.getSelectedItems())),
      command("cs-venues-fill", (win, ctx) => this.fill(win, ctx.items || win.ZoteroPane.getSelectedItems()))
    ]}));
    this.menus.push(Zotero.MenuManager.registerMenu({pluginID: id, menuID: "cs-venues-tools", target: "main/menubar/tools", menus: [{
      menuType: "submenu", l10nID: "cs-venues-menu", menus: [
        command("cs-venues-preview", win => this.preview(win, win.ZoteroPane.getSelectedItems())),
        command("cs-venues-manual", win => this.editManual(win, win.ZoteroPane.getSelectedItems())),
        command("cs-venues-reset", win => this.resetManual(win, win.ZoteroPane.getSelectedItems())),
        command("cs-venues-fill", win => this.fill(win, win.ZoteroPane.getSelectedItems())),
        command("cs-venues-library", async win => {
          const items = await Zotero.Items.getAll(Zotero.Libraries.userLibraryID, true, false);
          await this.fill(win, items);
        }),
        command("cs-venues-toggle", win => {
          const enabled = !Zotero.Prefs.get("csvenues.auto");
          Zotero.Prefs.set("csvenues.auto", enabled);
          this.alert(win, enabled ? "已开启：新增或修改会议、期刊条目后自动补全空白缩写。" : "已暂停自动填充。仍可手动填充，CS 缩写列仍可显示识别结果。");
        }),
        command("cs-venues-help", win => this.alert(win,
          `离线词库：${CSMatcher.count} 个会议/期刊。\n自动填充：${Zotero.Prefs.get("csvenues.auto") ? "开启" : "关闭"}\n\n表头右键可打开「CS 缩写」列，安装后即可显示识别结果。\n手工修改：选中一篇后右键 → CS：手工设置 / 修改缩写。留空可恢复自动识别。\n已有条目：选中后右键 → CS：填充所选空白缩写。\n会议写入 Extra 的 shortConferenceName，兼容 Linter。\n期刊只补全空白的期刊缩写，保留已有内容。\nCS 列显示简称与年份（如 ACL 2026），仅 arXiv 的文献显示 arXiv 与年份。期刊缩写字段使用常见书目缩写。\n不改论文标题、会议全称、类型或已有缩写；不把 arXiv 预印本猜成已发表论文。\n手动批量填充后可用编辑 → 撤销。\n若 Linter 随后清空会议缩写，请关闭 Linter 的会议缩写规则，避免两套规则竞争。`))
      ]
    }]}));
    this.observer = Zotero.Notifier.registerObserver({notify: (event, type, ids) => {
      if (!this.active || !Zotero.Prefs.get("csvenues.auto") || type !== "item" || !["add", "modify"].includes(event)) return;
      for (const itemID of ids) {
        const key = Number(itemID);
        const item = Zotero.Items.get(key);
        if (!item || this.writing.has(key)) continue;
        const signature = this.signature(item);
        // Do not refill after undo or compete with another plugin changing Extra.
        if (this.seen.get(key) === signature) continue;
        this.pending.add(key);
      }
      if (!this.pending.size) return;
      this.schedule();
    }}, ["item"], "cs-venues");
  },
  enqueue(fn) {
    const work = this.tail.then(() => this.active ? fn() : undefined);
    this.tail = work.catch(e => Zotero.logError(e));
    return work;
  },
  schedule() {
    if (this.timer) this.timer.cancel();
    this.timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
    this.timer.initWithCallback(() => {
      this.timer = null;
      const ids = [...this.pending]; this.pending.clear();
      this.enqueue(async () => {
        if (!Zotero.Prefs.get("csvenues.auto")) return;
        const items = await Zotero.Items.getAsync(ids);
        await this.apply(items.filter(Boolean), false);
      });
    }, 1500, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
  },
  eligible(item) {
    return this.editable(item) && item.itemType !== "preprint";
  },
  editable(item) {
    return item && !item.deleted && ["conferencePaper", "journalArticle", "preprint"].includes(item.itemType)
      && Zotero.Libraries.get(item.libraryID)?.editable;
  },
  manualItem(win, items) {
    if (items.length !== 1 || !this.editable(items[0])) {
      this.alert(win, "请只选中一篇可编辑的会议论文、期刊文章或预印本。");
      return null;
    }
    return items[0];
  },
  async saveManual(item, value) {
    const before = item.getField("extra") || "";
    const after = CSMatcher.setManual(before, value);
    if (before === after) return false;
    this.writing.add(item.id);
    this.seen.set(item.id, this.signature(item));
    try {
      item.setField("extra", after);
      await item.saveTx({undoAction: "cs-venues-undo-manual"});
    } catch (e) {
      item.setField("extra", before);
      throw e;
    } finally { this.writing.delete(item.id); }
    return true;
  },
  async editManual(win, items) {
    const item = this.manualItem(win, items);
    if (!item) return;
    const data = this.read(item);
    const input = {value: CSMatcher.manualValue(data.extra) || CSMatcher.match(data)?.short
      || (data.itemType === "conferencePaper" ? CSMatcher.extraValue(data.extra) : data.journalAbbreviation)
      || (CSMatcher.isArxiv(data) ? "arXiv" : "")};
    const accepted = Services.prompt.prompt(win, "手工设置 CS 缩写",
      `${item.getField("title").slice(0, 100)}\n\n输入简称（如 ACL、Findings of ACL、arXiv），年份会自动追加；也可输入完整显示文字，如 ACL 2026。\n仅设置「CS 缩写」列，优先于自动识别；不修改引用字段。\n留空并确定可恢复自动识别。`, input, null, {value: false});
    if (!accepted) return;
    await this.saveManual(item, input.value);
  },
  async resetManual(win, items) {
    const item = this.manualItem(win, items);
    if (!item) return;
    const changed = await this.saveManual(item, "");
    this.alert(win, changed ? "已恢复自动识别。可通过编辑 → 撤销恢复手工设置。" : "这篇文献当前没有手工设置，已使用自动识别。");
  },
  alert(win, message) { Services.prompt.alert(win, "CS Venue Abbreviations", message); },
  error(win, e) { Zotero.logError(e); this.alert(win, "处理失败：" + (e.message || String(e))); },
  preview(win, items) {
    const lines = [];
    for (const item of items.filter(i => this.editable(i))) {
      if (item.itemType === "preprint") {
        const manual = CSMatcher.manualValue(item.getField("extra"));
        lines.push(`${item.getField("title").slice(0, 65)}\n  ${this.display(item) || "未识别预印本"}；${manual ? "手工设置优先" : "仅用于显示，不写入会议或期刊缩写"}`);
        continue;
      }
      const plan = CSMatcher.plan(this.read(item));
      lines.push(`${item.getField("title").slice(0, 65)}\n  ${plan.hit ? this.display(item) : plan.reason}${plan.status === "preserved" ? "；已有缩写将保留" : plan.status === "fill" ? "；可填充（保存的缩写不含年份）" : "；跳过"}${plan.explanation ? "\n  " + plan.explanation : ""}`);
    }
    this.alert(win, lines.length ? `共 ${lines.length} 条，预览前 25 条：\n\n${lines.slice(0, 25).join("\n\n")}` : "请先选中可编辑的会议论文、期刊文章或预印本。");
  },
  async fill(win, items) {
    const result = await this.apply(items, true);
    this.alert(win, `处理完成。\n填充：${result.filled}\n保留已有缩写：${result.preserved}\n未识别：${result.unknown}（其中字段冲突 ${result.conflicts} 条）\n不适用或不可编辑：${result.skipped}\n\n会议缩写可在 Linter「缩写」列查看；会议与期刊简称可在「CS 缩写」列查看。`);
  },
  async apply(items, manual) {
    const result = {filled: 0, preserved: 0, unknown: 0, skipped: 0, conflicts: 0};
    const unique = [...new Map(items.filter(Boolean).map(i => [i.id, i])).values()];
    // One transaction gives manual batches one undo step, including Extra edits.
    await Zotero.DB.executeTransaction(async () => {
      for (const item of unique) {
        if (!this.active) break;
        if (!this.eligible(item)) { result.skipped++; continue; }
        this.seen.set(item.id, this.signature(item));
        const plan = CSMatcher.plan(this.read(item));
        if (plan.status !== "fill") { result[plan.status]++; if (plan.conflict) result.conflicts++; continue; }
        this.writing.add(item.id);
        try {
          item.setField(plan.field, plan.after);
          await item.save();
          result.filled++;
        } catch (e) {
          item.setField(plan.field, plan.before);
          throw e;
        }
      }
      if (manual && result.filled) Zotero.UndoHistory.stageAction("cs-venues-undo");
    }).finally(() => this.writing.clear());
    return result;
  },
  async stop() {
    this.active = false;
    this.timer?.cancel(); this.timer = null;
    this.pending.clear();
    if (this.observer) Zotero.Notifier.unregisterObserver(this.observer);
    await this.tail;
    for (const menu of this.menus) Zotero.MenuManager.unregisterMenu(menu);
    if (this.column) Zotero.ItemTreeManager.unregisterColumn(this.column);
    for (const win of Zotero.getMainWindows()) this.detach(win);
    Zotero.ftl.removeResourceIds(["cs-venues.ftl"]);
  }
};
