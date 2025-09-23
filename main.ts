import { Plugin, Editor, MarkdownView, MarkdownFileInfo, Notice, Platform, FileSystemAdapter } from 'obsidian';
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

		// 注册上传命令
		this.addCommand({
			id: 'upload-file',
			name: 'Upload file to uPic',
			callback: async () => {
				try {
					// 这里应该通过文件选择器让用户选择文件
					new Notice('Please use drag & drop or paste to upload images');
				} catch (error) {
					console.error('Upload failed:', error);
					new Notice(`Upload failed: ${error instanceof Error ? error.message : String(error)}`);
				}
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
		// 监听粘贴事件
		this.registerDomEvent(document, 'paste', (evt: ClipboardEvent) => {
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
		});

		// 监听拖拽事件
		this.registerDomEvent(document, 'drop', (evt: DragEvent) => {
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
		});
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

		// 阻止默认粘贴行为
		evt.preventDefault();

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
	 * 处理图片文件（粘贴）
	 */
	private async processImageFile(file: File, editor: Editor): Promise<void> {
		try {
			// 创建临时文件 - 仅在桌面端可用
		if (!Platform.isDesktop) {
			new Notice('Image upload is only available on desktop');
			return;
		}
		const tempFilePath = await this.createTempFile(file);

			// 上传图片
			const result = await this.uploader.uploadFile(tempFilePath);

			if (result.success && result.url) {
				// 插入 Markdown 图片链接
				const imageMarkdown = `![${file.name}](${result.url})`;
				editor.replaceSelection(imageMarkdown);

				// 显示成功通知
				if (this.settings.showNotifications) {
					new Notice(`Image uploaded successfully: ${file.name}`);
				}
				console.log('✅ Image upload successful:', {
					fileName: file.name,
					url: result.url,
					tempFilePath
				});

				// 删除临时文件
				await this.deleteTempFile(tempFilePath);
			} else {
				// 上传失败，插入本地图片链接作为备选
				const imageMarkdown = `![${file.name}](${tempFilePath})`;
				editor.replaceSelection(imageMarkdown);

				// 显示详细错误信息
				const errorMsg = `Upload failed for ${file.name}: ${result.error}`;
				new Notice(errorMsg, 8000);
				console.error('❌ Image upload failed:', {
					fileName: file.name,
					error: result.error,
					tempFilePath,
					result
				});
			}

		} catch (error) {
			console.error('Error processing image file:', error);
			new Notice('Failed to process image file');
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
	 * 在文档中替换图片链接 - 改进版本，支持多种匹配模式
	 */
	private async replaceImageLinkInDocument(editor: Editor, oldPath: string, newUrl: string, fileName: string): Promise<boolean> {
		try {
			const content = editor.getValue();
			console.log('🔄 Starting image link replacement:', {
				oldPath,
				newUrl,
				fileName,
				contentLength: content.length
			});
			
			// 方法1: 精确匹配
			const exactMatch = `![${fileName}](${oldPath})`;
			if (content.includes(exactMatch)) {
				const newContent = content.replace(exactMatch, `![${fileName}](${newUrl})`);
				editor.setValue(newContent);
				console.log('✅ Image link replaced with exact match');
				return true;
			}
			
			// 方法2: 灵活匹配文件名（处理路径差异）
			const fileNameRegex = new RegExp(`!\\[([^\\]]*)\\]\\([^\\)]*${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\)]*)`, 'g');
			const flexibleContent = content.replace(fileNameRegex, `![${fileName}](${newUrl})`);
			if (flexibleContent !== content) {
				editor.setValue(flexibleContent);
				console.log('✅ Image link replaced with flexible filename matching');
				return true;
			}
			
			// 方法3: 基于路径的正则匹配
			const escapedPath = oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const pathRegex = new RegExp(`!\\[([^\\]]*)\\]\\(${escapedPath}\\)`, 'g');
			const pathContent = content.replace(pathRegex, `![${fileName}](${newUrl})`);
			if (pathContent !== content) {
				editor.setValue(pathContent);
				console.log('✅ Image link replaced with path regex matching');
				return true;
			}
			
			// 方法4: 最宽松的匹配（只匹配文件名，忽略路径）
			const looseRegex = new RegExp(`!\\[([^\\]]*)\\]\\([^\\)]*\\b${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b[^\\)]*)`, 'g');
			const looseContent = content.replace(looseRegex, `![${fileName}](${newUrl})`);
			if (looseContent !== content) {
				editor.setValue(looseContent);
				console.log('✅ Image link replaced with loose matching');
				return true;
			}
			
			console.warn('⚠️ No matching image link found to replace:', {
				exactMatch,
				oldPath,
				fileName,
				contentPreview: content.substring(0, 200) + '...'
			});
			return false;
			
		} catch (error) {
			console.error('Error replacing image link in document:', error);
			return false;
		}
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
}

// 默认导出插件类 - Obsidian 要求
export default UPicAutoUploaderPlugin;