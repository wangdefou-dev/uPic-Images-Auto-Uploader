import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import { UPicAutoUploaderPlugin } from '../main';
import { PluginSettings, DEFAULT_SETTINGS } from './types';

export class UPicSettingTab extends PluginSettingTab {
	plugin: UPicAutoUploaderPlugin;

	constructor(app: App, plugin: UPicAutoUploaderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// 标题
		containerEl.createEl('h2', { text: 'uPic Auto Uploader Settings' });

		// 基本设置部分
		this.addBasicSettings(containerEl);

		// 上传设置部分
		this.addUploadSettings(containerEl);

		// 高级设置部分
		this.addAdvancedSettings(containerEl);

		// 操作按钮部分
		this.addActionButtons(containerEl);
	}

	/**
	 * 添加基本设置
	 */
	private addBasicSettings(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Basic Settings' });

		// uPic 路径设置
		new Setting(containerEl)
			.setName('uPic Application Path')
			.setDesc('Path to the uPic application executable. Leave empty for auto-detection.')
			.addText(text => text
				.setPlaceholder('/Applications/uPic.app/Contents/MacOS/uPic')
				.setValue(this.plugin.getSettings().upicPath)
				.onChange(async (value) => {
					await this.plugin.updateSettings({ upicPath: value });
				})
			)
			.addButton(button => button
				.setButtonText('Auto Detect')
				.setTooltip('Automatically detect uPic installation')
				.onClick(async () => {
					await this.autoDetectUPicPath();
				})
			)
			.addButton(button => button
				.setButtonText('Test')
				.setTooltip('Test uPic availability')
				.onClick(async () => {
					await this.testUPicConnection();
				})
			);

		// uPic 路径帮助信息
		const pathHelpEl = containerEl.createDiv('upic-path-help');
		pathHelpEl.style.marginBottom = '20px';
		pathHelpEl.style.padding = '10px';
		pathHelpEl.style.backgroundColor = 'var(--background-secondary)';
		pathHelpEl.style.borderRadius = '5px';
		pathHelpEl.style.fontSize = '0.9em';
		
		pathHelpEl.createEl('strong', { text: 'Common uPic Installation Paths:' });
		const pathList = pathHelpEl.createEl('ul');
		pathList.style.margin = '5px 0';
		pathList.style.paddingLeft = '20px';
		
		const commonPaths = [
			'/Applications/uPic.app/Contents/MacOS/uPic (Default macOS)',
			'/usr/local/bin/upic (Homebrew)',
			'/opt/homebrew/bin/upic (Apple Silicon Homebrew)',
			'upic (System PATH)'
		];
		
		commonPaths.forEach(path => {
			pathList.createEl('li', { text: path });
		});

		// 自动上传开关
		new Setting(containerEl)
			.setName('Enable Auto Upload')
			.setDesc('Automatically upload images when pasting or dropping into editor')
			.addToggle(toggle => toggle
				.setValue(this.plugin.getSettings().autoUpload)
				.onChange(async (value) => {
					await this.plugin.updateSettings({ autoUpload: value });
				})
			);

		// 通知开关
		new Setting(containerEl)
			.setName('Show Notifications')
			.setDesc('Show upload progress and result notifications')
			.addToggle(toggle => toggle
				.setValue(this.plugin.getSettings().showNotifications)
				.onChange(async (value) => {
					await this.plugin.updateSettings({ showNotifications: value });
				})
			);
	}

	/**
	 * 添加上传设置
	 */
	private addUploadSettings(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Upload Settings' });

		// 上传超时设置
		new Setting(containerEl)
			.setName('Upload Timeout')
			.setDesc('Upload timeout in seconds (1-300)')
			.addSlider(slider => slider
				.setLimits(1, 300, 1)
				.setValue(this.plugin.getSettings().uploadTimeout)
				.setDynamicTooltip()
				.onChange(async (value) => {
					await this.plugin.updateSettings({ uploadTimeout: value });
				})
			);

		// 删除本地文件开关
		new Setting(containerEl)
			.setName('Delete Local Files')
			.setDesc('Delete temporary local files after successful upload')
			.addToggle(toggle => toggle
				.setValue(this.plugin.getSettings().deleteLocalFile)
				.onChange(async (value) => {
					await this.plugin.updateSettings({ deleteLocalFile: value });
				})
			);

		// 支持的图片格式
		new Setting(containerEl)
			.setName('Supported Image Formats')
			.setDesc('Comma-separated list of supported image file extensions')
			.addTextArea(text => text
				.setPlaceholder('png, jpg, jpeg, gif, bmp, webp, svg')
				.setValue(this.plugin.getSettings().supportedFormats.join(', '))
				.onChange(async (value) => {
					const formats = value
						.split(',')
						.map(f => f.trim().toLowerCase())
						.filter(f => f.length > 0);
					await this.plugin.updateSettings({ supportedFormats: formats });
				})
			);
	}

	/**
	 * 添加高级设置
	 */
	private addAdvancedSettings(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Advanced Settings' });

		// 设置导出
		new Setting(containerEl)
			.setName('Export Settings')
			.setDesc('Export current settings to JSON format')
			.addButton(button => button
				.setButtonText('Export')
				.onClick(() => {
					this.exportSettings();
				})
			);

		// 设置导入
		new Setting(containerEl)
			.setName('Import Settings')
			.setDesc('Import settings from JSON format')
			.addTextArea(text => text
				.setPlaceholder('Paste JSON settings here...')
				.onChange((value) => {
					this.importSettingsText = value;
				})
			)
			.addButton(button => button
				.setButtonText('Import')
				.onClick(async () => {
					await this.importSettings();
				})
			);

		// 重置设置
		new Setting(containerEl)
			.setName('Reset Settings')
			.setDesc('Reset all settings to default values')
			.addButton(button => button
				.setButtonText('Reset')
				.setWarning()
				.onClick(async () => {
					await this.resetSettings();
				})
			);
	}

	/**
	 * 添加操作按钮
	 */
	private addActionButtons(containerEl: HTMLElement): void {
		// Quick Actions 部分（简化版）
		containerEl.createEl('h3', { text: 'Quick Actions' });
		const actionsContainer = containerEl.createDiv('upic-actions-container');

		// 简化的插件信息显示
		const infoContainer = actionsContainer.createDiv('upic-info-container');
		infoContainer.createEl('h4', { text: 'Plugin Status' });
		const infoList = infoContainer.createEl('ul', { cls: 'upic-info-list' });

		// 显示基本状态信息
		const statusInfo = [
			`uPic Path: ${this.plugin.getSettings().upicPath || 'Not configured'}`,
			`Auto Upload: ${this.plugin.getSettings().autoUpload ? 'Enabled' : 'Disabled'}`,
			`Delete Local Files: ${this.plugin.getSettings().deleteLocalFile ? 'Enabled' : 'Disabled'}`
		];

		statusInfo.forEach(info => {
			const listItem = infoList.createEl('li');
			listItem.textContent = `• ${info}`;
		});
	}

	/**
	 * 自动检测 uPic 路径
	 */
	private async autoDetectUPicPath(): Promise<void> {
		const notice = new Notice('Detecting uPic installation...', 0);
		
		try {
			const availabilityResult = await this.plugin.getUploader().checkUPicAvailability();
			notice.hide();
			
			if (availabilityResult.available && availabilityResult.path) {
				// 更新设置中的路径
				await this.plugin.updateSettings({ upicPath: availabilityResult.path });
				
				// 刷新界面显示
				this.display();
				
				new Notice(`✅ uPic detected and configured: ${availabilityResult.path}`, 5000);
			} else {
				new Notice(`❌ uPic not found. ${availabilityResult.message || 'Please install uPic or set path manually.'}`, 8000);
			}
		} catch (error) {
			notice.hide();
			new Notice('❌ Failed to detect uPic installation');
			console.error('uPic detection error:', error);
		}
	}

	/**
	 * 测试 uPic 连接
	 */
	private async testUPicConnection(): Promise<void> {
		const notice = new Notice('Testing uPic connection...', 0);
		
		try {
			const availabilityResult = await this.plugin.getUploader().checkUPicAvailability();
			notice.hide();
			
			if (availabilityResult.available) {
				new Notice(`✅ uPic is available and working!\nPath: ${availabilityResult.path}`, 5000);
			} else {
				new Notice(`❌ uPic is not available.\n${availabilityResult.message || 'Please check the path.'}`, 8000);
			}
		} catch (error) {
			notice.hide();
			new Notice('❌ Failed to test uPic connection');
			console.error('uPic test error:', error);
		}
	}

	/**
	 * 导出设置
	 */
	private exportSettings(): void {
		const settings = this.plugin.getSettingsManager().exportSettings();
		navigator.clipboard.writeText(settings).then(() => {
			new Notice('Settings exported to clipboard!');
		}).catch(() => {
			new Notice('Failed to copy settings to clipboard');
		});
	}

	/**
	 * 导入设置
	 */
	private async importSettings(): Promise<void> {
		if (!this.importSettingsText) {
			new Notice('Please paste settings JSON first');
			return;
		}

		try {
			await this.plugin.getSettingsManager().importSettings(this.importSettingsText);
			new Notice('Settings imported successfully!');
			this.display(); // 刷新界面
		} catch (error) {
			new Notice('Failed to import settings: Invalid JSON format');
			console.error('Import error:', error);
		}
	}

	/**
	 * 重置设置
	 */
	private async resetSettings(): Promise<void> {
		await this.plugin.getSettingsManager().resetSettings();
		new Notice('Settings reset to default values');
		this.display(); // 刷新界面
	}



	private importSettingsText: string = '';
}