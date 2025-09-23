import { Editor, MarkdownView, MarkdownFileInfo, Notice, Plugin, TFile } from 'obsidian';
import { UPicAutoUploaderPlugin } from '../main';
import { UploadResult } from './types';

export class CommandManager {
	private plugin: UPicAutoUploaderPlugin;

	constructor(plugin: UPicAutoUploaderPlugin) {
		this.plugin = plugin;
	}

	/**
	 * 注册所有命令
	 */
	registerCommands(): void {
		// 上传选中的图片
		this.plugin.addCommand({
			id: 'upload-selected-image',
			name: 'Upload selected image via uPic',
			hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'u' }],
			editorCallback: (editor: Editor, view: MarkdownView | MarkdownFileInfo) => {
				this.uploadSelectedImage(editor);
			}
		});

		// 上传剪贴板中的图片
		this.plugin.addCommand({
			id: 'upload-clipboard-image',
			name: 'Upload clipboard image via uPic',
			hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'v' }],
			editorCallback: (editor: Editor, view: MarkdownView | MarkdownFileInfo) => {
				this.uploadClipboardImage(editor);
			}
		});

		// 批量上传当前文档中的所有本地图片
		this.plugin.addCommand({
			id: 'upload-all-images',
			name: 'Upload all local images in current document',
			hotkeys: [{ modifiers: ['Mod', 'Shift', 'Alt'], key: 'u' }],
			editorCallback: (editor: Editor, view: MarkdownView | MarkdownFileInfo) => {
				this.uploadAllImages(editor);
			}
		});

		// 切换自动上传功能
		this.plugin.addCommand({
			id: 'toggle-auto-upload',
			name: 'Toggle auto upload',
			hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 't' }],
			callback: () => {
				this.toggleAutoUpload();
			}
		});

		// 打开设置页面
		this.plugin.addCommand({
			id: 'open-settings',
			name: 'Open uPic settings',
			callback: () => {
				this.openSettings();
			}
		});

		// 检查 uPic 状态
		this.plugin.addCommand({
			id: 'check-upic-status',
			name: 'Check uPic status',
			callback: () => {
				this.checkUPicStatus();
			}
		});

		// 上传指定文件
		this.plugin.addCommand({
			id: 'upload-file',
			name: 'Upload file via uPic',
			callback: () => {
				this.uploadFileDialog();
			}
		});
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
		const imageRegex = /!\[([^\]]*)\]\(([^\)]+)\)/g;
		const matches = Array.from(selection.matchAll(imageRegex));

		if (matches.length === 0) {
			new Notice('Selected text does not contain valid image links');
			return;
		}

		const notice = new Notice('Uploading selected images...', 0);
		let uploadedCount = 0;
		let failedCount = 0;

		for (const match of matches) {
			const [fullMatch, altText, imagePath] = match;

			// 检查是否已经是网络链接
			if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
				continue;
			}

			// 上传图片
			const result = await this.plugin.getUploader().uploadFile(imagePath);

			if (result.success && result.url) {
				// 替换为新的图片链接
				const newImageMarkdown = `![${altText}](${result.url})`;
				const newSelection = selection.replace(fullMatch, newImageMarkdown);
				editor.replaceSelection(newSelection);
				uploadedCount++;
			} else {
				failedCount++;
				console.error(`Failed to upload ${imagePath}:`, result.error);
			}
		}

		notice.hide();

		if (uploadedCount > 0) {
			new Notice(`Successfully uploaded ${uploadedCount} image(s)`);
		}
		if (failedCount > 0) {
			new Notice(`Failed to upload ${failedCount} image(s)`);
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
					if (type.startsWith('image/')) {
						const blob = await item.getType(type);
						const file = new File([blob], `clipboard_${Date.now()}.png`, { type });
						
						// 创建临时文件并上传
						const tempFilePath = await this.createTempFile(file);
						const result = await this.plugin.getUploader().uploadFile(tempFilePath);

						if (result.success && result.url) {
							const imageMarkdown = `![${file.name}](${result.url})`;
							editor.replaceSelection(imageMarkdown);
							new Notice('Clipboard image uploaded successfully!');
						} else {
							new Notice(`Upload failed: ${result.error}`);
						}
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
	 * 批量上传当前文档中的所有本地图片
	 */
	private async uploadAllImages(editor: Editor): Promise<void> {
		const content = editor.getValue();
		const imageRegex = /!\[([^\]]*)\]\(([^\)]+)\)/g;
		const matches = Array.from(content.matchAll(imageRegex));

		const localImages = matches.filter(match => {
			const imagePath = match[2];
			return !imagePath.startsWith('http://') && !imagePath.startsWith('https://');
		});

		if (localImages.length === 0) {
			new Notice('No local images found in current document');
			return;
		}

		const notice = new Notice(`Uploading ${localImages.length} images...`, 0);
		let newContent = content;
		let uploadedCount = 0;
		let failedCount = 0;

		for (const match of localImages) {
			const [fullMatch, altText, imagePath] = match;
			
			const result = await this.plugin.getUploader().uploadFile(imagePath);

			if (result.success && result.url) {
				const newImageMarkdown = `![${altText}](${result.url})`;
				newContent = newContent.replace(fullMatch, newImageMarkdown);
				uploadedCount++;
			} else {
				failedCount++;
				console.error(`Failed to upload ${imagePath}:`, result.error);
			}
		}

		// 更新编辑器内容
		if (uploadedCount > 0) {
			editor.setValue(newContent);
		}

		notice.hide();

		if (uploadedCount > 0) {
			new Notice(`Successfully uploaded ${uploadedCount} image(s)`);
		}
		if (failedCount > 0) {
			new Notice(`Failed to upload ${failedCount} image(s)`);
		}
	}

	/**
	 * 切换自动上传功能
	 */
	private async toggleAutoUpload(): Promise<void> {
		const currentSettings = this.plugin.getSettings();
		const newValue = !currentSettings.autoUpload;
		
		await this.plugin.updateSettings({ autoUpload: newValue });
		
		const status = newValue ? 'enabled' : 'disabled';
		new Notice(`Auto upload ${status}`);
	}

	/**
	 * 打开设置页面
	 */
	private openSettings(): void {
		// @ts-ignore
		this.plugin.app.setting.open();
		// @ts-ignore
		this.plugin.app.setting.openTabById(this.plugin.manifest.id);
	}

	/**
	 * 检查 uPic 状态
	 */
	private async checkUPicStatus(): Promise<void> {
		const notice = new Notice('Checking uPic status...', 0);
		
		try {
			const settings = this.plugin.getSettings();
			const isConfigured = this.plugin.getSettingsManager().isConfigured();
			const isUPicAvailable = await this.plugin.getUploader().checkUPicAvailability();
			
			notice.hide();
			
			let status = '📊 uPic Status Report:\n\n';
			status += `🔧 Configuration: ${isConfigured ? '✅ Complete' : '❌ Incomplete'}\n`;
			status += `🚀 uPic Availability: ${isUPicAvailable ? '✅ Available' : '❌ Not Available'}\n`;
			status += `⚡ Auto Upload: ${settings.autoUpload ? '✅ Enabled' : '❌ Disabled'}\n`;
			status += `📁 Supported Formats: ${settings.supportedFormats.join(', ')}\n`;
			status += `⏱️ Upload Timeout: ${settings.uploadTimeout}s\n`;
			status += `🔔 Notifications: ${settings.showNotifications ? '✅ Enabled' : '❌ Disabled'}`;
			
			new Notice(status, 8000);
			
		} catch (error) {
			notice.hide();
			new Notice('❌ Failed to check uPic status');
			console.error('Status check error:', error);
		}
	}

	/**
	 * 上传文件对话框
	 */
	private async uploadFileDialog(): Promise<void> {
		// 创建文件输入元素
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/*';
		input.multiple = true;

		input.onchange = async (event) => {
			const files = (event.target as HTMLInputElement).files;
			if (!files || files.length === 0) {
				return;
			}

			const notice = new Notice(`Uploading ${files.length} file(s)...`, 0);
			let uploadedCount = 0;
			let failedCount = 0;
			const results: string[] = [];

			for (const file of Array.from(files)) {
				const tempFilePath = await this.createTempFile(file);
				const result = await this.plugin.getUploader().uploadFile(tempFilePath);

				if (result.success && result.url) {
					const imageMarkdown = `![${file.name}](${result.url})`;
					results.push(imageMarkdown);
					uploadedCount++;
				} else {
					failedCount++;
					console.error(`Failed to upload ${file.name}:`, result.error);
				}
			}

			notice.hide();

			if (uploadedCount > 0) {
				// 将结果复制到剪贴板
				const resultText = results.join('\n');
				navigator.clipboard.writeText(resultText);
				new Notice(`Successfully uploaded ${uploadedCount} file(s). Markdown links copied to clipboard!`);
			}
			if (failedCount > 0) {
				new Notice(`Failed to upload ${failedCount} file(s)`);
			}
		};

		// 触发文件选择对话框
		input.click();
	}

	/**
	 * 创建临时文件
	 */
	private async createTempFile(file: File): Promise<string> {
		const { writeFile } = require('fs/promises');
		const { join } = require('path');
		const { tmpdir } = require('os');

		const buffer = await file.arrayBuffer();
		const uint8Array = new Uint8Array(buffer);
		
		const tempDir = tmpdir();
		const fileName = `upic_${Date.now()}_${file.name}`;
		const tempFilePath = join(tempDir, fileName);

		await writeFile(tempFilePath, uint8Array);
		return tempFilePath;
	}
}