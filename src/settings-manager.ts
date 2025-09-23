import { App, Plugin } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS } from './types';

export class SettingsManager {
	private app: App;
	private plugin: Plugin;
	private settings: PluginSettings;

	constructor(app: App, plugin: Plugin) {
		this.app = app;
		this.plugin = plugin;
		this.settings = { ...DEFAULT_SETTINGS };
	}

	/**
	 * 加载插件设置
	 * @returns 加载的设置对象
	 */
	async loadSettings(): Promise<PluginSettings> {
		try {
			console.log('🔄 Loading uPic settings...');
			const data = await this.plugin.loadData();
			
			if (data && typeof data === 'object') {
				console.log('📋 Found existing settings data:', data);
				// 合并默认设置和用户设置，确保所有字段都存在
				this.settings = {
					...DEFAULT_SETTINGS,
					...data
				};
				
				// 验证设置的有效性
				this.validateSettings();
				console.log('✅ Settings loaded and validated:', this.settings);
			} else {
				console.log('📋 No existing settings found, using defaults');
				// 如果没有保存的数据，使用默认设置
				this.settings = { ...DEFAULT_SETTINGS };
				
				// 保存默认设置
				await this.saveSettings();
				console.log('✅ Default settings saved:', this.settings);
			}
			
			return this.settings;
			
		} catch (error) {
			console.error('❌ Failed to load settings:', error);
			console.log('🔄 Falling back to default settings');
			
			// 如果加载失败，使用默认设置
			this.settings = { ...DEFAULT_SETTINGS };
			
			// Try to save default settings
			try {
				await this.saveSettings();
				console.log('✅ Default settings saved after error');
			} catch (saveError) {
				console.error('❌ Failed to save default settings:', saveError);
			}
			
			return this.settings;
		}
	}

	/**
	 * 保存插件设置
	 * @param newSettings 要保存的设置（可选，如果不提供则保存当前设置）
	 */
	async saveSettings(newSettings?: Partial<PluginSettings>): Promise<void> {
		try {
			console.log('💾 Saving uPic settings...');
			
			if (newSettings) {
				console.log('📝 Applying setting updates:', newSettings);
				const oldSettings = { ...this.settings };
				// 更新设置
				this.settings = {
					...this.settings,
					...newSettings
				};
				
				// 验证设置的有效性
				this.validateSettings();
				console.log('🔄 Settings updated from:', oldSettings, 'to:', this.settings);
			}
			
			// Ensure settings object is valid before saving
			if (!this.settings || typeof this.settings !== 'object') {
				console.error('❌ Invalid settings object, using defaults');
				this.settings = { ...DEFAULT_SETTINGS };
			}
			
			// 保存到文件
			await this.plugin.saveData(this.settings);
			console.log('✅ Settings saved successfully:', this.settings);
			
			// Verify the save by attempting to read back
			try {
				const verifyData = await this.plugin.loadData();
				if (JSON.stringify(verifyData) === JSON.stringify(this.settings)) {
					console.log('✅ Settings save verified successfully');
				} else {
					console.warn('⚠️ Settings save verification failed - data mismatch');
				}
			} catch (verifyError) {
				console.warn('⚠️ Settings save verification failed:', verifyError);
			}
			
		} catch (error) {
			console.error('❌ Failed to save settings:', error);
			throw error;
		}
	}

	/**
	 * 获取当前设置
	 * @returns 当前设置对象的副本
	 */
	getSettings(): PluginSettings {
		return { ...this.settings };
	}

	/**
	 * 更新特定设置项
	 * @param key 设置项的键
	 * @param value 设置项的值
	 */
	async updateSetting<K extends keyof PluginSettings>(
		key: K,
		value: PluginSettings[K]
	): Promise<void> {
		const newSettings = { [key]: value } as Partial<PluginSettings>;
		await this.saveSettings(newSettings);
	}

	/**
	 * 重置设置为默认值
	 */
	async resetSettings(): Promise<void> {
		this.settings = { ...DEFAULT_SETTINGS };
		await this.saveSettings();
	}

	/**
	 * 验证设置的有效性
	 */
	private validateSettings(): void {
		console.log('🔍 Validating settings...');
		let hasChanges = false;
		
		// 验证 uPic 路径
		if (!this.settings.upicPath || typeof this.settings.upicPath !== 'string') {
			console.log('⚠️ Invalid upicPath, using default');
			this.settings.upicPath = DEFAULT_SETTINGS.upicPath;
			hasChanges = true;
		}

		// 验证上传超时
		if (!this.settings.uploadTimeout || typeof this.settings.uploadTimeout !== 'number' || this.settings.uploadTimeout <= 0) {
			console.log('⚠️ Invalid uploadTimeout, using default');
			this.settings.uploadTimeout = DEFAULT_SETTINGS.uploadTimeout;
			hasChanges = true;
		}

		// 验证支持的格式
		if (!Array.isArray(this.settings.supportedFormats) || this.settings.supportedFormats.length === 0) {
			console.log('⚠️ Invalid supportedFormats, using default');
			this.settings.supportedFormats = [...DEFAULT_SETTINGS.supportedFormats];
			hasChanges = true;
		} else {
			// 确保所有格式都是有效的字符串
			const validFormats = this.settings.supportedFormats.filter(format => 
				typeof format === 'string' && format.trim().length > 0
			);
			if (validFormats.length !== this.settings.supportedFormats.length) {
				console.log('⚠️ Some supportedFormats are invalid, filtering');
				this.settings.supportedFormats = validFormats.length > 0 ? validFormats : [...DEFAULT_SETTINGS.supportedFormats];
				hasChanges = true;
			}
		}

		// 验证布尔值设置
		if (typeof this.settings.autoUpload !== 'boolean') {
			console.log('⚠️ Invalid autoUpload, using default');
			this.settings.autoUpload = DEFAULT_SETTINGS.autoUpload;
			hasChanges = true;
		}

		if (typeof this.settings.deleteLocalFile !== 'boolean') {
			console.log('⚠️ Invalid deleteLocalFile, using default');
			this.settings.deleteLocalFile = DEFAULT_SETTINGS.deleteLocalFile;
			hasChanges = true;
		}

		if (typeof this.settings.showNotifications !== 'boolean') {
			console.log('⚠️ Invalid showNotifications, using default');
			this.settings.showNotifications = DEFAULT_SETTINGS.showNotifications;
			hasChanges = true;
		}
		
		if (hasChanges) {
			console.log('✅ Settings validation completed with corrections');
		} else {
			console.log('✅ Settings validation completed - all valid');
		}
	}

	/**
	 * 导出设置为 JSON 字符串
	 * @returns JSON 格式的设置字符串
	 */
	exportSettings(): string {
		return JSON.stringify(this.settings, null, 2);
	}

	/**
	 * 从 JSON 字符串导入设置
	 * @param jsonString JSON 格式的设置字符串
	 */
	async importSettings(jsonString: string): Promise<void> {
		try {
			const importedSettings = JSON.parse(jsonString);
			
			// 验证导入的设置格式
			if (typeof importedSettings !== 'object' || importedSettings === null) {
				throw new Error('Invalid settings format');
			}
			
			// 合并设置
			const newSettings = {
				...DEFAULT_SETTINGS,
				...importedSettings
			};
			
			// 保存新设置
			await this.saveSettings(newSettings);
			
		} catch (error) {
			console.error('Failed to import settings:', error);
			throw new Error('Failed to import settings: Invalid JSON format');
		}
	}

	/**
	 * 检查设置是否已配置完成
	 * @returns 是否配置完成
	 */
	isConfigured(): boolean {
		return !!
			this.settings.upicPath && 
			this.settings.upicPath !== DEFAULT_SETTINGS.upicPath;
	}

	/**
	 * 获取设置摘要信息
	 * @returns 设置摘要
	 */
	getSettingsSummary(): Record<string, any> {
		return {
			upicConfigured: this.isConfigured(),
			autoUpload: this.settings.autoUpload,
			supportedFormats: this.settings.supportedFormats.length,
			uploadTimeout: this.settings.uploadTimeout,
			notifications: this.settings.showNotifications
		};
	}
}