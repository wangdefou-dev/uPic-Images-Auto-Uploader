# 安装指南

本指南将帮助您快速安装和配置 Obsidian uPic 自动上传插件。

## 📋 安装前准备

### 系统要求
- **Obsidian**: 版本 0.15.0 或更高
- **操作系统**: macOS 10.14+ / Windows 10+ / Linux (Ubuntu 18.04+)
- **uPic**: 必须先安装 uPic 图床工具

### uPic 安装

#### macOS 安装

**方法 1: 官网下载（推荐）**
1. 访问 [uPic 官网](https://blog.svend.cc/upic/) 或 [GitHub Releases](https://github.com/gee1k/uPic/releases)
2. 下载最新版本的 `uPic.dmg` 文件
3. 双击 `.dmg` 文件并将 uPic 拖拽到 Applications 文件夹
4. 启动 uPic 并配置至少一个图床服务

**方法 2: Homebrew 安装**
```bash
brew install --cask upic
```

#### 验证 uPic 安装
```bash
# 检查应用是否存在
ls -la /Applications/uPic.app

# 检查命令行工具
/Applications/uPic.app/Contents/MacOS/uPic --help

# 或者使用系统命令
which upic
upic --version
```

## 🔧 插件安装

### 方法 1: 手动安装（推荐）

1. **获取插件文件**
   - 下载最新的 Release 文件
   - 或者从源码构建：
     ```bash
     git clone https://github.com/your-username/obsidian-upic-auto-uploader.git
     cd obsidian-upic-auto-uploader
     npm install
     npm run build
     ```

2. **找到插件目录**
   - 打开 Obsidian → 设置 → 第三方插件 → 已安装插件
   - 点击文件夹图标打开插件目录
   - 或手动导航到：
     - **macOS**: `~/Library/Application Support/obsidian/plugins/`
     - **Windows**: `%APPDATA%\Obsidian\plugins\`
     - **Linux**: `~/.config/obsidian/plugins/`

3. **安装插件**
   - 在插件目录中创建文件夹：`obsidian-upic-auto-uploader`
   - 复制以下文件到该文件夹：
     - `main.js`
     - `manifest.json`
     - `styles.css`

4. **启用插件**
   - 重启 Obsidian
   - 进入设置 → 第三方插件
   - 找到 "uPic Images Auto Uploader" 并启用

### 方法 2: 开发模式安装

适用于开发者或需要实时调试的用户：

```bash
# 创建符号链接到开发目录
# macOS/Linux
ln -s /path/to/your/upic/project ~/.config/obsidian/plugins/obsidian-upic-auto-uploader

# Windows (管理员权限)
mklink /D "%APPDATA%\Obsidian\plugins\obsidian-upic-auto-uploader" "C:\path\to\your\upic\project"
```

## ⚙️ 初始配置

### 1. 配置 uPic
1. 启动 uPic 应用
2. 在菜单栏找到 uPic 图标
3. 点击"偏好设置"
4. 配置你喜欢的图床服务（七牛云、阿里云 OSS、腾讯云 COS、GitHub 等）
5. 测试上传功能确保配置正确

### 2. 配置插件
1. 在 Obsidian 设置中找到 "uPic Images Auto Uploader"
2. 配置 uPic 路径：
   - **macOS**: `/Applications/uPic.app/Contents/MacOS/uPic`
   - **Windows**: `C:\Program Files\uPic\uPic.exe`（根据实际安装路径）
   - **Linux**: `/usr/bin/upic` 或 `/opt/uPic/uPic`
3. 根据需要调整其他设置：
   - 自动上传开关
   - 上传超时时间
   - 文件格式限制
   - 通知设置

## ✅ 安装验证

### 快速测试
1. 在 Obsidian 中按 `Cmd/Ctrl + P` 打开命令面板
2. 搜索并执行 "Quick test uPic availability"
3. 查看测试结果

### 功能测试
1. 在编辑器中粘贴一张图片
2. 观察是否自动上传并替换为在线链接
3. 检查上传状态通知

## 🚨 常见安装问题

### 插件无法加载
**检查清单**:
- [ ] 插件文件夹名称为 `obsidian-upic-auto-uploader`
- [ ] 包含必要文件：`main.js`, `manifest.json`, `styles.css`
- [ ] Obsidian 版本 ≥ 0.15.0
- [ ] 已重启 Obsidian

**调试方法**:
1. 打开开发者工具（`Cmd/Ctrl + Shift + I`）
2. 查看 Console 标签页的错误信息
3. 尝试禁用并重新启用插件

### uPic 路径问题
**自动检测路径**:
```bash
# 查找 uPic 可执行文件
find /usr -name "upic" 2>/dev/null
find /opt -name "upic" 2>/dev/null
find /Applications -name "upic" 2>/dev/null

# 检查常见路径
ls -la /usr/local/bin/upic
ls -la /opt/homebrew/bin/upic
ls -la /Applications/uPic.app/Contents/MacOS/uPic
```

### 权限问题
```bash
# 修复 uPic 执行权限
chmod +x /Applications/uPic.app/Contents/MacOS/uPic

# 检查文件权限
ls -la /Applications/uPic.app/Contents/MacOS/uPic
```

## 🔄 更新插件

1. 下载新版本的插件文件
2. 替换插件目录中的 `main.js` 文件
3. 重启 Obsidian
4. 检查插件设置是否需要更新

## 📞 获取帮助

如果安装过程中遇到问题：

1. **使用诊断工具**: 执行 "Diagnose uPic configuration" 命令
2. **查看日志**: 检查开发者工具中的错误信息
3. **参考文档**: 查看 [故障排除指南](./TROUBLESHOOTING.md)
4. **提交问题**: 在 [GitHub Issues](https://github.com/your-username/obsidian-upic-auto-uploader/issues) 中报告问题

---

**安装完成后，您就可以享受无缝的图片上传体验了！** 🎉