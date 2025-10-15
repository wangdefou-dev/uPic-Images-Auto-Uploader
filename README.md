# Obsidian uPic 自动上传插件

<div align="center">

![Obsidian Plugin](https://img.shields.io/badge/Obsidian-Plugin-purple?style=for-the-badge&logo=obsidian)
![Version](https://img.shields.io/badge/Version-1.0.0-blue?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**一个为 Obsidian 设计的智能图片上传插件，通过集成 uPic 实现图片的自动上传和链接替换**

[安装指南](#安装指南) • [功能特性](#功能特性) • [使用方法](#使用方法) • [故障排除](#故障排除) • [开发文档](#开发文档)

</div>

## ✨ 功能特性

### 🚀 核心功能
- **自动上传**: 粘贴图片时自动上传到图床，无需手动操作
- **拖拽上传**: 支持拖拽图片文件到编辑器自动上传
- **剪贴板支持**: 直接粘贴剪贴板中的图片并自动上传

### ⌨️ 便捷操作
- **丰富快捷键**: 提供多种快捷键组合，提高工作效率
- **命令面板**: 完整的命令面板支持，快速访问所有功能
- **右键菜单**: 便捷的右键菜单操作

### 🔧 智能管理
- **灵活配置**: 可配置 uPic 路径、上传超时、支持格式等
- **状态监控**: 实时检查 uPic 状态和插件配置
- **诊断工具**: 内置强大的诊断和故障排除工具
- **安全保护**: 智能文件管理，保护用户原始文件

## 📦 安装指南

### 前置要求

1. **Obsidian**: 版本 0.15.0 或更高
2. **uPic 应用**: 需要先安装 [uPic](https://github.com/gee1k/uPic) 图床工具

### uPic 安装

#### 方法 1: 官网下载（推荐）
1. 访问 [uPic 官网](https://blog.svend.cc/upic/) 下载最新版本
2. 将 uPic 拖拽到 Applications 文件夹
3. 启动 uPic 并配置至少一个图床服务

#### 方法 2: Homebrew 安装
```bash
brew install --cask upic
```

### 插件安装

#### 手动安装
1. 下载最新的 Release 文件
2. 解压到 `{vault}/.obsidian/plugins/obsidian-upic-auto-uploader/` 目录
3. 在 Obsidian 设置中启用插件

#### 开发安装
```bash
# 克隆仓库
git clone https://github.com/your-username/obsidian-upic-auto-uploader.git
cd obsidian-upic-auto-uploader

# 安装依赖并构建
npm install
npm run build

# 复制到插件目录
cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/obsidian-upic-auto-uploader/
```

## ⚙️ 配置设置

### 基本设置
- **uPic 路径**: 默认 `/Applications/uPic.app/Contents/MacOS/uPic`
- **自动上传**: 开启后粘贴图片时自动上传
- **显示通知**: 上传成功/失败的通知提示

### 上传设置
- **上传超时**: 上传操作的超时时间（默认 30 秒）
- **支持格式**: PNG, JPG, JPEG, GIF, BMP, WebP
- **文件管理**: 上传成功后的本地文件处理策略

### 高级功能
- **配置导入/导出**: 支持配置的备份和迁移
- **诊断工具**: 内置的系统诊断和测试功能
- **调试模式**: 详细的日志输出和错误追踪

## 🎯 使用方法

### 自动上传模式
1. 在插件设置中开启「自动上传」
2. 确保 uPic 路径配置正确
3. 在编辑器中粘贴或拖拽图片，插件自动处理上传

### 快捷键操作
| 快捷键 | 功能 |
|--------|------|
| `Cmd/Ctrl + Shift + U` | 上传选中的图片链接 |
| `Cmd/Ctrl + Shift + V` | 上传剪贴板中的图片 |
| `Cmd/Ctrl + Shift + Alt + U` | 批量上传当前文档中的所有本地图片 |
| `Cmd/Ctrl + Shift + T` | 切换自动上传功能 |

### 命令面板
打开命令面板（`Cmd/Ctrl + P`），搜索以下命令：
- `Upload selected image via uPic`: 上传选中的图片
- `Upload clipboard image via uPic`: 上传剪贴板图片
- `Toggle auto upload`: 切换自动上传
- `Quick test uPic availability`: 快速测试 uPic 可用性
- `Detailed test uPic availability`: 详细测试 uPic 可用性
- `Diagnose uPic configuration`: 生成完整诊断报告

## 🔍 故障排除

### 快速诊断
插件提供了强大的内置诊断工具：

1. **快速测试**: 执行 "Quick test uPic availability" 命令
2. **详细测试**: 执行 "Detailed test uPic availability" 命令
3. **完整诊断**: 执行 "Diagnose uPic configuration" 命令

### 常见问题

#### ❌ "uPic is not available"
**解决方案**:
1. 检查 uPic 是否已安装：`which upic` 或 `upic --version`
2. 验证插件中的 uPic 路径配置
3. 确保 uPic 有执行权限：`chmod +x /Applications/uPic.app/Contents/MacOS/uPic`

#### ❌ "Configuration: Incomplete"
**解决方案**:
1. 打开 uPic 应用，确保已配置至少一个图床服务
2. 在 uPic 中测试上传功能是否正常
3. 检查插件设置是否完整保存

#### ❌ 上传失败或超时
**解决方案**:
1. 检查网络连接状态
2. 验证图床服务配置（API 密钥等）
3. 确认文件格式和大小是否符合要求
4. 适当增加上传超时时间

### 调试模式
1. 打开开发者工具（`Cmd/Ctrl + Shift + I`）
2. 查看控制台的详细日志输出
3. 使用内置诊断命令获取系统状态报告

## 🛠️ 开发文档

### 项目结构
```
├── main.ts                 # 主插件文件
├── manifest.json          # 插件清单
├── src/
│   ├── types.ts           # 类型定义
│   ├── upic-uploader.ts   # uPic 集成模块
│   ├── settings-manager.ts # 设置管理器
│   ├── settings-tab.ts    # 设置界面
│   └── commands.ts        # 命令管理器
├── package.json           # 项目配置
├── tsconfig.json          # TypeScript 配置
└── esbuild.config.mjs     # 构建配置
```

### 构建命令
```bash
# 开发模式（监听文件变化）
npm run dev

# 生产构建
npm run build

# 版本更新
npm run version
```

### 核心 API
- `UPicUploader`: uPic 集成类，处理文件上传
- `SettingsManager`: 设置管理类，处理配置的加载和保存
- `CommandManager`: 命令管理类，注册和处理各种命令

### 技术特性
- **安全文件管理**: 智能识别文件来源，保护用户原始文件
- **链接替换机制**: 先插入本地链接，上传成功后自动替换为在线链接
- **错误恢复**: 完善的错误处理和状态恢复机制
- **性能优化**: 异步处理，不阻塞用户操作

## 🔄 更新日志

### v1.0.0 - 2024年9月
- 🎉 **初始版本发布**
- ✨ **核心功能**: 自动上传、拖拽上传、批量上传
- ✨ **用户体验**: 丰富的快捷键和命令支持
- ✨ **智能管理**: 完整的设置界面和状态监控
- ✨ **故障排除**: 内置诊断工具和详细的故障排除指南
- 🔧 **安全保护**: 修复文件删除逻辑，保护用户原始文件
- 🔧 **链接替换**: 优化图片链接替换机制

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [uPic](https://github.com/gee1k/uPic) - 优秀的图床工具
- [Obsidian](https://obsidian.md/) - 强大的知识管理工具
- Obsidian 插件开发社区的支持和贡献

---

<div align="center">

**如果这个插件对你有帮助，请给个 ⭐️ 支持一下！**

[报告问题](https://github.com/your-username/obsidian-upic-auto-uploader/issues) • [功能建议](https://github.com/your-username/obsidian-upic-auto-uploader/discussions) • [贡献代码](https://github.com/your-username/obsidian-upic-auto-uploader/pulls)

</div>