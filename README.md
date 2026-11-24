# CS Venue Abbreviations and Title for Zotero

[中文](#中文) · [English](#english) · [构建安装包](#自定义词库与构建)

## 中文

本插件 Fork 自 [zotero-cs-venues](https://github.com/lzy248/zotero-cs-venues)，兼容 **Zotero 10.0.x**。提供 **CS Title** 和 **CS 缩写** 两列，共用内置的 132 个会议、70 个期刊及常用别名，无需 API Key。

### 安装与使用

1. 下载或[构建](#自定义词库与构建) Fork 的 `cs-venues-title-<version>.xpi`，在 Zotero **工具 → 插件 → 从文件安装插件**中安装。Fork 使用独立插件 ID，已有上游插件时可将其停用，避免重复列和菜单。
2. 右键文献列表表头，勾选 **CS Title**。可拖动列头调整位置，拖动列边界调整宽度，点击列头按显示值排序。**CS 缩写**也可在同一菜单中切换。
3. 保存缩写：选中文献，右键 **CS：填充所选空白缩写**。新增或修改条目默认自动补全；开关位于 **工具 → CS 会议与期刊缩写**。

### CS Title 与 arXiv

- `CS Title` 在原始标题前显示 `[YY Venue]`，例如 `[26 ICLR] Understanding Systems`。仅知年份时显示 `[26]`，仅知简称时显示 `[ICLR]`，两者均缺时显示原始标题。两列对已有和新导入条目都可用。
- Title 开头已有可识别的前缀（如 `[26 ICLR]`）时，`CS Title` 只显示一份。显示优先采用当前识别的年份和简称，缺失部分沿用旧前缀。保存的 Title 保留原有内容。
- 新导入的 arXiv 论文优先使用 Extra 或导入时生成的子笔记中的 `Comments` 和 `Journal Reference`。本地信息不足且有 arXiv ID 时，只向 arXiv API 发送该 ID 查询一次。API 请求串行发出，间隔至少三秒。 [arXiv API 手册](https://info.arxiv.org/help/api/user-manual.html) · [限速规则](https://info.arxiv.org/help/api/tou.html#rate-limits)
- `Accepted to ICSE 2027` 显示 `[27 ICSE]`，`Published in IEEE TSE, 2025` 显示 `[25 TSE]`。缺少明确发表年份时使用 Zotero 条目原有年份。仅有投稿或审稿说明、证据不足或请求失败时显示 `arXiv`。
- 查询结果（含回退结果）保存在当前 Zotero 配置中，同一 arXiv ID 可复用。已有条目使用本地字段及已保存结果。自动联网由新增导入触发，与原有会议和期刊缩写自动填充开关独立。
- `CS Title` 和 arXiv 识别只提供列显示内容。Title 和引用字段照常用于 BibTeX 导出与参考文献生成。原有空白缩写填充功能仍可通过原菜单控制。

### 手工设置

选中一篇文献，右键 **CS：手工设置 / 修改缩写**。输入 `ACL` 会使用已知年份。输入 `ACL 2026` 时，**CS 缩写**显示 `ACL 2026`，**CS Title** 使用 `[26 ACL]`。手工值在两列中优先，保存在 Extra 的 `csVenueOverride` 字段中。留空或选择 **CS：恢复自动识别**即可清除。修改支持 Zotero 撤销。

### 字段与规则

- **会议论文**：读取“会议名称”和“会议论文集标题”；缩写保存到 Extra 的 `shortConferenceName`，兼容 Linter。
- **期刊文章**：读取“出版物”；只补全空白“期刊缩写”。CS 列显示常用简称，引用字段保留书目缩写。
- **年份**：会议和期刊优先读取日期。会议日期缺失时从名称提取唯一年份。年份仅用于显示。
- **冲突**：区分主会、Findings、Workshop 等。支持根据明确的 ACL Findings DOI 判定，否则显示冲突并跳过；可手工指定显示值。
- 自动处理保留已有缩写，手工设置仅控制 CS 列。若 Linter 重写会议缩写，关闭其会议缩写规则即可。最终引用格式由 CSL 样式决定。

## English

This fork supports **Zotero 10.0.x** and adds **CS Title** alongside **CS 缩写** (CS abbreviation). Both columns use the built-in catalog of 132 conferences and 70 journals. The arXiv API requires no key.

### Install and use

1. Download or [build](#customize-and-build) the fork's `cs-venues-title-<version>.xpi` and install it through **Tools → Plugins → Install Add-on From File**. The fork has its own plug-in ID. If you have the upstream plug-in, disable it to avoid duplicate columns and menus.
2. Right-click the item-list header to enable **CS Title** and manage **CS 缩写**. Use Zotero's column header to move, resize, and sort by the displayed values.
3. To save missing abbreviations, select items and choose **CS: Fill missing abbreviations**. New or modified items are processed automatically; toggle this under **Tools → CS Venue Abbreviations**.

### CS Title and arXiv

- **CS Title** displays `[YY Venue] Title` for new and existing items. With incomplete data, it shows `[YY] Title`, `[Venue] Title`, or the original title.
- If the stored title already starts with a recognized prefix such as `[26 ICLR]`, **CS Title** displays a single prefix. It uses the current year and venue where available and fills missing parts from the old prefix. The stored Title keeps its original text.
- On a new arXiv import, the plug-in checks labeled Comments and Journal Reference in Extra and imported child notes. If local evidence is insufficient and an arXiv ID is available, it sends the ID to the official API once. Requests run one at a time, at least three seconds apart. [arXiv API manual](https://info.arxiv.org/help/api/user-manual.html) · [Rate limits](https://info.arxiv.org/help/api/tou.html#rate-limits)
- A recognized publication uses its explicit publication year when available. Otherwise, the Zotero item's year is used. Submission and review notices, inconclusive evidence, and request failures fall back to `arXiv`.
- The Zotero profile retains results, including fallbacks, for reuse by arXiv ID. Existing items use local fields and saved results. Lookups are triggered by new imports and operate independently of automatic conference and journal abbreviation filling.
- Both features supply display values. BibTeX exports and bibliographies continue to use the item's Title and citation fields. The existing commands for filling blank abbreviation fields remain available.

### Manual editing

Select one item and choose **CS: Set or edit abbreviation**. Enter `ACL` to use the known year, or enter `ACL 2026` for `ACL 2026` in **CS 缩写** and `[26 ACL]` in **CS Title**. Manual labels take priority in both columns and are stored as `csVenueOverride` in Extra. Clear the input or choose **CS: Restore automatic recognition** to reset. Changes support Zotero undo.

### Fields and behavior

- **Conference papers:** read Conference Name and Proceedings Title; write missing abbreviations to `shortConferenceName` in Extra, compatible with Linter.
- **Journal articles:** read Publication; fill only an empty Journal Abbr field. The CS column uses common acronyms while the citation field uses bibliographic abbreviations.
- **Years:** for conference and journal items, prefer Date, falling back to a unique year in the conference metadata. Years appear in the display columns.
- **Conflicts:** distinguish main proceedings, Findings, and workshops. Explicit ACL Findings DOIs can resolve conflicts; unresolved cases are marked and skipped. Manual labels take priority.
- Existing abbreviations are preserved. Manual labels affect only the CS column. If Linter rewrites conference abbreviations, disable its conference-abbreviation rule. Citation output remains controlled by the CSL style.

## 自定义词库与构建

**环境：** Node.js 22+；Windows 自带 PowerShell 即可打包，其他系统可使用 PowerShell 7（`pwsh`）。没有 npm 依赖需要安装。

1. 下载源码：在 GitHub 点击 **Code → Download ZIP** 并解压，或执行：

   ```sh
   git clone https://github.com/flyboss/zotero-cs-venues.git
   cd zotero-cs-venues
   ```

2. 用文本编辑器修改根目录的 **`venues.json`**。下方是配置结构示例，请将新条目加入现有配置，不要用示例覆盖整个词库。

   ```json
   {
     "conferences": {
       "EXCONF": ["Example Conference on Computing", "Example Computing Conference"]
     },
     "journals": {
       "EXJ": {
         "abbreviation": "Ex. J. Comput.",
         "aliases": ["Example Journal of Computing"]
       }
     }
   }
   ```

   会议的键是要显示的缩写，数组填写全称和别名。期刊的键是列表简称，`abbreviation` 是引用字段使用的书目缩写，`aliases` 填全称或别名。缩写本身也能被识别。JSON 需使用双引号，不支持注释或末尾多余逗号。

3. 在项目目录打开终端，先运行测试：

   ```sh
   node tests.mjs
   ```

   成功时输出包含 `passed` 的结果；报错时先修正配置或测试。主动修改已有简称时，相应的固定测试预期也需更新。

4. 构建安装包：

   ```powershell
   powershell -ExecutionPolicy Bypass -File build.ps1
   ```

   PowerShell 7 用户可执行 `pwsh -File build.ps1`。输出文件在项目根目录，命名为 **`cs-venues-title-<version>.xpi`**，版本号来自 `manifest.json`。迭代自定义版时请递增版本号。

5. 在 Zotero 的插件管理器中安装生成的 XPI。词库修改后需要重新构建并安装。Fork 的插件包通过本地安装更新。

也可 Fork 仓库，修改配置并推送；GitHub Actions 的 **Test and package** 工作流通过后，可在该次运行的 **Artifacts → zotero-cs-venues** 下载构建包。

## Customize and build

**Requirements:** Node.js 22+ and PowerShell (Windows PowerShell or cross-platform PowerShell 7). No npm dependencies.

1. Download and extract **Code → Download ZIP**, or run `git clone https://github.com/flyboss/zotero-cs-venues.git` and `cd zotero-cs-venues`.
2. Edit **`venues.json`** using the example above. Add entries to the existing configuration. Under `conferences`, each key is a display abbreviation and its array contains full names and aliases. Under `journals`, each key is a display acronym, `abbreviation` is the bibliographic abbreviation, and `aliases` contains recognized names. JSON requires double quotes and no comments or trailing commas.
3. Run **`node tests.mjs`** from the project directory. Fix reported errors before packaging. If you deliberately rename an existing abbreviation, update the corresponding fixed test expectations too.
4. Run **`powershell -ExecutionPolicy Bypass -File build.ps1`**, or **`pwsh -File build.ps1`** with PowerShell 7. The output is **`cs-venues-title-<version>.xpi`** in the project root. Increment the version in `manifest.json` for subsequent builds.
5. Install the generated XPI in Zotero's plugin manager. Rebuild and reinstall after configuration edits. Update the fork by installing a newer XPI.

Alternatively, fork this repository and push your changes. After **Test and package** succeeds in GitHub Actions, download **Artifacts → zotero-cs-venues** from that workflow run.

Tests cover recognition, title formatting, configuration validation, and mock Zotero and arXiv responses.

**License / 许可证:** [MIT](LICENSE).
