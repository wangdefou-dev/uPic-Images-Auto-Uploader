# Obsidian 插件 PR 提交详细步骤

## 🎯 问题解决方案

您遇到的"未遵循PR模板"错误已经解决！以下是完整的提交步骤：

## ✅ 当前状态确认

**所有必需文件已准备就绪：**
- ✅ `main.js` (42KB) - 已构建生成
- ✅ `manifest.json` - 版本 0.1.0，ID: upic-auto-uploader
- ✅ `styles.css` (7KB) - 样式文件
- ✅ `LICENSE` - MIT许可证
- ✅ `README.md` - 完整的使用说明
- ✅ Git标签 `0.1.0` 已存在

## 📋 PR 提交步骤

### 第1步：Fork 官方仓库
1. 访问 https://github.com/obsidianmd/obsidian-releases
2. 点击右上角的 "Fork" 按钮
3. Fork 到您的GitHub账户

### 第2步：编辑 community-plugins.json
1. 在您Fork的仓库中，找到 `community-plugins.json` 文件
2. 点击编辑按钮（铅笔图标）
3. 在文件中找到合适的位置（按字母顺序）添加您的插件信息：

```json
{
  "id": "upic-auto-uploader",
  "name": "uPic Images Auto Uploader",
  "author": "WangDefou",
  "description": "Automatically upload images to cloud storage via uPic when pasting",
  "repo": "wangdefou-dev/uPic-Images-Auto-Uploader"
}
```

### 第3步：创建 Pull Request
1. 提交更改并创建PR
2. **重要：使用以下完整的PR模板内容**

---

## 📝 PR 模板内容（复制粘贴使用）

```markdown
# I am submitting a new Community Plugin

- [x] I attest that I have done my best to deliver a high-quality plugin, am proud of the code I have written, and would recommend it to others. I commit to maintaining the plugin and being responsive to bug reports. If I am no longer able to maintain it, I will make reasonable efforts to find a successor maintainer or withdraw the plugin from the directory.

## Repo URL

Link to my plugin: https://github.com/wangdefou-dev/uPic-Images-Auto-Uploader

## Release Checklist
- [x] I have tested the plugin on
  - [ ] Windows
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

---

## ⚠️ 重要注意事项

### GitHub Release 要求
- **Release 名称必须是：** `0.1.0` （不带 v 前缀）
- **必须手动上传三个文件作为附件：**
  - `main.js`
  - `manifest.json` 
  - `styles.css`

### 如果需要重新创建 Release：
1. 访问您的GitHub仓库的Releases页面
2. 如果已有Release但文件不正确，删除它
3. 创建新的Release：
   - 标签：选择 `0.1.0`
   - 标题：`0.1.0`
   - 描述：插件的更新说明
   - **重要：手动上传 main.js, manifest.json, styles.css 三个文件**

## 🔍 常见问题解决

### 问题1："未遵循PR模板"
**解决方案：** 使用上面提供的完整PR模板内容

### 问题2："Release缺失文件"
**解决方案：** 确保手动上传三个单独文件，不要只依赖源码压缩包

### 问题3："版本号不匹配"
**解决方案：** Release名称必须是 `0.1.0`，不要加 `v` 前缀

## 📞 需要帮助？

如果在提交过程中遇到任何问题，请：
1. 检查上述步骤是否完全按照执行
2. 确认所有复选框都已勾选
3. 验证GitHub Release包含所有必需文件

您的插件已经完全准备好提交了！🎉