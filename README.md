# CS Venue Abbreviations for Zotero

[中文](#中文) · [English](#english) · [Download / 下载](https://github.com/lzy248/zotero-cs-venues/releases/latest)

## 中文

为 **Zotero 10.0.x** 提供离线 CS 会议、期刊与 arXiv 识别，列表显示为 `ACL 2026`、`TKDE 2025`、`arXiv 2024`。内置 132 个会议、70 个期刊及常用别名，无需 API Key。

### 安装与使用

1. 从 [Releases](https://github.com/lzy248/zotero-cs-venues/releases/latest) 下载最新 `.xpi` 文件，在 Zotero **工具 → 插件 → 从文件安装插件**中安装。
2. 文献列表表头右键，勾选 **CS 缩写**；现有条目即可显示识别结果。
3. 保存缩写：选中文献，右键 **CS：填充所选空白缩写**。新增或修改条目默认自动补全；开关位于 **工具 → CS 会议与期刊缩写**。

### 手工设置

选中一篇文献，右键 **CS：手工设置 / 修改缩写**。输入 `ACL` 会自动追加年份；输入 `ACL 2026` 则按指定文字显示。手工值优先于自动识别，保存在 Extra 的 `csVenueOverride` 字段中。留空或选择 **CS：恢复自动识别**即可清除。修改支持 Zotero 撤销。

### 字段与规则

- **会议论文**：读取“会议名称”和“会议论文集标题”；缩写保存到 Extra 的 `shortConferenceName`，兼容 Linter。
- **期刊文章**：读取“出版物”；只补全空白“期刊缩写”。CS 列显示常用简称，引用字段保留书目缩写。
- **arXiv**：根据存储库、标识符、DOI 或链接识别，仅影响列显示，不改条目类型。
- **年份**：优先读取日期；会议日期缺失时从名称提取唯一年份。年份仅用于显示，不写入缩写字段。
- **冲突**：区分主会、Findings、Workshop 等。支持根据明确的 ACL Findings DOI 判定，否则显示冲突并跳过；可手工指定显示值。
- 自动处理保留已有缩写，手工设置仅控制 CS 列。若 Linter 重写会议缩写，关闭其会议缩写规则即可。最终引用格式由 CSL 样式决定。

## English

Offline CS venue recognition for **Zotero 10.0.x**, displaying labels such as `ACL 2026`, `TKDE 2025`, and `arXiv 2024`. Includes 132 conferences and 70 journals with common aliases. No API key required.

### Install and use

1. Download the latest `.xpi` from [Releases](https://github.com/lzy248/zotero-cs-venues/releases/latest) and install it through **Tools → Plugins → Install Add-on From File** in Zotero.
2. Right-click the item-list header and enable **CS 缩写** (CS abbreviation). Existing items are recognized immediately.
3. To save missing abbreviations, select items and choose **CS: Fill missing abbreviations**. New or modified items are processed automatically; toggle this under **Tools → CS Venue Abbreviations**.

### Manual editing

Select one item and choose **CS: Set or edit abbreviation**. Enter `ACL` to append the year automatically, or `ACL 2026` for an explicit label. Manual labels override recognition and are stored as `csVenueOverride` in Extra. Clear the input or choose **CS: Restore automatic recognition** to reset. Changes support Zotero undo.

### Fields and behavior

- **Conference papers:** read Conference Name and Proceedings Title; write missing abbreviations to `shortConferenceName` in Extra, compatible with Linter.
- **Journal articles:** read Publication; fill only an empty Journal Abbr field. The CS column uses common acronyms while the citation field uses bibliographic abbreviations.
- **arXiv:** recognize the repository, identifier, DOI, or URL; display only, without changing item types.
- **Years:** prefer Date, falling back to a unique year in conference metadata. Years are displayed, not stored in abbreviation fields.
- **Conflicts:** distinguish main proceedings, Findings, and workshops. Explicit ACL Findings DOIs can resolve conflicts; unresolved cases are marked and skipped. Manual labels take priority.
- Existing abbreviations are preserved. Manual labels affect only the CS column. If Linter rewrites conference abbreviations, disable its conference-abbreviation rule. Citation output remains controlled by the CSL style.

## 自定义词库与构建

**环境：** Node.js 22+；Windows 自带 PowerShell 即可打包，其他系统可使用 PowerShell 7（`pwsh`）。没有 npm 依赖需要安装。

1. 下载源码：在 GitHub 点击 **Code → Download ZIP** 并解压，或执行：

   ```sh
   git clone https://github.com/lzy248/zotero-cs-venues.git
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

   PowerShell 7 用户可执行 `pwsh -File build.ps1`。输出文件在项目根目录，命名为 **`cs-venues-<version>.xpi`**，版本号来自 `manifest.json`。迭代自定义版时请递增版本号。

5. 在 Zotero 的插件管理器中安装生成的 XPI，替换原插件；如列表未刷新，重启 Zotero。词库修改必须重新构建安装，不会在运行时读取源码目录。自定义版建议在插件管理器中关闭该插件自动更新，以免被官方包覆盖。

也可 Fork 仓库，修改配置并推送；GitHub Actions 的 **Test and package** 工作流通过后，可在该次运行的 **Artifacts → zotero-cs-venues** 下载构建包。

## Customize and build

**Requirements:** Node.js 22+ and PowerShell (Windows PowerShell or cross-platform PowerShell 7). No npm dependencies.

1. Download and extract **Code → Download ZIP**, or run `git clone https://github.com/lzy248/zotero-cs-venues.git` and `cd zotero-cs-venues`.
2. Edit **`venues.json`** using the example above. Add entries to the existing configuration. Under `conferences`, each key is a display abbreviation and its array contains full names and aliases. Under `journals`, each key is a display acronym, `abbreviation` is the bibliographic abbreviation, and `aliases` contains recognized names. JSON requires double quotes and no comments or trailing commas.
3. Run **`node tests.mjs`** from the project directory. Fix reported errors before packaging. If you deliberately rename an existing abbreviation, update the corresponding fixed test expectations too.
4. Run **`powershell -ExecutionPolicy Bypass -File build.ps1`**, or **`pwsh -File build.ps1`** with PowerShell 7. The output is **`cs-venues-<version>.xpi`** in the project root. The version comes from `manifest.json`; increment it for subsequent custom builds.
5. Install the generated XPI in Zotero's plugin manager to replace the previous version. Restart Zotero if needed. Configuration edits require rebuilding and reinstalling; there is no runtime configuration import. Disable automatic updates for your custom build to prevent replacement by an upstream release.

Alternatively, fork this repository and push your changes. After **Test and package** succeeds in GitHub Actions, download **Artifacts → zotero-cs-venues** from that workflow run.

Tests cover recognition, configuration validation, and mocked Zotero APIs; they do not replace testing the installed plugin in Zotero.

**License / 许可证:** [MIT](LICENSE).
