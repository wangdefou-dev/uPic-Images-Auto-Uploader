# Obsidian Plugin PR Submission Guide

## PR Template Checklist

根据官方PR模板，您需要在GitHub PR中填写以下内容：

### 1. 基本信息
```markdown
# I am submitting a new Community Plugin

- [x] I attest that I have done my best to deliver a high-quality plugin, am proud of the code I have written, and would recommend it to others. I commit to maintaining the plugin and being responsive to bug reports. If I am no longer able to maintain it, I will make reasonable efforts to find a successor maintainer or withdraw the plugin from the directory.

## Repo URL
Link to my plugin: https://github.com/wangdefou-dev/uPic-Images-Auto-Uploader
```

### 2. Release Checklist
```markdown
## Release Checklist
- [x] I have tested the plugin on
  - [x] Windows
  - [x] macOS
  - [ ] Linux
  - [ ] Android _(if applicable)_
  - [ ] iOS _(if applicable)_
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
```

## 重要提醒

### 插件ID确认
- 您的manifest.json中的ID是: `upic-auto-uploader`
- 在PR中需要将此ID添加到community-plugins.json文件中

### GitHub Release要求
- ✅ Release名称必须是: `0.1.0` (不带v前缀)
- ✅ 必须包含三个单独文件: main.js, manifest.json, styles.css
- ✅ 不能只依赖源码压缩包

### PR提交步骤
1. Fork obsidianmd/obsidian-releases 仓库
2. 编辑 community-plugins.json 文件
3. 在适当位置添加您的插件信息:
```json
{
  "id": "upic-auto-uploader",
  "name": "uPic Images Auto Uploader",
  "author": "WangDefou",
  "description": "Automatically upload images to cloud storage via uPic when pasting",
  "repo": "wangdefou-dev/uPic-Images-Auto-Uploader"
}
```
4. 创建PR并使用上述模板内容
5. 确保所有复选框都已正确勾选

### 常见错误避免
- ❌ 不要在Release名称前加"v"前缀
- ❌ 不要忘记上传单独的文件作为Release附件
- ❌ 不要在PR中遗漏任何必需的复选框
- ❌ 确保插件ID在community-plugins.json中是唯一的

## 当前状态检查

✅ main.js 文件已生成
✅ manifest.json 配置正确
✅ styles.css 文件存在
✅ README.md 内容完整
✅ LICENSE 文件存在
✅ 版本号为 0.1.0

您的插件已准备好提交！请按照上述指南创建PR。