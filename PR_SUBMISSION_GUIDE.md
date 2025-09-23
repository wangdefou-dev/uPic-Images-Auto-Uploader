# Obsidian插件提交指南

## 🚨 关键问题解决方案

你收到"未遵循PR模板"错误的原因可能是：

### 1. PR标题格式错误
**正确格式**：`Add plugin: uPic Images Auto Uploader`

### 2. PR描述不完整
你需要在PR描述中包含完整的检查清单和插件信息。

### 3. 提交步骤

#### 步骤1：Fork仓库
1. 访问：https://github.com/obsidianmd/obsidian-releases
2. 点击右上角的 "Fork" 按钮

#### 步骤2：编辑文件
1. 在你的fork中，打开 `community-plugins.json` 文件
2. 找到文件末尾的 `]` 符号
3. 在最后一个插件条目后添加逗号，然后添加：

```json
,
{
  "id": "upic-auto-uploader",
  "name": "uPic Images Auto Uploader",
  "author": "WangDefou",
  "description": "Automatically upload images to cloud storage via uPic when pasting",
  "repo": "wangdefou-dev/uPic-Images-Auto-Uploader"
}
```

#### 步骤3：创建PR
1. 提交更改
2. 创建Pull Request
3. **PR标题**：`Add plugin: uPic Images Auto Uploader`
4. **PR描述**：复制粘贴 `OBSIDIAN_PR_TEMPLATE.md` 中的完整内容

## ✅ 检查清单

在提交PR前，确保：

- [ ] GitHub Release名称是 `0.1.0`（不带v前缀）
- [ ] Release包含 main.js、manifest.json、styles.css 三个单独文件
- [ ] PR标题格式正确：`Add plugin: uPic Images Auto Uploader`
- [ ] PR描述包含完整的检查清单
- [ ] community-plugins.json 格式正确（注意逗号和JSON语法）

## 🔧 常见错误

1. **标题错误**：不要使用 "Submit plugin" 或其他格式
2. **描述不完整**：必须包含所有检查项
3. **JSON格式错误**：注意逗号和引号
4. **Release格式错误**：确保文件是单独上传的，不是压缩包

按照这个指南操作，应该能成功通过所有检查！