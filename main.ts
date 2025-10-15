import { Plugin, Editor, MarkdownView, MarkdownFileInfo, Notice, Platform, FileSystemAdapter, Menu, TFile } from 'obsidian';
import { join } from 'path';
import { writeFile, unlink } from 'fs/promises';
import { UPicUploader } from './src/upic-uploader';
import { SettingsManager } from './src/settings-manager';
import { UPicSettingTab } from './src/settings-tab';
import { PluginSettings, SUPPORTED_IMAGE_TYPES, PLUGIN_CONSTANTS } from './src/types';

export class UPicAutoUploaderPlugin extends Plugin {
	private settingsManager!: SettingsManager;
	private uploader!: UPicUploader;
	private settings!: PluginSettings;
	private processingFiles: Set<string> = new Set(); // 防重复处理的文件集合

	async onload() {
		// Plugin loading - removed console.log to reduce console pollution

		// 初始化设置管理器
		this.settingsManager = new SettingsManager(this.app, this);
		this.settings = await this.settingsManager.loadSettings();

		// 初始化上传器
		this.uploader = new UPicUploader(this, this.settings);

		// 添加设置选项卡
		this.addSettingTab(new UPicSettingTab(this.app, this));

		// 注册命令
		this.addCommands();

		// 注册事件监听器
		this.registerEventListeners();

		// 检查 uPic 可用性
		this.checkUPicAvailability();
	}

	async onunload() {
		// Plugin unloading - removed console.log to reduce console pollution
		
		// 清理 uploader 实例和定期检查
		if (this.uploader) {
			this.uploader.destroy();
		}
		
		// 确保停止所有定期检查
		UPicUploader.stopPeriodicCheck();
	}

	/**
	 * 添加插件命令
	 */
	private addCommands(): void {
		// 手动上传当前选中的图片
		this.addCommand({
			id: 'upload-selected-image',
			name: 'Upload selected image via uPic',
			editorCallback: (editor: Editor, view: MarkdownView | MarkdownFileInfo) => {
				this.uploadSelectedImage(editor);
			}
		});

		// 上传剪贴板中的图片
		this.addCommand({
			id: 'upload-clipboard-image',
			name: 'Upload clipboard image via uPic',
			editorCallback: (editor: Editor, view: MarkdownView | MarkdownFileInfo) => {
				this.uploadClipboardImage(editor);
			}
		});

		// 切换自动上传功能
		this.addCommand({
			id: 'toggle-auto-upload',
			name: 'Toggle auto upload',
			callback: () => {
				this.toggleAutoUpload();
			}
		});

		// 注册选择本地图片上传命令
		this.addCommand({
			id: 'upload-local-image',
			name: 'Upload local image',
			callback: async () => {
				await this.selectAndUploadLocalImage();
			}
		});

		// 注册诊断命令
		this.addCommand({
			id: 'diagnose',
			name: 'Diagnose uPic configuration',
			callback: async () => {
				try {
					const diagnostic = await this.uploader.getDiagnosticInfo();
					
					// 创建诊断报告
					const report = [
						'# uPic 诊断报告',
						'',
						`## 状态: ${this.getStatusText(diagnostic.status)}`,
						'',
						'## 系统信息',
						`- 平台: ${diagnostic.systemInfo.platform}`,
						`- 架构: ${diagnostic.systemInfo.arch}`,
						`- 用户目录: ${diagnostic.systemInfo.homeDir}`,
						`- PATH 环境变量: ${diagnostic.systemInfo.pathEnv.length} 个路径`,
						'',
						'## 检测到的路径',
						...diagnostic.detectedPaths.map(path => `- ${path}`),
						'',
						'## 路径测试结果',
						...diagnostic.testedPaths.map(test => 
							`- ${test.path}: 存在=${test.exists}, 可执行=${test.executable}, 测试通过=${test.testResult}`
						),
						'',
						'## 建议解决方案',
						...diagnostic.suggestions.map(suggestion => `- ${suggestion}`),
						'',
						'---',
						`生成时间: ${new Date().toLocaleString()}`
					].join('\n');
					
					// 创建新文件显示诊断报告
					const file = await this.app.vault.create(
						`uPic-Diagnostic-${Date.now()}.md`,
						report
					);
					
					// 打开文件
					const leaf = this.app.workspace.getLeaf(false);
					await leaf.openFile(file);
					
					// 显示通知
					new Notice(`诊断完成! 状态: ${this.getStatusText(diagnostic.status)}`);
					
				} catch (error) {
					console.error('Diagnostic failed:', error);
					new Notice(`诊断失败: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		});

		// 注册快速测试命令
		this.addCommand({
			id: 'test-upic-quick',
			name: 'Quick test uPic availability',
			callback: async () => {
				try {
					const result = await this.uploader.testUPicSimple(true);
					new Notice(result.message);
				} catch (error) {
					console.error('Quick test failed:', error);
					new Notice(`快速测试失败: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		});

		// 注册详细测试命令
		this.addCommand({
			id: 'test-upic-detailed',
			name: 'Detailed test uPic availability',
			callback: async () => {
				try {
					const result = await this.uploader.testUPicSimple(false);
					
					// 创建详细测试报告
					if (result.details) {
						const report = [
							'# uPic 详细测试报告',
							'',
							`## 测试结果: ${result.success ? '✅ 通过' : '❌ 失败'}`,
							'',
							result.path ? `**检测到的路径:** ${result.path}` : '**路径:** 未检测到',
							'',
							'## 详细信息',
							`- 路径存在: ${result.details.pathExists ? '✅' : '❌'}`,
							`- 可执行: ${result.details.isExecutable ? '✅' : '❌'}`,
							`- 命令测试: ${result.details.commandTest ? '✅' : '❌'}`,
							`- 响应时间: ${result.details.responseTime}ms`,
							'',
							`**消息:** ${result.message}`,
							'',
							'---',
							`测试时间: ${new Date().toLocaleString()}`
						].join('\n');
						
						// 创建测试报告文件
						const file = await this.app.vault.create(
							`uPic-Test-Report-${Date.now()}.md`,
							report
						);
						
						// 打开文件
						const leaf = this.app.workspace.getLeaf(false);
						await leaf.openFile(file);
					}
					
					new Notice(result.message);
				} catch (error) {
					console.error('Detailed test failed:', error);
					new Notice(`详细测试失败: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		});
	}

	/**
	 * 注册事件监听器
	 */
	private registerEventListeners(): void {
		// 监听粘贴事件 - 使用捕获模式确保优先处理
		const pasteHandler = (evt: ClipboardEvent) => {
			if (!this.settings.autoUpload) {
				return;
			}

			// 检查是否在编辑器中
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!activeView) {
				return;
			}

			// 处理粘贴的图片
			this.handlePasteEvent(evt, activeView.editor);
		};
		
		// 使用捕获模式注册事件，确保在Obsidian默认处理之前执行
		document.addEventListener('paste', pasteHandler, { capture: true });
		
		// 保存事件处理器引用以便清理
		this.register(() => {
			document.removeEventListener('paste', pasteHandler, { capture: true });
		});

		// 监听拖拽事件 - 使用捕获模式确保优先处理
		const dropHandler = (evt: DragEvent) => {
			if (!this.settings.autoUpload) {
				return;
			}

			// 检查是否在编辑器中
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!activeView) {
				return;
			}

			// 处理拖拽的图片
			this.handleDropEvent(evt, activeView.editor);
		};
		
		// 使用捕获模式注册拖拽事件
		document.addEventListener('drop', dropHandler, { capture: true });
		document.addEventListener('dragover', (evt) => evt.preventDefault(), { capture: true });
		
		// 保存拖拽事件处理器引用以便清理
		this.register(() => {
			document.removeEventListener('drop', dropHandler, { capture: true });
			document.removeEventListener('dragover', (evt) => evt.preventDefault(), { capture: true });
		});

		// 注册文件右键菜单监听器
		this.registerEvent(
			(this.app.workspace as any).on('file-menu', (menu: Menu, file: TFile) => {
				this.handleFileMenu(menu, file);
			})
		);
	}

	/**
	 * 处理粘贴事件
	 */
	private async handlePasteEvent(evt: ClipboardEvent, editor: Editor): Promise<void> {
		const clipboardData = evt.clipboardData;
		if (!clipboardData) {
			return;
		}

		const items = Array.from(clipboardData.items);
		const imageItems = items.filter(item => 
			item.type.startsWith('image/') && 
			SUPPORTED_IMAGE_TYPES.includes(item.type)
		);

		if (imageItems.length === 0) {
			return;
		}

		// 立即阻止默认粘贴行为和事件传播
		evt.preventDefault();
		evt.stopPropagation();
		evt.stopImmediatePropagation();

		console.log('🚫 Prevented default paste behavior for', imageItems.length, 'image(s)');

		// 处理图片上传
		for (const item of imageItems) {
			const file = item.getAsFile();
			if (file) {
				await this.processImageFile(file, editor);
			}
		}
	}

	/**
	 * 处理拖拽事件 - 增强调试版本
	 */
	private async handleDropEvent(evt: DragEvent, editor: Editor): Promise<void> {
		try {
			// Drop event detected - removed console.log to reduce console pollution
			
			if (!evt.dataTransfer?.files?.length) {
				// No files in drop event - removed console.log to reduce console pollution
				return;
			}
			
			const allFiles = Array.from(evt.dataTransfer.files);
			// All dropped files logged - removed console.log to reduce console pollution
			
			const imageFiles = allFiles.filter(file => 
				SUPPORTED_IMAGE_TYPES.includes(file.type)
			);

			if (imageFiles.length === 0) {
				// No supported image files found - removed console.log to reduce console pollution
				return;
			}

			// 阻止默认拖拽行为
			evt.preventDefault();

			// 处理图片上传 - 使用改进的处理逻辑
			for (const file of imageFiles) {
				// Processing image file - removed console.log to reduce console pollution
				
				await this.processDroppedImageFileFixed(file, editor, evt);
			}
			
			// Drop event processing completed - removed console.log to reduce console pollution
			
		} catch (error) {
			console.error('❌ Error handling drop event:', {
				error: error,
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				timestamp: new Date().toISOString()
			});
		}
	}

	/**
	 * 处理图片文件（粘贴）- 使用与拖拽图片相同的处理逻辑
	 */
	private async processImageFile(file: File, editor: Editor): Promise<void> {
		try {
			// 检查桌面端可用性
			if (!Platform.isDesktop) {
				new Notice('Image upload is only available on desktop');
				return;
			}

			// 防重复处理检查
			const fileId = `${file.name}-${file.size}-${file.lastModified}`;
			if (this.processingFiles.has(fileId)) {
				console.log('🚫 File already being processed, skipping:', file.name);
				return;
			}
			
			// 标记文件为处理中
			this.processingFiles.add(fileId);
			console.log('🔄 Started processing file:', file.name, 'ID:', fileId);

			// 获取仓库路径
			const vaultPath = this.app.vault.adapter instanceof FileSystemAdapter ? (this.app.vault.adapter as any).basePath || '' : '';
			const fileName = file.name;
			const vaultCopyPath = vaultPath ? require('path').join(vaultPath, fileName) : fileName;

			// 先插入本地链接（显示仓库内路径）
			const localImageMarkdown = `![${fileName}](${fileName})`; // 使用相对路径，确保alt text和path一致
			editor.replaceSelection(localImageMarkdown);
			console.log('📝 Inserted local image link:', localImageMarkdown);

			// 立即获取插入后的文档内容，用于后续替换
			const contentAfterInsert = editor.getValue();
			console.log('📄 Content after insert (first 200 chars):', contentAfterInsert.substring(0, 200));

			// 将粘贴的图片文件复制到仓库根目录
			try {
				const fs = require('fs').promises;
				const tempFilePath = await this.createTempFile(file);
				await fs.copyFile(tempFilePath, vaultCopyPath);
				console.log('📁 Copied file to vault:', vaultCopyPath);
				// 删除临时文件（已复制到仓库）
				await this.deleteTempFile(tempFilePath);
			} catch (copyError) {
				console.error('❌ Failed to copy file to vault:', copyError);
			}

			// 显示上传进度提示
			const uploadingNotice = new Notice(`正在上传 ${file.name}...`, 0);

			// 创建临时文件用于上传
			const tempFilePath = await this.createTempFile(file);

			// 上传图片
			const result = await this.uploader.uploadFile(tempFilePath);

			// 隐藏上传进度提示
			uploadingNotice.hide();

			if (result.success && result.url) {
				// 上传成功，替换文档中的本地链接为在线链接
				console.log('🔄 Attempting to replace image link:', {
					oldPath: fileName,
					newUrl: result.url,
					fileName: fileName,
					localMarkdown: localImageMarkdown
				});
				
				// 获取当前文档内容用于替换
				const currentContent = editor.getValue();
				console.log('📄 Current content before replacement (first 200 chars):', currentContent.substring(0, 200));
				
				// 尝试多种替换策略
				let replaced = false;
				
				// 策略1: 使用replaceImageLinkInDocument方法
				replaced = await this.replaceImageLinkInDocument(editor, fileName, result.url, fileName);
				
				if (!replaced) {
					console.warn('⚠️ Standard replacement failed, trying enhanced manual replacement');
					
					// 策略2: 直接字符串替换
					const content = editor.getValue();
					let newContent = content;
					
					// 尝试精确匹配
					if (content.includes(localImageMarkdown)) {
						newContent = content.replace(localImageMarkdown, `![${fileName}](${result.url})`);
						replaced = true;
						console.log('✅ Exact string replacement successful');
					}
					
					// 策略3: 正则表达式替换（更宽松）
					if (!replaced) {
						const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
						const regex = new RegExp(`!\\[${escapedFileName}\\]\\(${escapedFileName}\\)`, 'g');
						const regexContent = content.replace(regex, `![${fileName}](${result.url})`);
						if (regexContent !== content) {
							newContent = regexContent;
							replaced = true;
							console.log('✅ Regex replacement successful');
						}
					}
					
					// 策略4: 最宽松的替换（匹配任何包含文件名的图片链接）
					if (!replaced) {
						const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
						const looseRegex = new RegExp(`!\\[([^\\]]*)\\]\\([^\\)]*${escapedFileName}[^\\)]*)`, 'g');
						const looseContent = content.replace(looseRegex, `![${fileName}](${result.url})`);
						if (looseContent !== content) {
							newContent = looseContent;
							replaced = true;
							console.log('✅ Loose regex replacement successful');
						}
					}
					
					// 应用替换结果
					if (replaced && newContent !== content) {
						editor.setValue(newContent);
						console.log('📄 Content after replacement (first 200 chars):', newContent.substring(0, 200));
					} else if (!replaced) {
						console.error('❌ All replacement strategies failed');
						console.log('🔍 Debug info:', {
							localMarkdown: localImageMarkdown,
							fileName: fileName,
							contentIncludes: content.includes(localImageMarkdown),
							contentLength: content.length,
							contentPreview: content.substring(0, 500)
						});
					}
				}

				// 显示成功通知
				if (this.settings.showNotifications) {
					new Notice(`✅ 图片上传成功: ${file.name}`);
				}

				console.log('✅ Image upload successful:', {
					fileName: file.name,
					url: result.url,
					vaultCopyPath: vaultCopyPath,
					tempPath: tempFilePath,
					replaced: replaced
				});

				// 删除临时文件
				await this.deleteTempFile(tempFilePath);

				// 删除仓库内的副本文件
				if (vaultCopyPath && require('fs').existsSync(vaultCopyPath)) {
					await this.deleteVaultCopyFile(vaultCopyPath, file.name);
				}

			} else {
				// 上传失败，保持本地链接
				const errorMsg = `❌ 上传失败: ${file.name} - ${result.error}`;
				new Notice(errorMsg, 8000);

				console.error('❌ Image upload failed:', {
					fileName: file.name,
					error: result.error,
					tempPath: tempFilePath
				});

				// 删除临时文件
				await this.deleteTempFile(tempFilePath);
			}

		} catch (error) {
			console.error('Error processing image file:', error);
			new Notice(`❌ 处理图片失败: ${file.name}`);
		} finally {
			// 清理：从处理中文件集合中移除
			const fileId = `${file.name}-${file.size}-${file.lastModified}`;
			this.processingFiles.delete(fileId);
			console.log('🧹 Finished processing file:', file.name, 'ID:', fileId);
		}
	}

	/**
	 * 处理拖拽的图片文件 - 修复版本：先插入本地链接，上传后替换，只删除仓库副本
	 */
	private async processDroppedImageFileFixed(file: File, editor: Editor, evt: DragEvent): Promise<void> {
		try {
			// Processing dropped image file - removed console.log to reduce console pollution
			
			// 获取真实的文件路径
			const realFilePath = await this.getRealFilePath(file, evt);
			// Real file path detected - removed console.log to reduce console pollution
			
			// 检查是否是从仓库外部拖拽的文件
			const vaultPath = this.app.vault.adapter instanceof FileSystemAdapter ? (this.app.vault.adapter as any).basePath || '' : '';
			const isExternalFile = realFilePath && !realFilePath.startsWith(vaultPath);
			
			// 创建仓库内的副本路径（用于显示）
			const { basename } = require('path');
			const fileName = basename(realFilePath || file.name);
			const vaultCopyPath = vaultPath ? require('path').join(vaultPath, fileName) : fileName;
			
			// 先插入本地链接（显示仓库内路径）
			const localImageMarkdown = `![${file.name}](${fileName})`; // 使用相对路径
			editor.replaceSelection(localImageMarkdown);
			// Inserted local image link - removed console.log to reduce console pollution
			
			// 如果是外部文件，复制到仓库根目录
			if (isExternalFile && realFilePath) {
				try {
					const fs = require('fs').promises;
					await fs.copyFile(realFilePath, vaultCopyPath);
					// Copied external file to vault - removed console.log to reduce console pollution
				} catch (copyError) {
					console.error('❌ Failed to copy file to vault:', copyError);
				}
			}
			
			// 显示上传进度提示
			const uploadingNotice = new Notice(`正在上传 ${file.name}...`, 0);
			
			// 创建临时文件用于上传
			const tempFilePath = await this.createTempFile(file);
			// Created temp file for upload - removed console.log to reduce console pollution
			
			// 上传图片
			const result = await this.uploader.uploadFile(tempFilePath);
			
			// 隐藏上传进度提示
			uploadingNotice.hide();
			
			if (result.success && result.url) {
				// 上传成功，替换文档中的本地链接为在线链接
				await this.replaceImageLinkInDocument(editor, fileName, result.url, file.name);
				
				// 显示成功通知
				if (this.settings.showNotifications) {
					new Notice(`✅ 图片上传成功: ${file.name}`);
				}
				
				console.log('✅ Image upload successful:', {
					fileName: file.name,
					url: result.url,
					realPath: realFilePath,
					vaultCopyPath: vaultCopyPath,
					tempPath: tempFilePath,
					isExternalFile
				});
				
				// 删除临时文件
				await this.deleteTempFile(tempFilePath);
				
				// 只删除仓库内的副本文件，不删除原始文件
				if (vaultCopyPath && require('fs').existsSync(vaultCopyPath)) {
					await this.deleteVaultCopyFile(vaultCopyPath, file.name);
				}
				
			} else {
				// 上传失败，保持本地链接
				const errorMsg = `❌ 上传失败: ${file.name} - ${result.error}`;
				new Notice(errorMsg, 8000);
				
				console.error('❌ Image upload failed:', {
					fileName: file.name,
					error: result.error,
					realPath: realFilePath,
					tempPath: tempFilePath
				});
				
				// 删除临时文件
				await this.deleteTempFile(tempFilePath);
			}
			
		} catch (error) {
			console.error('Error processing dropped image file:', error);
			new Notice(`❌ 处理图片失败: ${file.name}`);
		}
	}

	/**
	 * 获取拖拽文件的真实路径
	 */
	private async getRealFilePath(file: File, evt: DragEvent): Promise<string | null> {
		try {
			// 方法1: 检查File对象的path属性（Electron环境）
			// Try to get file path from File object properties
			if ('path' in file && typeof (file as any).path === 'string') {
				console.log('📁 Found file path via file.path:', (file as any).path);
				return (file as any).path;
			}
			
			// 方法2: 检查webkitRelativePath
			if ('webkitRelativePath' in file && typeof (file as any).webkitRelativePath === 'string' && (file as any).webkitRelativePath) {
				// Found file path via webkitRelativePath - removed console.log to reduce console pollution
				return (file as any).webkitRelativePath;
			}
			
			// 方法3: 通过DataTransfer检查
			if (evt.dataTransfer && evt.dataTransfer.items) {
				for (let i = 0; i < evt.dataTransfer.items.length; i++) {
					const item = evt.dataTransfer.items[i];
					if (item.kind === 'file') {
						// Check if item has webkitGetAsEntry method (DataTransferItem)
						if ('webkitGetAsEntry' in item && typeof (item as any).webkitGetAsEntry === 'function') {
							const entry = (item as any).webkitGetAsEntry();
							if (entry && 'fullPath' in entry && typeof entry.fullPath === 'string') {
								// Found file path via webkitGetAsEntry - removed console.log to reduce console pollution
								return entry.fullPath;
							}
						}
					}
				}
			}
			
			// 方法4: 检查是否是从文件系统拖拽（通过文件大小和修改时间判断）
			if (file.lastModified && file.size > 0) {
				// 这可能是一个真实的文件，但我们无法获取路径
				// 在这种情况下，我们假设它在当前工作目录或用户桌面
				const possiblePaths = [
					// Use Platform.isDesktop to check if desktop-specific paths are available
					...(Platform.isDesktop ? [
						`${require('os').homedir()}/Desktop/${file.name}`,
						`${require('os').homedir()}/Downloads/${file.name}`
					] : []),
					`./${file.name}` // 当前目录
				];
				
				for (const path of possiblePaths) {
					try {
						const fs = require('fs');
						if (fs.existsSync(path)) {
							const stats = fs.statSync(path);
							if (Math.abs(stats.mtime.getTime() - file.lastModified) < 1000 && stats.size === file.size) {
								console.log('📁 Found matching file at:', path);
								return path;
							}
						}
					} catch (e) {
						// 忽略错误，继续尝试下一个路径
					}
				}
			}
			
			console.log('📁 No real file path found, treating as blob/clipboard image');
			return null;
			
		} catch (error) {
			console.error('Error getting real file path:', error);
			return null;
		}
	}

	/**
	 * 删除仓库内的副本文件 - 安全版本，只删除仓库内副本，不删除原始文件
	 */
	private async deleteVaultCopyFile(vaultCopyPath: string, fileName: string): Promise<boolean> {
		try {
			// Attempting to delete vault copy file - removed console.log to reduce console pollution
			
			// 安全检查：确保只删除仓库内的文件
			const vaultPath = this.app.vault.adapter instanceof FileSystemAdapter ? (this.app.vault.adapter as any).basePath || '' : '';
			if (!vaultPath || !vaultCopyPath.startsWith(vaultPath)) {
				console.warn('⚠️ Refusing to delete file outside vault:', vaultCopyPath);
				return false;
			}
			
			// 检查文件是否存在
			const fs = require('fs').promises;
			try {
				await fs.access(vaultCopyPath);
			} catch (accessError) {
				console.warn('⚠️ Vault copy file does not exist:', vaultCopyPath);
				return false;
			}
			
			// 删除仓库内的副本文件
			await fs.unlink(vaultCopyPath);
			console.log('✅ Vault copy file deleted successfully:', vaultCopyPath);
			
			if (this.settings.showNotifications) {
				new Notice(`🗑️ 已删除仓库副本: ${fileName}`);
			}
			return true;
			
		} catch (error) {
			console.error('❌ Error in deleteVaultCopyFile:', error);
			return false;
		}
	}

	/**
	 * 删除Obsidian根目录中的图片文件 - 专门用于粘贴图片上传后的清理
	 */
	private async deleteVaultImageFile(fileName: string): Promise<boolean> {
		try {
			// 获取Obsidian仓库根目录路径
			const vaultPath = this.app.vault.adapter instanceof FileSystemAdapter ? (this.app.vault.adapter as any).basePath || '' : '';
			if (!vaultPath) {
				console.warn('⚠️ Cannot get vault path for image deletion');
				return false;
			}

			// 构建图片文件的完整路径
			const { join } = require('path');
			const imageFilePath = join(vaultPath, fileName);
			
			// 安全检查：确保文件在仓库根目录内
			if (!imageFilePath.startsWith(vaultPath)) {
				console.warn('⚠️ Refusing to delete file outside vault root:', imageFilePath);
				return false;
			}
			
			// 检查文件是否存在
			const fs = require('fs').promises;
			try {
				await fs.access(imageFilePath);
			} catch (accessError) {
				// 文件不存在，这是正常情况（可能是从剪贴板粘贴的图片）
				console.log('ℹ️ No local image file to delete:', imageFilePath);
				return false;
			}
			
			// 删除图片文件
			await fs.unlink(imageFilePath);
			console.log('✅ Vault image file deleted successfully:', imageFilePath);
			
			if (this.settings.showNotifications) {
				new Notice(`🗑️ 已删除本地图片: ${fileName}`);
			}
			return true;
			
		} catch (error) {
			console.error('❌ Error in deleteVaultImageFile:', {
				fileName,
				error: error instanceof Error ? error.message : String(error)
			});
			return false;
		}
	}
	
	/**
	 * 删除原始文件 - 改进版本，支持多种路径格式（保留用于其他功能）
	 */
	private async deleteOriginalFile(filePath: string, fileName: string): Promise<boolean> {
		try {
			console.log('🗑️ Attempting to delete original file:', filePath);
			
			// 获取可能的文件路径列表
			const possiblePaths = await this.getPossibleFilePaths(filePath);
			console.log('📁 Possible file paths to check:', possiblePaths);
			
			// 尝试删除每个可能的路径
			for (const path of possiblePaths) {
				try {
					const fs = require('fs').promises;
					await fs.access(path);
					await fs.unlink(path);
					console.log('✅ Original file deleted successfully:', path);
					
					if (this.settings.showNotifications) {
						new Notice(`🗑️ 已删除本地文件: ${fileName}`);
					}
					return true;
				} catch (deleteError) {
					console.warn('⚠️ Failed to delete path:', path, deleteError);
				}
			}
			
			console.warn('⚠️ No original file found for deletion among paths:', possiblePaths);
			return false;
			
			
		} catch (error) {
			console.error('❌ Error in deleteOriginalFile:', error);
			return false;
		}
	}
	
	/**
	 * 获取可能的文件路径列表
	 */
	private async getPossibleFilePaths(originalPath: string): Promise<string[]> {
		const paths: string[] = [];
		const { basename, join, isAbsolute, resolve } = require('path');
		const fileName = basename(originalPath);
		const vaultPath = this.app.vault.adapter instanceof FileSystemAdapter ? (this.app.vault.adapter as any).basePath || '' : '';
		
		// 1. 原始路径
		paths.push(originalPath);
		
		// 2. 相对于vault根目录的路径
		if (vaultPath) {
			paths.push(join(vaultPath, fileName));
			paths.push(join(vaultPath, originalPath));
		}
		
		// 3. 绝对路径（如果原始路径是相对路径）
		if (!isAbsolute(originalPath)) {
			paths.push(resolve(originalPath));
			if (vaultPath) {
				paths.push(resolve(vaultPath, originalPath));
			}
		}
		
		// 4. 只使用文件名在vault根目录中查找
		if (vaultPath) {
			paths.push(join(vaultPath, fileName));
		}
		
		// 5. 当前工作目录中的文件
		paths.push(resolve(process.cwd(), fileName));
		paths.push(resolve(process.cwd(), originalPath));
		
		// 去重并返回
		return [...new Set(paths)];
	}

	/**
	 * 处理拖拽的图片文件 - 新版本：先插入本地链接，上传后替换为在线链接
	 */
	private async processDroppedImageFileNew(file: File, editor: Editor): Promise<void> {
		try {
			// Processing dropped image file (new method) - removed console.log to reduce console pollution
			
			// 检查是否是从本地文件系统拖拽的文件
			const fileAny = file as any;
			const isLocalFile = !!(fileAny.path || fileAny.webkitRelativePath);
			let originalFilePath = '';
			let localImagePath = '';
			
			if (isLocalFile) {
				originalFilePath = fileAny.path || fileAny.webkitRelativePath || '';
				localImagePath = originalFilePath;
				console.log('📁 Local file detected:', originalFilePath);
			} else {
				// 如果不是本地文件，创建临时文件作为本地路径
				localImagePath = await this.createTempFile(file);
				console.log('📄 Created temp file as local path:', localImagePath);
			}
			
			// 先插入本地图片链接
			const localImageMarkdown = `![${file.name}](${localImagePath})`;
			editor.replaceSelection(localImageMarkdown);
			// Inserted local image link - removed console.log to reduce console pollution
			
			// 显示上传进度提示
			const uploadingNotice = new Notice(`Uploading ${file.name}...`, 0);
			
			// 创建临时文件用于上传（如果还没有创建）
			let tempFilePath = localImagePath;
			if (isLocalFile) {
				tempFilePath = await this.createTempFile(file);
				console.log('📄 Created temp file for upload:', tempFilePath);
			}
			
			// 上传图片
			const result = await this.uploader.uploadFile(tempFilePath);
			
			// 隐藏上传进度提示
			uploadingNotice.hide();
			
			if (result.success && result.url) {
				// 上传成功，替换文档中的本地链接为在线链接
				await this.replaceImageLinkInDocument(editor, localImagePath, result.url, file.name);
				
				// 显示成功通知
				if (this.settings.showNotifications) {
					new Notice(`✅ Image uploaded: ${file.name}`);
				}
				
				console.log('✅ Dropped image upload successful:', {
					fileName: file.name,
					url: result.url,
					originalPath: originalFilePath,
					localPath: localImagePath,
					tempPath: tempFilePath,
					isLocalFile
				});
				
				// 总是删除临时文件
				if (tempFilePath !== localImagePath) {
					await this.deleteTempFile(tempFilePath);
				}
				
				// 如果是本地文件，尝试删除原始本地文件
				if (isLocalFile && originalFilePath) {
					try {
						const fs = require('fs').promises;
						await fs.unlink(originalFilePath);
						console.log('🗑️ Local file deleted successfully:', originalFilePath);
						if (this.settings.showNotifications) {
							new Notice(`🗑️ Local file deleted: ${file.name}`);
						}
					} catch (deleteError) {
						console.error('❌ Failed to delete local file:', {
							filePath: originalFilePath,
							error: deleteError,
							fileName: file.name
						});
						new Notice(`⚠️ Could not delete local file: ${file.name}`);
					}
				} else if (!isLocalFile) {
					// 删除临时文件
					await this.deleteTempFile(localImagePath);
				}
			} else {
				// 上传失败，保持本地链接并显示错误
				const errorMsg = `❌ Upload failed for ${file.name}: ${result.error}`;
				new Notice(errorMsg, 8000);
				
				console.error('❌ Dropped image upload failed:', {
					fileName: file.name,
					error: result.error,
					originalPath: originalFilePath,
					localPath: localImagePath,
					tempPath: tempFilePath,
					result
				});
				
				// 删除临时文件（如果有）
				if (tempFilePath !== localImagePath) {
					await this.deleteTempFile(tempFilePath);
				}
			}
			
		} catch (error) {
			console.error('Error processing dropped image file:', error);
			new Notice(`❌ Failed to process image: ${file.name}`);
		}
	}

	/**
	 * 处理拖拽的图片文件（旧版本 - 保留作为备用）
	 */
	private async processDroppedImageFile(file: File, editor: Editor): Promise<void> {
		try {
			console.log('🔄 Processing dropped image file:', file.name);
			
			// 检查是否是从本地文件系统拖拽的文件
			// 通过检查File对象的webkitRelativePath或其他属性来判断
			const fileAny = file as any;
			const isLocalFile = !!(fileAny.path || fileAny.webkitRelativePath);
			let originalFilePath = '';
			let tempFilePath = '';
			
			if (isLocalFile) {
				// 使用本地文件路径
				originalFilePath = fileAny.path || fileAny.webkitRelativePath || '';
				// 为了上传，仍然需要创建临时文件
				tempFilePath = await this.createTempFile(file);
				console.log('📁 Local file detected:', originalFilePath);
				console.log('📄 Created temp file for upload:', tempFilePath);
			} else {
				// 创建临时文件
				tempFilePath = await this.createTempFile(file);
				console.log('📄 Created temp file:', tempFilePath);
			}

			// 上传图片
			const result = await this.uploader.uploadFile(tempFilePath);

			if (result.success && result.url) {
				// 保留原始文件名，插入 Markdown 图片链接
				const imageMarkdown = `![${file.name}](${result.url})`;
				editor.replaceSelection(imageMarkdown);

				// 显示成功通知
				if (this.settings.showNotifications) {
					new Notice(`Image uploaded successfully: ${file.name}`);
				}
				console.log('✅ Dropped image upload successful:', {
					fileName: file.name,
					url: result.url,
					originalPath: originalFilePath,
					tempPath: tempFilePath,
					isLocalFile
				});

				// 总是删除临时文件
				await this.deleteTempFile(tempFilePath);
				
				// 如果是本地文件，尝试删除原始本地文件
				if (isLocalFile && originalFilePath) {
					try {
						// 使用Node.js fs模块删除本地文件
						const fs = require('fs').promises;
						await fs.unlink(originalFilePath);
						console.log('🗑️ Local file deleted successfully:', originalFilePath);
						if (this.settings.showNotifications) {
							new Notice(`Local file deleted: ${file.name}`);
						}
					} catch (deleteError) {
						console.error('❌ Failed to delete local file:', {
							filePath: originalFilePath,
							error: deleteError,
							fileName: file.name
						});
						new Notice(`Warning: Could not delete local file: ${file.name}. Error: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`);
					}
				}
			} else {
				// 上传失败，插入本地图片链接作为备选
				const imageMarkdown = `![${file.name}](${tempFilePath})`;
				editor.replaceSelection(imageMarkdown);

				// 显示详细错误信息
				const errorMsg = `Upload failed for ${file.name}: ${result.error}`;
				new Notice(errorMsg, 8000);
				console.error('❌ Dropped image upload failed:', {
					fileName: file.name,
					error: result.error,
					originalPath: originalFilePath,
					tempPath: tempFilePath,
					result
				});
			}

		} catch (error) {
			console.error('Error processing dropped image file:', error);
			new Notice('Failed to process dropped image file');
		}
	}

	/**
	 * 创建临时文件 - 保持原始文件名以确保uPic使用正确的文件名
	 */
	private async createTempFile(file: File): Promise<string> {
		if (!Platform.isDesktop) {
			throw new Error('Temporary file creation is only available on desktop');
		}
		const buffer = await file.arrayBuffer();
		const uint8Array = new Uint8Array(buffer);
		
		const tempDir = require('os').tmpdir();
		// 保持原始文件名，只在必要时添加时间戳避免冲突
		let fileName = file.name;
		let tempFilePath = join(tempDir, fileName);
		
		// 检查文件是否已存在，如果存在则添加时间戳
		try {
			const fs = require('fs').promises;
			await fs.access(tempFilePath);
			// 文件存在，添加时间戳
			const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
			const extension = fileName.substring(fileName.lastIndexOf('.'));
			fileName = `${nameWithoutExt}_${Date.now()}${extension}`;
			tempFilePath = join(tempDir, fileName);
		} catch (error) {
			// 文件不存在，使用原始文件名
		}

		await writeFile(tempFilePath, uint8Array);
		console.log('📄 Created temp file with preserved filename:', {
			originalName: file.name,
			tempFileName: fileName,
			tempFilePath
		});
		return tempFilePath;
	}

	/**
	 * 删除临时文件
	 */
	private async deleteTempFile(filePath: string): Promise<void> {
		if (!Platform.isDesktop) {
			console.warn('File deletion is only available on desktop');
			return;
		}
		try {
			await unlink(filePath);
		} catch (error) {
			console.warn('Failed to delete temp file:', error);
		}
	}

	/**
	 * 在所有打开的文档中替换图片链接
	 */
	private async replaceImageLinkInAllDocuments(file: TFile, newUrl: string): Promise<number> {
		try {
			let totalReplacedCount = 0;
			const fileName = file.name;
			const filePath = file.path;
			
			console.log('🔍 Starting global image link replacement:', {
				fileName,
				filePath,
				newUrl
			});

			// 获取所有打开的 Markdown 视图
			const markdownViews = this.app.workspace.getLeavesOfType('markdown');
			console.log(`📄 Found ${markdownViews.length} open markdown documents`);

			for (const leaf of markdownViews) {
				const view = leaf.view as MarkdownView;
				if (view && view.editor) {
					const editor = view.editor;
					const documentPath = view.file?.path || 'unknown';
					
					console.log(`🔍 Checking document: ${documentPath}`);
					
					// 在当前文档中替换图片链接 - 使用增强的替换逻辑
					const replacedInDoc = await this.replaceAllImageLinksInDocument(editor, file, newUrl);
					
					if (replacedInDoc) {
						totalReplacedCount++;
						console.log(`✅ Replaced image link in document: ${documentPath}`);
					} else {
						console.log(`ℹ️ No matching links found in document: ${documentPath}`);
					}
				}
			}

			console.log(`🎯 Global replacement completed. Total replaced: ${totalReplacedCount}`);
			return totalReplacedCount;
			
		} catch (error) {
			console.error('❌ Error in global image link replacement:', error);
			return 0;
		}
	}

	/**
	 * 在文档中替换图片链接 - 增强版本，支持多种链接格式
	 */
	private async replaceImageLinkInDocument(editor: Editor, oldPath: string, newUrl: string, fileName: string): Promise<boolean> {
		try {
			const content = editor.getValue();
			console.log('🔍 Starting link replacement:', {
				oldPath,
				newUrl,
				fileName,
				contentLength: content.length,
				contentPreview: content.substring(0, 200)
			});
			
			// 生成所有可能的路径变体
			const pathVariants = this.generatePathVariants(fileName, oldPath);
			console.log('🔍 Generated path variants:', pathVariants);
			
			let replaced = false;
			let newContent = content;
			
			// 遍历所有路径变体进行替换
			for (const variant of pathVariants) {
				const patterns = this.generateReplacementPatterns(variant, fileName, newUrl);
				
				for (const pattern of patterns) {
					if (pattern.isRegex) {
						// 正则表达式替换
						const regex = new RegExp(pattern.pattern, 'g');
						const result = newContent.replace(regex, pattern.replacement);
						if (result !== newContent) {
							newContent = result;
							replaced = true;
							console.log(`✅ Regex replacement successful: ${pattern.description}`);
							break;
						}
					} else {
						// 字符串替换
						if (newContent.includes(pattern.pattern)) {
							newContent = newContent.replace(new RegExp(this.escapeRegExp(pattern.pattern), 'g'), pattern.replacement);
							replaced = true;
							console.log(`✅ String replacement successful: ${pattern.description}`);
							break;
						}
					}
				}
				
				if (replaced) break;
			}
			
			// 应用替换结果
			if (replaced) {
				editor.setValue(newContent);
				console.log('📄 Content replacement applied successfully');
				return true;
			} else {
				console.log('ℹ️ No matching image links found for replacement');
				return false;
			}
			
		} catch (error) {
			console.error('❌ Error replacing image link in document:', error);
			return false;
		}
	}

	/**
	 * 在文档中替换所有可能的图片链接引用 - 专门用于右键上传功能
	 */
	private async replaceAllImageLinksInDocument(editor: Editor, file: TFile, newUrl: string): Promise<boolean> {
		try {
			const content = editor.getValue();
			const fileName = file.name;
			const filePath = file.path;
			const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
			
			console.log('🔍 Starting comprehensive link replacement:', {
				fileName,
				filePath,
				fileNameWithoutExt,
				newUrl,
				contentLength: content.length,
				contentPreview: content.substring(0, 200)
			});
			
			let newContent = content;
			let replaced = false;
			let replacementCount = 0;
			
			// 优先处理 Obsidian 双方括号格式 - 这是最常见的格式
			const doubleBracketPatterns = [
				`![[${fileName}]]`,
				`![[${filePath}]]`,
				`![[${fileNameWithoutExt}]]`
			];
			
			console.log('🎯 Checking double bracket patterns:', doubleBracketPatterns);
			console.log('🔍 Content contains double brackets:', content.includes('![['));
			
			for (const pattern of doubleBracketPatterns) {
				if (content.includes(pattern)) {
					console.log(`🎯 Found double bracket pattern: ${pattern}`);
					const replacement = `![${fileNameWithoutExt}](${newUrl})`;
					newContent = newContent.replace(new RegExp(this.escapeRegExp(pattern), 'g'), replacement);
					replaced = true;
					replacementCount++;
					console.log(`✅ Double bracket replacement: ${pattern} -> ${replacement}`);
				}
			}
			
			// 如果双方括号替换成功，直接应用并返回
			if (replaced) {
				editor.setValue(newContent);
				console.log(`📄 Double bracket replacement completed. Replaced ${replacementCount} references.`);
				return true;
			}
			
			// 如果没有找到双方括号格式，尝试其他格式
			console.log('🔄 No double bracket patterns found, trying other formats...');
			
			// 生成所有可能的引用格式（排除双方括号，因为已经处理过了）
			const possibleReferences = this.generateAllPossibleImageReferences(file)
				.filter(ref => !ref.startsWith('![[') || !ref.endsWith(']]'));
			console.log('🔍 Generated other possible references:', possibleReferences);
			
			// 遍历所有可能的引用格式进行替换
			for (const reference of possibleReferences) {
				// 尝试多种匹配模式
				const matchPatterns = [
					// 1. 精确匹配
					`![${fileName}](${reference})`,
					`![](${reference})`,
					// 2. 任意alt text匹配
					new RegExp(`!\\[([^\\]]*)\\]\\(${this.escapeRegExp(reference)}\\)`, 'g'),
					// 3. 宽松匹配（处理编码等问题）
					new RegExp(`!\\[([^\\]]*)\\]\\([^\\)]*${this.escapeRegExp(fileName.replace(/\s+/g, '%20'))}[^\\)]*)`, 'g')
				];
				
				for (const pattern of matchPatterns) {
					if (typeof pattern === 'string') {
						// 字符串精确匹配
						if (newContent.includes(pattern)) {
							const beforeReplace = newContent;
							newContent = newContent.replace(new RegExp(this.escapeRegExp(pattern), 'g'), `![${fileName}](${newUrl})`);
							if (newContent !== beforeReplace) {
								replaced = true;
								replacementCount++;
								console.log(`✅ String replacement successful: ${pattern}`);
							}
						}
					} else {
						// 正则表达式匹配
						const beforeReplace = newContent;
						newContent = newContent.replace(pattern, `![${fileName}](${newUrl})`);
						if (newContent !== beforeReplace) {
							replaced = true;
							replacementCount++;
							console.log(`✅ Regex replacement successful: ${pattern.source}`);
						}
					}
				}
			}
			
			// 应用替换结果
			if (replaced) {
				editor.setValue(newContent);
				console.log(`📄 Content replacement applied successfully. Replaced ${replacementCount} references.`);
				return true;
			} else {
				console.log('ℹ️ No matching image links found for replacement');
				// 输出详细的调试信息
				console.log('🔍 Debug analysis:', {
					contentLength: content.length,
					hasDoubleBrackets: content.includes('![['),
					hasFileName: content.includes(fileName),
					hasFileNameWithoutExt: content.includes(fileNameWithoutExt),
					contentSample: content.substring(0, 500)
				});
				return false;
			}
			
		} catch (error) {
			console.error('❌ Error replacing all image links in document:', error);
			return false;
		}
	}

	/**
	 * 生成文件的所有可能引用格式
	 */
	private generateAllPossibleImageReferences(file: TFile): string[] {
		const references = new Set<string>();
		const fileName = file.name;
		const filePath = file.path;
		const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
		
		// 1. 文件名本身
		references.add(fileName);
		
		// 2. 完整路径
		references.add(filePath);
		
		// 3. 相对路径变体
		references.add(`./${fileName}`);
		references.add(`./${filePath}`);
		
		// 4. URL编码版本（处理空格等特殊字符）
		references.add(encodeURIComponent(fileName));
		references.add(fileName.replace(/\s+/g, '%20'));
		
		// 5. 如果路径包含文件夹，生成各种文件夹组合
		if (filePath.includes('/')) {
			const pathParts = filePath.split('/');
			// 生成从不同层级开始的路径
			for (let i = 0; i < pathParts.length - 1; i++) {
				const partialPath = pathParts.slice(i).join('/');
				references.add(partialPath);
				references.add(`./${partialPath}`);
			}
		}
		
		// 6. 常见的附件文件夹路径
		const commonFolders = ['attachments', 'assets', 'images', 'files', 'media'];
		for (const folder of commonFolders) {
			references.add(`${folder}/${fileName}`);
			references.add(`./${folder}/${fileName}`);
		}
		
		// 7. 处理Obsidian的特殊路径格式
		if (filePath.startsWith('attachments/') || filePath.includes('/attachments/')) {
			// 如果文件在attachments文件夹中，也尝试不带文件夹的引用
			references.add(fileName);
		}
		
		// 8. Obsidian 双方括号格式 - 这是关键的修复！
		references.add(`![[${fileName}]]`);
		references.add(`![[${filePath}]]`);
		references.add(`![[${fileNameWithoutExt}]]`); // 不带扩展名的版本
		
		// 9. 双方括号格式的路径变体
		if (filePath.includes('/')) {
			const pathParts = filePath.split('/');
			for (let i = 0; i < pathParts.length - 1; i++) {
				const partialPath = pathParts.slice(i).join('/');
				references.add(`![[${partialPath}]]`);
			}
		}
		
		// 10. 双方括号格式的常见文件夹路径
		for (const folder of commonFolders) {
			references.add(`![[${folder}/${fileName}]]`);
		}
		
		console.log('🔍 Generated image references for', fileName, ':', Array.from(references));
		return Array.from(references);
	}
	
	/**
	 * 生成路径变体
	 */
	private generatePathVariants(fileName: string, filePath: string): string[] {
		const variants = new Set<string>();
		
		// 1. 文件名本身
		variants.add(fileName);
		
		// 2. 完整路径
		variants.add(filePath);
		
		// 3. 相对路径变体
		variants.add(`./${fileName}`);
		variants.add(`./${filePath}`);
		
		// 4. 常见的附件文件夹路径
		const commonFolders = ['attachments', 'assets', 'images', 'files'];
		for (const folder of commonFolders) {
			variants.add(`${folder}/${fileName}`);
			variants.add(`./${folder}/${fileName}`);
		}
		
		// 5. 如果filePath包含文件夹，提取文件夹路径
		if (filePath.includes('/')) {
			const pathParts = filePath.split('/');
			for (let i = 1; i < pathParts.length; i++) {
				const partialPath = pathParts.slice(i).join('/');
				variants.add(partialPath);
				variants.add(`./${partialPath}`);
			}
		}
		
		return Array.from(variants);
	}
	
	/**
	 * 生成替换模式
	 */
	private generateReplacementPatterns(pathVariant: string, fileName: string, newUrl: string): Array<{pattern: string, replacement: string, isRegex: boolean, description: string}> {
		const patterns = [];
		const escapedPath = this.escapeRegExp(pathVariant);
		const escapedFileName = this.escapeRegExp(fileName);
		const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
		
		// 检查是否是双方括号格式
		if (pathVariant.startsWith('![[') && pathVariant.endsWith(']]')) {
			// Obsidian 双方括号格式的替换
			const bracketContent = pathVariant.slice(3, -2); // 移除 ![[  和 ]]
			
			// 1. 精确匹配双方括号格式
			patterns.push({
				pattern: pathVariant,
				replacement: `![${fileNameWithoutExt}](${newUrl})`,
				isRegex: false,
				description: `Obsidian double bracket exact: ${pathVariant}`
			});
			
			// 2. 转义版本的双方括号匹配
			const escapedBracketContent = this.escapeRegExp(bracketContent);
			patterns.push({
				pattern: `!\\[\\[${escapedBracketContent}\\]\\]`,
				replacement: `![${fileNameWithoutExt}](${newUrl})`,
				isRegex: true,
				description: `Obsidian double bracket regex: ![[${bracketContent}]]`
			});
			
			console.log('🔧 Generated double bracket patterns for:', pathVariant);
		} else {
			// 标准 Markdown 格式的替换
			
			// 1. 精确匹配 ![fileName](pathVariant)
			patterns.push({
				pattern: `![${fileName}](${pathVariant})`,
				replacement: `![${fileName}](${newUrl})`,
				isRegex: false,
				description: `Exact match: ![${fileName}](${pathVariant})`
			});
			
			// 2. 灵活的alt text匹配 ![任意文本](pathVariant)
			patterns.push({
				pattern: `!\\[([^\\]]*)\\]\\(${escapedPath}\\)`,
				replacement: `![${fileName}](${newUrl})`,
				isRegex: true,
				description: `Flexible alt text: ![*](${pathVariant})`
			});
			
			// 3. 路径包含匹配（处理相对路径等）
			if (pathVariant !== fileName) {
				patterns.push({
					pattern: `!\\[([^\\]]*)\\]\\([^\\)]*${escapedFileName}[^\\)]*)`,
					replacement: `![${fileName}](${newUrl})`,
					isRegex: true,
					description: `Path contains filename: *${fileName}*`
				});
			}
		}
		
		return patterns;
	}
	
	/**
	 * 转义正则表达式特殊字符
	 */
	private escapeRegExp(string: string): string {
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}



	/**
	 * 上传选中的图片
	 */
	private async uploadSelectedImage(editor: Editor): Promise<void> {
		const selection = editor.getSelection();
		if (!selection) {
			new Notice('Please select an image link first');
			return;
		}

		// 解析 Markdown 图片链接
		const imageRegex = /!\[([^\]]*)\]\(([^\)]+)\)/;
		const match = selection.match(imageRegex);

		if (!match) {
			new Notice('Selected text is not a valid image link');
			return;
		}

		const [fullMatch, altText, imagePath] = match;

		// 检查是否已经是网络链接
		if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
			new Notice('Image is already uploaded');
			return;
		}

		// 上传图片
		const result = await this.uploader.uploadFile(imagePath);

		if (result.success && result.url) {
			// 替换为新的图片链接
			const newImageMarkdown = `![${altText}](${result.url})`;
			editor.replaceSelection(newImageMarkdown);
			new Notice(`Image uploaded and replaced successfully: ${altText}`);
			console.log('✅ Selected image upload successful:', {
				altText,
				originalPath: imagePath,
				newUrl: result.url
			});
		} else {
			const errorMsg = `Upload failed for selected image: ${result.error}`;
			new Notice(errorMsg, 8000);
			console.error('❌ Selected image upload failed:', {
				altText,
				imagePath,
				error: result.error,
				result
			});
		}
	}

	/**
	 * 上传剪贴板中的图片
	 */
	private async uploadClipboardImage(editor: Editor): Promise<void> {
		try {
			const clipboardData = await navigator.clipboard.read();
			
			for (const item of clipboardData) {
				for (const type of item.types) {
					if (SUPPORTED_IMAGE_TYPES.includes(type)) {
						const blob = await item.getType(type);
						const file = new File([blob], `clipboard_${Date.now()}.png`, { type });
						await this.processImageFile(file, editor);
						return;
					}
				}
			}
			
			new Notice('No image found in clipboard');
			
		} catch (error) {
			console.error('Error reading clipboard:', error);
			new Notice('Failed to read clipboard');
		}
	}

	/**
	 * 切换自动上传功能
	 */
	private async toggleAutoUpload(): Promise<void> {
		const newValue = !this.settings.autoUpload;
		await this.settingsManager.updateSetting('autoUpload', newValue);
		this.settings = this.settingsManager.getSettings();
		
		const status = newValue ? 'enabled' : 'disabled';
		new Notice(`Auto upload ${status}`);
	}

	/**
	 * 检查 uPic 可用性
	 */
	private async checkUPicAvailability() {
		console.log('🔍 Starting uPic availability check...');
		const result = await this.uploader.checkUPicAvailability();
		console.log('📋 uPic availability result:', result);
		
		if (result.available) {
			console.log('✅ uPic is available!');
			new Notice(`uPic is available and ready to use! Path: ${result.path || 'unknown'}`);
		} else {
			console.log('❌ uPic is not available:', result.message);
			new Notice(`uPic is not available: ${result.message}`);
		}
	}

	/**
	 * 获取设置管理器
	 */
	getSettingsManager(): SettingsManager {
		return this.settingsManager;
	}

	/**
	 * 获取上传器
	 */
	getUploader(): UPicUploader {
		return this.uploader;
	}

	/**
	 * 获取当前设置
	 */
	getSettings(): PluginSettings {
		return this.settings;
	}

	/**
	 * 更新设置
	 */
	async updateSettings(newSettings: Partial<PluginSettings>): Promise<void> {
		await this.settingsManager.saveSettings(newSettings);
		this.settings = this.settingsManager.getSettings();
		this.uploader.updateSettings(this.settings);
	}

	/**
	 * 获取状态文本
	 */
	private getStatusText(status: string): string {
		switch (status) {
			case 'available':
				return '✅ 可用';
			case 'not_found':
				return '❌ 未找到';
			case 'not_executable':
				return '⚠️ 不可执行';
			case 'test_failed':
				return '❌ 测试失败';
			default:
				return '❓ 未知状态';
		}
	}

	/**
	 * 处理文件右键菜单
	 */
	private handleFileMenu(menu: Menu, file: TFile): void {
		// 检查是否为图片文件
		if (this.isImageFile(file)) {
			menu.addItem((item) => {
				item
					.setTitle('Upload to uPic')
					.setIcon('upload')
					.onClick(async () => {
						await this.uploadFileFromVault(file);
					});
			});
		}
	}

	/**
	 * 检查文件是否为图片
	 */
	private isImageFile(file: TFile): boolean {
		const extension = file.extension.toLowerCase();
		return this.settings.supportedFormats.includes(extension);
	}

	/**
	 * 从仓库上传文件
	 */
	private async uploadFileFromVault(file: TFile): Promise<void> {
		try {
			// 检查桌面端可用性
			if (!Platform.isDesktop) {
				new Notice('Image upload is only available on desktop');
				return;
			}

			// 显示上传进度提示
			const uploadingNotice = new Notice(`正在上传 ${file.name}...`, 0);

			// 获取文件的完整路径
			const vaultPath = this.app.vault.adapter instanceof FileSystemAdapter ? (this.app.vault.adapter as any).basePath || '' : '';
			const fullPath = join(vaultPath, file.path);

			// 上传图片
			const result = await this.uploader.uploadFile(fullPath);

			// 隐藏上传进度提示
			uploadingNotice.hide();

			if (result.success && result.url) {
				// 上传成功，在所有打开的文档中查找并替换图片链接
				const replacedCount = await this.replaceImageLinkInAllDocuments(file, result.url);
				
				if (replacedCount > 0) {
					new Notice(`图片上传成功并已替换 ${replacedCount} 个引用: ${file.name}`);
					console.log(`✅ Replaced ${replacedCount} image references in documents`);
				} else {
					new Notice(`图片上传成功: ${file.name}\n链接: ${result.url}\n提示: 未在打开的文档中找到该图片的引用`, 8000);
					console.log('⚠️ No image references found in open documents');
				}

				console.log('✅ File upload successful:', {
					fileName: file.name,
					filePath: file.path,
					newUrl: result.url,
					replacedCount: replacedCount
				});
			} else {
				const errorMsg = `上传失败: ${result.error || '未知错误'}`;
				new Notice(errorMsg, 8000);
				console.error('❌ File upload failed:', {
					fileName: file.name,
					filePath: file.path,
					error: result.error,
					result
				});
			}
		} catch (error) {
			console.error('❌ Error uploading file from vault:', error);
			new Notice(`上传文件时发生错误: ${error instanceof Error ? error.message : String(error)}`, 8000);
		}
	}

	/**
	 * 选择并上传本地图片
	 */
	private async selectAndUploadLocalImage(): Promise<void> {
		try {
			// 检查桌面端可用性
			if (!Platform.isDesktop) {
				new Notice('Image upload is only available on desktop');
				return;
			}

			// 创建文件选择器
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = this.settings.supportedFormats.map(format => `.${format}`).join(',');
			input.multiple = false;

			// 监听文件选择
			input.onchange = async (event) => {
				const target = event.target as HTMLInputElement;
				const file = target.files?.[0];
				
				if (!file) {
					return;
				}

				// 验证文件类型
				const extension = file.name.split('.').pop()?.toLowerCase();
				if (!extension || !this.settings.supportedFormats.includes(extension)) {
					new Notice(`不支持的文件格式: ${extension}. 支持的格式: ${this.settings.supportedFormats.join(', ')}`);
					return;
				}

				// 验证文件大小
				if (file.size > PLUGIN_CONSTANTS.MAX_FILE_SIZE) {
					new Notice(`文件太大: ${(file.size / 1024 / 1024).toFixed(2)}MB. 最大支持: ${PLUGIN_CONSTANTS.MAX_FILE_SIZE / 1024 / 1024}MB`);
					return;
				}

				// 获取当前编辑器
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!activeView) {
					new Notice('请先打开一个Markdown文档');
					return;
				}

				// 处理图片上传
				await this.processSelectedImageFile(file, activeView.editor);
			};

			// 触发文件选择对话框
			input.click();

		} catch (error) {
			console.error('❌ Error selecting local image:', error);
			new Notice(`选择图片时发生错误: ${error instanceof Error ? error.message : String(error)}`, 8000);
		}
	}

	/**
	 * 处理选择的图片文件
	 */
	private async processSelectedImageFile(file: File, editor: Editor): Promise<void> {
		try {
			// 显示上传进度提示
			const uploadingNotice = new Notice(`正在上传 ${file.name}...`, 0);

			// 创建临时文件
			const tempFilePath = await this.createTempFile(file);

			// 上传图片
			const result = await this.uploader.uploadFile(tempFilePath);

			// 删除临时文件
			await this.deleteTempFile(tempFilePath);

			// 隐藏上传进度提示
			uploadingNotice.hide();

			if (result.success && result.url) {
				// 插入图片链接到编辑器
				const imageMarkdown = `![${file.name}](${result.url})`;
				editor.replaceSelection(imageMarkdown);

				new Notice(`图片上传成功: ${file.name}`);
				console.log('✅ Selected image upload successful:', {
					fileName: file.name,
					fileSize: file.size,
					newUrl: result.url
				});
			} else {
				const errorMsg = `上传失败: ${result.error || '未知错误'}`;
				new Notice(errorMsg, 8000);
				console.error('❌ Selected image upload failed:', {
					fileName: file.name,
					fileSize: file.size,
					error: result.error,
					result
				});
			}
		} catch (error) {
			console.error('❌ Error processing selected image file:', error);
			new Notice(`处理图片时发生错误: ${error instanceof Error ? error.message : String(error)}`, 8000);
		}
	}
}

// 默认导出插件类 - Obsidian 要求
export default UPicAutoUploaderPlugin;