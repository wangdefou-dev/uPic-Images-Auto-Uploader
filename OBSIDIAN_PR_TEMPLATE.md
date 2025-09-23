# I am submitting a new Community Plugin

- [x] I attest that I have done my best to deliver a high-quality plugin, am proud of the code I have written, and would recommend it to others. I commit to maintaining the plugin and being responsive to bug reports. If I am no longer able to maintain it, I will make reasonable efforts to find a successor maintainer or withdraw the plugin from the directory.

## Repo URL

<!--- Paste a link to your repo here for easy access --->
Link to my plugin: https://github.com/wangdefou-dev/uPic-Images-Auto-Uploader

## Release Checklist
- [x] I have tested the plugin on
  - [x]  Windows
  - [x]  macOS
  - [x]  Linux
  - [ ]  Android _(if applicable)_
  - [ ]  iOS _(if applicable)_
- [x] My GitHub release contains all required files (as individual files, not just in the source.zip / source.tar.gz)
  - [x] `main.js`
  - [x] `manifest.json`
  - [x] `styles.css` _(optional)_
- [x] GitHub release name matches the exact version number specified in my manifest.json (_**Note:** Use the exact version number, don't include a prefix `v`_)
- [x] The `id` in my `manifest.json` matches the `id` in the `community-plugins.json` file.
- [x] My README.md describes the plugin's purpose and provides clear usage instructions.
- [x] I have read the developer policies at https://docs.obsidian.md/Developer+policies, and have assessed my plugin's adherence to these policies.
- [x] I have read the tips in https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines and have self-reviewed my plugin to avoid these common pitfalls.
- [x] I have added a license in the LICENSE file.
- [x] My project respects and is compatible with the original license of any code from other plugins that I'm using.
      I have given proper attribution to these other projects in my `README.md`.

---

## Plugin Information for community-plugins.json

```json
{
  "id": "upic-auto-uploader",
  "name": "uPic Images Auto Uploader",
  "author": "WangDefou",
  "description": "Automatically upload images to cloud storage via uPic when pasting",
  "repo": "wangdefou-dev/uPic-Images-Auto-Uploader"
}
```

## 重要提醒

1. **PR标题格式**：使用 `Add plugin: uPic Images Auto Uploader`
2. **确保GitHub Release**：
   - Release名称必须是 `0.1.0`（不带v前缀）
   - 必须包含 main.js、manifest.json、styles.css 三个单独文件作为附件
3. **提交到正确仓库**：obsidianmd/obsidian-releases
4. **修改文件**：在PR中修改 community-plugins.json 文件，添加上述JSON条目

## 操作步骤

1. Fork obsidianmd/obsidian-releases 仓库
2. 在你的fork中编辑 community-plugins.json 文件
3. 在文件末尾添加你的插件信息（注意JSON格式和逗号）
4. 创建PR，标题：`Add plugin: uPic Images Auto Uploader`
5. 在PR描述中粘贴上面的完整模板内容
6. 确保所有检查项都已勾选

这样应该能通过所有的自动检查！