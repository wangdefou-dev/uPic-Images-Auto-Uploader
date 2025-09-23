# 故障排除指南

本指南将帮助您快速诊断和解决 uPic Auto Uploader 插件的常见问题。

## 🔍 快速诊断工具

插件内置了强大的诊断功能，建议首先使用这些工具：

### 内置诊断命令
1. **快速测试**: 按 `Cmd/Ctrl + P`，搜索 "Quick test uPic availability"
2. **详细测试**: 搜索 "Detailed test uPic availability"
3. **完整诊断**: 搜索 "Diagnose uPic configuration"

### 手动检查步骤
```bash
# 检查 uPic 是否安装
which upic
upic --version

# 检查 uPic 应用
ls -la /Applications/uPic.app/Contents/MacOS/uPic

# 测试 uPic 命令行
/Applications/uPic.app/Contents/MacOS/uPic --help
```

## ❌ 常见问题解决方案

### 问题 1: "uPic is not available"

**症状**: 插件显示 uPic 不可用，无法上传图片

**可能原因**:
- uPic 未安装或安装不完整
- uPic 路径配置错误
- uPic 没有执行权限

**解决步骤**:

1. **验证 uPic 安装**
   ```bash
   # 检查 uPic 是否存在
   ls -la /Applications/uPic.app
   
   # 检查命令行工具
   which upic
   ```

2. **重新安装 uPic**（如果未安装）
   ```bash
   # 使用 Homebrew
   brew install --cask upic
   
   # 或从官网下载
   # https://blog.svend.cc/upic/
   ```

3. **修复路径配置**
   - 打开插件设置
   - 设置正确的 uPic 路径：
     - macOS: `/Applications/uPic.app/Contents/MacOS/uPic`
     - Windows: `C:\Program Files\uPic\uPic.exe`
     - Linux: `/usr/bin/upic`

4. **修复权限问题**
   ```bash
   # 给 uPic 添加执行权限
   chmod +x /Applications/uPic.app/Contents/MacOS/uPic
   ```

### 问题 2: "Configuration: Incomplete"

**症状**: 插件提示配置不完整

**可能原因**:
- uPic 应用中未配置图床服务
- 图床配置信息不正确
- 插件设置未正确保存

**解决步骤**:

1. **配置 uPic 图床服务**
   - 打开 uPic 应用
   - 点击菜单栏中的 uPic 图标
   - 选择"偏好设置"
   - 配置至少一个图床服务（七牛云、阿里云 OSS、GitHub 等）

2. **测试 uPic 配置**
   - 在 uPic 中手动上传一张图片
   - 确保上传成功并获得有效链接

3. **检查插件设置**
   - 确保所有必要字段都已填写
   - 点击"保存设置"按钮
   - 重启 Obsidian

### 问题 3: 上传失败或超时

**症状**: 图片上传过程中失败或长时间无响应

**可能原因**:
- 网络连接问题
- 图床服务配置错误
- 文件格式不支持
- 文件大小超限
- 上传超时时间设置过短

**解决步骤**:

1. **检查网络连接**
   ```bash
   # 测试网络连接
   ping google.com
   curl -I https://httpbin.org/get
   ```

2. **验证图床配置**
   - 检查 API 密钥是否正确
   - 确认存储桶/仓库设置
   - 验证域名配置

3. **检查文件要求**
   - **支持格式**: PNG, JPG, JPEG, GIF, BMP, WebP
   - **文件大小**: 根据图床服务限制
   - **文件名**: 避免特殊字符

4. **调整超时设置**
   - 在插件设置中增加上传超时时间
   - 建议设置为 60-120 秒

### 问题 4: 插件无法加载

**症状**: 插件在 Obsidian 中无法启用或加载失败

**解决步骤**:

1. **检查安装**
   - 确认插件文件夹名称：`obsidian-upic-auto-uploader`
   - 确认包含必要文件：`main.js`, `manifest.json`, `styles.css`
   - 检查 Obsidian 版本 ≥ 0.15.0

2. **查看错误日志**
   - 打开开发者工具（`Cmd/Ctrl + Shift + I`）
   - 查看 Console 标签页的错误信息
   - 记录具体错误消息

3. **重新安装插件**
   - 禁用插件
   - 删除插件文件夹
   - 重新下载并安装
   - 重启 Obsidian

### 问题 5: 自动上传不工作

**症状**: 粘贴图片时不会自动上传

**解决步骤**:

1. **检查设置**
   - 确认"自动上传"选项已开启
   - 检查 uPic 路径配置
   - 验证图床服务配置

2. **测试手动上传**
   - 使用快捷键 `Cmd/Ctrl + Shift + U`
   - 或通过命令面板手动上传

3. **检查文件类型**
   - 确认粘贴的是支持的图片格式
   - 检查剪贴板内容是否为图片

## 🛠️ 高级故障排除

### 调试模式

1. **启用详细日志**
   - 打开开发者工具（`Cmd/Ctrl + Shift + I`）
   - 切换到 Console 标签
   - 执行插件操作，观察日志输出

2. **手动测试 uPic**
   ```bash
   # 直接使用 uPic 命令行上传
   /Applications/uPic.app/Contents/MacOS/uPic /path/to/test/image.png
   ```

### 重置配置

如果问题持续存在，可以尝试重置插件配置：

1. **备份当前配置**
   - 在插件设置中导出配置

2. **重置插件**
   - 关闭 Obsidian
   - 删除插件数据文件：`.obsidian/plugins/obsidian-upic-auto-uploader/data.json`
   - 重启 Obsidian
   - 重新配置插件

### 系统环境检查

```bash
# 检查系统信息
uname -a

# 检查 Node.js 版本（如果相关）
node --version
npm --version

# 检查权限
ls -la ~/.config/obsidian/plugins/
ls -la /Applications/uPic.app/Contents/MacOS/
```

## 📋 问题报告清单

如果问题仍然无法解决，请收集以下信息并提交 Issue：

### 系统信息
- [ ] 操作系统版本
- [ ] Obsidian 版本
- [ ] 插件版本
- [ ] uPic 版本

### 配置信息
- [ ] uPic 路径设置
- [ ] 图床服务类型
- [ ] 插件设置截图

### 错误信息
- [ ] 具体错误消息
- [ ] 控制台日志
- [ ] 诊断报告结果

### 复现步骤
- [ ] 详细的操作步骤
- [ ] 预期结果
- [ ] 实际结果

## 📞 获取帮助

1. **查看文档**: [README](./README.md) | [安装指南](./INSTALLATION.md)
2. **搜索已知问题**: [GitHub Issues](https://github.com/your-username/obsidian-upic-auto-uploader/issues)
3. **提交新问题**: [创建 Issue](https://github.com/your-username/obsidian-upic-auto-uploader/issues/new)
4. **社区讨论**: [GitHub Discussions](https://github.com/your-username/obsidian-upic-auto-uploader/discussions)

## 📚 相关资源

- [uPic 官方文档](https://blog.svend.cc/upic/)
- [uPic GitHub 仓库](https://github.com/gee1k/uPic)
- [Obsidian 插件开发文档](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [Obsidian 社区论坛](https://forum.obsidian.md/)

---

**提示**: 定期更新 uPic 和插件到最新版本可以避免很多已知问题。大多数问题都可以通过正确的配置和基本的故障排除步骤解决。