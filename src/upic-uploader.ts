import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { Notice, Platform, Plugin } from 'obsidian';
import { PluginSettings, UploadResult, FileInfo } from './types';

const execAsync = promisify(exec);

export class UPicUploader {
	private plugin: Plugin; // Plugin instance for accessing app and vault
	private settings: PluginSettings;
	private detectedUpicPath: string | null = null;
	private lastCheckTime: number = 0;
	private checkInterval: number = 30000; // 30秒检查一次
	private availabilityCache: Map<string, { available: boolean; timestamp: number }> = new Map();
	private cacheTimeout: number = 60000; // 缓存1分钟

	constructor(plugin: Plugin, settings: PluginSettings) {
		this.plugin = plugin;
		this.settings = settings;
		// 启动定期检查
		this.startPeriodicCheck();
	}

	/**
	 * 上传单个文件到 uPic
	 * @param filePath 文件路径
	 * @returns 上传结果
	 */
	async uploadFile(filePath: string): Promise<UploadResult> {
		// 检查是否在桌面端
		if (!Platform.isDesktop) {
			return {
				success: false,
				error: 'File upload is only available on desktop platforms',
				originalPath: filePath
			};
		}
		
		let availableUpicPath: string | null = null;
		try {
			// 获取可用的 uPic 路径
			availableUpicPath = await this.getAvailableUPicPath();
			
			if (!availableUpicPath) {
				const availabilityResult = await this.checkUPicAvailability();
				return {
					success: false,
					error: `uPic is not available. ${availabilityResult.message || 'Please check the path in settings.'}\n\nTroubleshooting:\n1. Make sure uPic is installed\n2. Check if uPic path is correct in settings\n3. Try running uPic manually to verify it works`,
					originalPath: filePath
				};
			}

			// 显示上传通知
			if (this.settings.showNotifications) {
				new Notice('Uploading image via uPic...');
			}

			// 构建 uPic 命令 - 使用正确的参数格式
			const command = availableUpicPath.includes(' ') ? 
				`"${availableUpicPath}" -u "${filePath}" -o url` : 
				`${availableUpicPath} -u "${filePath}" -o url`;
			
			// 执行上传命令
			const { stdout, stderr } = await execAsync(command, {
				timeout: this.settings.uploadTimeout * 1000,
				encoding: 'utf8'
			});

			// 检查是否有错误输出
			if (stderr && stderr.trim()) {
				console.warn('uPic stderr:', stderr);
			}

			// 解析输出获取 URL
			const url = this.parseUploadOutput(stdout);
			
			if (!url) {
				return {
					success: false,
					error: 'Failed to parse upload URL from uPic output',
					originalPath: filePath
				};
			}

			// 显示成功通知
			if (this.settings.showNotifications) {
				new Notice('Image uploaded successfully!');
			}

			return {
				success: true,
				url: url,
				originalPath: filePath
			};

		} catch (error) {
			console.error('uPic upload error:', error);
			
			let errorMessage = 'Unknown upload error';
			if (error instanceof Error) {
				if (error.message.includes('timeout')) {
					errorMessage = 'Upload timeout - please check your network connection';
				} else if (error.message.includes('ENOENT')) {
					errorMessage = 'uPic application not found - please check the path in settings';
				} else {
					errorMessage = error.message;
				}
			}

			// 显示详细错误通知
			if (this.settings.showNotifications) {
				new Notice(`Upload failed: ${errorMessage}`, 8000);
			}

			// 记录详细错误信息用于调试
			console.error('Detailed upload error:', {
				filePath,
				errorMessage,
				originalError: error,
				upicPath: availableUpicPath,
				command: availableUpicPath && availableUpicPath.includes(' ') ? 
					`"${availableUpicPath}" -u "${filePath}" -o url` : 
					`${availableUpicPath || 'upic'} -u "${filePath}" -o url`
			});

			return {
				success: false,
				error: errorMessage,
				originalPath: filePath
			};
		}
	}

	/**
	 * 批量上传多个文件
	 * @param filePaths 文件路径数组
	 * @returns 上传结果数组
	 */
	async uploadFiles(filePaths: string[]): Promise<UploadResult[]> {
		const results: UploadResult[] = [];
		
		for (const filePath of filePaths) {
			const result = await this.uploadFile(filePath);
			results.push(result);
			
			// 如果上传失败，可以选择继续或停止
			if (!result.success) {
				console.warn(`Failed to upload ${filePath}:`, result.error);
			}
		}
		
		return results;
	}

	/**
	 * 解析 uPic 输出获取上传后的 URL
	 * @param output uPic 命令输出
	 * @returns 解析出的 URL 或 null
	 */
	private parseUploadOutput(output: string): string | null {
		if (!output || !output.trim()) {
			return null;
		}

		// uPic 输出格式通常是直接返回 URL
		const lines = output.trim().split('\n');
		
		// 查找包含 http 的行
		for (const line of lines) {
			const trimmedLine = line.trim();
			if (trimmedLine.startsWith('http://') || trimmedLine.startsWith('https://')) {
				return trimmedLine;
			}
		}

		// 如果没找到标准格式，尝试用正则表达式匹配 URL
		const urlRegex = /(https?:\/\/[^\s]+)/g;
		const match = output.match(urlRegex);
		
		if (match && match.length > 0) {
			return match[0];
		}

		return null;
	}

	/**
	 * 检查文件是否为支持的图片格式
	 * @param filePath 文件路径
	 * @returns 是否支持
	 */
	isImageFile(filePath: string): boolean {
		const extension = filePath.split('.').pop()?.toLowerCase();
		return extension ? this.settings.supportedFormats.includes(extension) : false;
	}

	/**
	 * 自动检测 uPic 路径
	 * @returns 检测到的 uPic 路径数组
	 */
	private async detectUPicPath(): Promise<string[]> {
		// Starting enhanced uPic path detection - removed console.log to reduce console pollution
		
		// First check user configured path
		if (this.settings.upicPath && this.settings.upicPath.trim()) {
			// Checking user configured path - removed console.log to reduce console pollution
			const expandedPath = this.expandPath(this.settings.upicPath);
			if (await this.testUPicPath(expandedPath)) {
				// User configured path is valid - removed console.log to reduce console pollution
				return [expandedPath];
			}
			// User configured path is invalid - removed console.log to reduce console pollution
		} else {
			// No user configured path found - removed console.log to reduce console pollution
		}

		// Enhanced common installation paths with more variations
		// Put the most likely path first based on our detection
		const commonPaths = [
			'/Applications/uPic.app/Contents/MacOS/uPic', // Most common macOS installation
			'/Applications/uPic.app/Contents/Resources/uPic',
			'/System/Applications/uPic.app/Contents/MacOS/uPic',
			'/usr/local/bin/upic',
			'/opt/homebrew/bin/upic',
			'/usr/bin/upic',
			'/opt/local/bin/upic',
			'~/Applications/uPic.app/Contents/MacOS/uPic',
			'/Users/' + require('os').userInfo().username + '/Applications/uPic.app/Contents/MacOS/uPic'
		];

		// Checking enhanced common installation paths - removed console.log to reduce console pollution
		for (const path of commonPaths) {
			const expandedPath = this.expandPath(path);
			// Testing common path - removed console.log to reduce console pollution
			if (await this.testUPicPath(expandedPath)) {
				// Found valid uPic at common path - removed console.log to reduce console pollution
				return [expandedPath];
			}
		}

		// Try multiple which/whereis commands
		// Trying system path detection commands - removed console.log to reduce console pollution
		const pathCommands = ['which upic', 'whereis upic', 'type -p upic'];
		
		for (const cmd of pathCommands) {
			try {
				// Running command - removed console.log to reduce console pollution
				const { stdout } = await execAsync(cmd, { timeout: 5000 });
				const detectedPath = stdout.trim().split('\n')[0]; // Take first result
				console.log(`📍 ${cmd} result: ${detectedPath}`);
				
				if (detectedPath && detectedPath !== 'upic not found' && await this.testUPicPath(detectedPath)) {
					// Found uPic via system command - removed console.log to reduce console pollution
					return [detectedPath];
				}
			} catch (error) {
				// Command failed or returned invalid path - removed console.log to reduce console pollution
			}
		}

		// Try to find uPic in PATH environment
		console.log('🔍 Searching in PATH environment...');
		try {
			const pathEnv = process.env.PATH || '';
			const pathDirs = pathEnv.split(':').filter(dir => dir.trim());
			
			for (const dir of pathDirs) {
				const upicPath = require('path').join(dir, 'upic');
				// Testing uPic path - removed console.log to reduce console pollution
				if (await this.testUPicPath(upicPath)) {
					// uPic test successful - removed console.log to reduce console pollution
					return [upicPath];
				}
			}
		} catch (error) {
			console.log(`❌ PATH search failed: ${error}`);
		}

		// No valid uPic installation found - removed console.log to reduce console pollution
		return [];
	}

	private expandPath(path: string): string {
		if (path.startsWith('~/')) {
			return require('path').join(require('os').homedir(), path.slice(2));
		}
		return path;
	}

	/**
	 * 测试指定路径的 uPic 是否可用
	 * @param path uPic 路径
	 * @returns 是否可用
	 */
	private async testUPicPath(path: string): Promise<boolean> {
		if (!path) {
			console.log('❌ Empty path provided');
			return false;
		}
		
		console.log(`🔍 Testing uPic path: ${path}`);
		
		// 检查缓存
		const cachedResult = this.getCachedAvailability(path);
		if (cachedResult !== null) {
			console.log(`📋 Using cached result for ${path}: ${cachedResult}`);
			return cachedResult;
		}
		
		try {
			const expandedPath = this.expandPath(path);
			console.log(`📂 Expanded path: ${expandedPath}`);
			
			// 对于文件路径，检查文件是否存在
			if (expandedPath.includes('/') && !fs.existsSync(expandedPath)) {
				console.log(`❌ File does not exist: ${expandedPath}`);
				this.setCachedAvailability(path, false);
				return false;
			}

			// 检查文件是否可执行（对于Unix系统）
			if (expandedPath.includes('/')) {
				try {
					const fs = require('fs');
					const stats = fs.statSync(expandedPath);
					if (!stats.isFile()) {
						console.log(`❌ Path is not a file: ${expandedPath}`);
						this.setCachedAvailability(path, false);
						return false;
					}
					// 检查文件是否有执行权限
					fs.accessSync(expandedPath, fs.constants.F_OK | fs.constants.X_OK);
				} catch (accessError) {
					console.log(`❌ File not accessible or executable: ${expandedPath}`);
					this.setCachedAvailability(path, false);
					return false;
				}
			}

			// 按优先级尝试多个测试命令
			const testCommands = [
				'--help',
				'--version', 
				'-h',
				'-v'
			];

			for (const flag of testCommands) {
				try {
					const command = expandedPath.includes(' ') ? `"${expandedPath}" ${flag}` : `${expandedPath} ${flag}`;
					console.log(`🧪 Testing with command: ${command}`);
					
					const { stdout, stderr } = await execAsync(command, {
					timeout: 5000,
					encoding: 'utf8'
				});
				
				const output = (stdout + stderr).toLowerCase();
				console.log(`📄 Command output: ${output.substring(0, 200)}...`);
				
				// 扩展关键词检测
				const keywords = [
					'upic', 'upload', 'image', 'picture', 'photo',
					'usage:', 'options:', 'commands:', 'help:',
					'version', 'copyright', 'author'
				];
				
				const hasKeyword = keywords.some(keyword => output.includes(keyword));
				if (hasKeyword) {
					console.log(`✅ uPic detected with command: ${flag}`);
					this.setCachedAvailability(path, true);
					return true;
				}
				
			} catch (cmdError: unknown) {
			const errorMessage = cmdError instanceof Error ? cmdError.message : String(cmdError);
			// Test command failed - removed console.log to reduce console pollution
			
			// 对于uPic，即使命令失败也可能是有效的（比如缺少参数）
			// 检查错误信息来判断是否真的无效
			if (cmdError instanceof Error && cmdError.message) {
				const errorMsg = cmdError.message.toLowerCase();
					const mightBeValid = errorMsg.includes('upic') || 
									   errorMsg.includes('upload') || 
									   errorMsg.includes('missing required options') ||
									   errorMsg.includes('usage') ||
									   errorMsg.includes('help');
					
					if (mightBeValid) {
						console.log(`✅ uPic detected via error message with command: ${flag}`);
						this.setCachedAvailability(path, true);
						return true;
					}
				}
				continue;
			}
			}
			
			console.log(`❌ All test commands failed for: ${expandedPath}`);
			this.setCachedAvailability(path, false);
			return false;
			
		} catch (error) {
			// 对于 uPic，即使命令失败也可能是有效的（比如缺少参数）
			if (error instanceof Error) {
				const errorMsg = error.message.toLowerCase();
				const mightBeValid = errorMsg.includes('upic') || 
								   errorMsg.includes('upload') || 
								   errorMsg.includes('missing required options') ||
								   errorMsg.includes('usage');
				
				console.log(`uPic test error (checking if valid): ${error.message}`);
				console.log(`uPic test error result: ${mightBeValid} for path ${path}`);
				this.setCachedAvailability(path, mightBeValid);
				return mightBeValid;
			}
			
			console.log(`uPic test failed: ${error} for path ${path}`);
			this.setCachedAvailability(path, false);
			return false;
		}
	}

	/**
	 * 获取详细的诊断信息
	 * @returns 诊断信息对象
	 */
	async getDiagnosticInfo(): Promise<{
		status: 'available' | 'not_found' | 'not_executable' | 'configuration_error';
		detectedPaths: string[];
		testedPaths: { path: string; exists: boolean; executable: boolean; testResult: boolean }[];
		suggestions: string[];
		systemInfo: {
			platform: string;
			arch: string;
			homeDir: string;
			pathEnv: string[];
		};
	}> {
		console.log('🔍 Generating diagnostic information...');
		
		const detectedPaths: string[] = [];
		const testedPaths: { path: string; exists: boolean; executable: boolean; testResult: boolean }[] = [];
		const suggestions: string[] = [];
		
		// 收集系统信息
		const systemInfo = {
			platform: process.platform,
			arch: process.arch,
			homeDir: os.homedir(),
			pathEnv: (process.env.PATH || '').split(path.delimiter).filter((p: string) => p.length > 0)
		};
		
		// 检测所有可能的路径
		const userConfigPath = this.settings.upicPath;
		if (userConfigPath) {
			detectedPaths.push(`User configured: ${userConfigPath}`);
		}
		
		// 常见安装路径
		const commonPaths = [
			'/Applications/uPic.app/Contents/MacOS/uPic',
			'/usr/local/bin/upic',
			'/opt/homebrew/bin/upic',
			path.join(os.homedir(), 'Applications/uPic.app/Contents/MacOS/uPic'),
			path.join(os.homedir(), '.local/bin/upic')
		];
		
		detectedPaths.push(...commonPaths.map(p => `Common path: ${p}`));
		
		// 使用 which 命令检测
		try {
			const { stdout } = await execAsync('which upic', { timeout: 3000 });
			if (stdout.trim()) {
				detectedPaths.push(`Which command: ${stdout.trim()}`);
			}
		} catch (error) {
			detectedPaths.push('Which command: not found');
		}
		
		// 测试所有路径
		const allTestPaths = [userConfigPath, ...commonPaths].filter(Boolean) as string[];
		
		for (const testPath of allTestPaths) {
			const expandedPath = this.expandPath(testPath);
			const exists = fs.existsSync(expandedPath);
			let executable = false;
			let testResult = false;
			
			if (exists && process.platform !== 'win32') {
				try {
					const stats = fs.statSync(expandedPath);
					executable = !!(stats.mode & parseInt('111', 8));
				} catch (error) {
					executable = false;
				}
			} else if (exists) {
				executable = true; // Windows 上假设存在即可执行
			}
			
			if (exists && executable) {
				testResult = await this.testUPicPath(testPath);
			}
			
			testedPaths.push({
				path: testPath,
				exists,
				executable,
				testResult
			});
		}
		
		// 生成建议
		const workingPath = testedPaths.find(p => p.testResult);
		let status: 'available' | 'not_found' | 'not_executable' | 'configuration_error';
		
		if (workingPath) {
			status = 'available';
			suggestions.push(`✅ uPic is working at: ${workingPath.path}`);
		} else {
			const existingPaths = testedPaths.filter(p => p.exists);
			const executablePaths = existingPaths.filter(p => p.executable);
			
			if (existingPaths.length === 0) {
				status = 'not_found';
				suggestions.push('❌ uPic not found. Please install uPic first.');
				suggestions.push('📥 Download from: https://github.com/gee1k/uPic/releases');
				suggestions.push('🍺 Or install via Homebrew: brew install upic');
			} else if (executablePaths.length === 0) {
				status = 'not_executable';
				suggestions.push('❌ uPic found but not executable.');
				suggestions.push(`🔧 Make executable: chmod +x "${existingPaths[0].path}"`);
			} else {
				status = 'configuration_error';
				suggestions.push('❌ uPic found but test failed.');
				suggestions.push('🔧 Try reinstalling uPic or check if it\'s corrupted.');
				suggestions.push('📝 Check uPic configuration and permissions.');
			}
		}
		
		// 添加通用建议
		suggestions.push('🔍 Check the plugin settings and update the uPic path if needed.');
		suggestions.push('📋 Enable console logs to see detailed detection process.');
		
		return {
			status,
			detectedPaths,
			testedPaths,
			suggestions,
			systemInfo
		};
	}

	/**
	 * 简单的uPic测试验证
	 * @param quick 是否使用快速测试模式
	 * @returns 测试结果
	 */
	async testUPicSimple(quick: boolean = true): Promise<{
		success: boolean;
		path?: string;
		message: string;
		details?: {
			pathExists: boolean;
			isExecutable: boolean;
			commandTest: boolean;
			responseTime: number;
		};
	}> {
		console.log(`🧪 Starting ${quick ? 'quick' : 'detailed'} uPic test...`);
		const startTime = Date.now();
		
		try {
			// 检查可用性
			const isAvailable = await this.checkUPicAvailability();
			if (!isAvailable) {
				return {
					success: false,
					message: 'uPic is not available. Please check installation and configuration.',
					details: quick ? undefined : {
						pathExists: false,
						isExecutable: false,
						commandTest: false,
						responseTime: Date.now() - startTime
					}
				};
			}
			
			// 获取路径
			const availablePath = await this.getAvailableUPicPath();
			if (!availablePath) {
				return {
					success: false,
					message: 'uPic path detection failed.',
					details: quick ? undefined : {
						pathExists: false,
						isExecutable: false,
						commandTest: false,
						responseTime: Date.now() - startTime
					}
				};
			}
			
			let details;
			if (!quick) {
				// 详细测试
				const expandedPath = this.expandPath(availablePath);
				const pathExists = fs.existsSync(expandedPath);
				let isExecutable = false;
				let commandTest = false;
				
				if (pathExists && process.platform !== 'win32') {
					try {
						const stats = fs.statSync(expandedPath);
						isExecutable = !!(stats.mode & parseInt('111', 8));
					} catch (error) {
						isExecutable = false;
					}
				} else if (pathExists) {
					isExecutable = true;
				}
				
				if (pathExists && isExecutable) {
					commandTest = await this.testUPicPath(availablePath);
				}
				
				details = {
					pathExists,
					isExecutable,
					commandTest,
					responseTime: Date.now() - startTime
				};
			}
			
			return {
				success: true,
				path: availablePath,
				message: `✅ uPic test passed! Path: ${availablePath}`,
				details
			};
			
		} catch (error) {
			console.error('uPic test failed:', error);
			return {
				success: false,
				message: `❌ uPic test failed: ${error instanceof Error ? error.message : String(error)}`,
				details: quick ? undefined : {
					pathExists: false,
					isExecutable: false,
					commandTest: false,
					responseTime: Date.now() - startTime
				}
			};
		}
	}

	/**
	 * 获取可用的 uPic 路径
	 * @returns uPic 路径
	 */
	private async getAvailableUPicPath(): Promise<string | null> {
		console.log('🔍 Getting available uPic path...');
		
		// 如果已经检测过，直接返回缓存结果
		if (this.detectedUpicPath) {
			console.log('📋 Using cached path:', this.detectedUpicPath);
			return this.detectedUpicPath;
		}

		// 执行自动检测
		console.log('🔍 Starting path detection...');
		const detectedPaths = await this.detectUPicPath();
		console.log('📍 Detection result:', detectedPaths);
		
		// 测试每个路径
		for (const path of detectedPaths) {
			console.log(`🧪 Testing path: ${path}`);
			const isValid = await this.testUPicPath(path);
			if (isValid) {
				console.log(`✅ Valid path found: ${path}`);
				this.detectedUpicPath = path;
				return path;
			}
		}
		
		console.log('❌ No valid uPic path found');
		return null;
	}

	/**
	 * 检查 uPic 可用性
	 * @returns 可用性信息
	 */
	async checkUPicAvailability(): Promise<{ available: boolean; path?: string; message?: string }> {
		console.log('🔍 Checking uPic availability...');
		
		// 检查是否需要跳过频繁检查
		const now = Date.now();
		if (this.lastCheckTime > 0 && (now - this.lastCheckTime) < 5000) {
			console.log('⏭️ Skipping frequent check, using cached result');
			const cachedPath = this.detectedUpicPath;
			return {
				available: !!cachedPath,
				path: cachedPath || undefined,
				message: cachedPath ? `uPic is available at: ${cachedPath}` : 'uPic not found. Please install uPic or check the path in settings.'
			};
		}
		
		const path = await this.getAvailableUPicPath();
		console.log('📍 Detected uPic path:', path);
		this.lastCheckTime = now;
		
		if (path) {
			console.log('✅ uPic is available!');
			return {
				available: true,
				path: path,
				message: `uPic is available at: ${path}`
			};
		} else {
			console.log('❌ uPic not found in any location');
			return {
				available: false,
				message: 'uPic not found. Please install uPic or check the path in settings.'
			};
		}
	}

	/**
	 * 获取文件信息
	 * @param file File 对象
	 * @returns 文件信息
	 */
	getFileInfo(file: File): FileInfo {
		return {
			name: file.name,
			path: '', // File 对象没有路径信息
			size: file.size,
			type: file.type,
			lastModified: file.lastModified
		};
	}

	/**
	 * 启动定期检查
	 */
	private startPeriodicCheck(): void {
		setInterval(() => {
			this.performPeriodicCheck();
		}, this.checkInterval);
		
		// 立即执行一次检查
		this.performPeriodicCheck();
	}
	
	/**
	 * 执行定期检查
	 */
	private async performPeriodicCheck(): Promise<void> {
		try {
			const now = Date.now();
			if (now - this.lastCheckTime < this.checkInterval) {
				return; // 避免频繁检查
			}
			
			console.log('🔄 Performing periodic uPic availability check...');
			await this.checkUPicAvailability();
			this.lastCheckTime = now;
			
			// 清理过期缓存
			this.cleanExpiredCache();
		} catch (error) {
			console.error('❌ Periodic check failed:', error);
		}
	}
	
	/**
     * 清理过期缓存
     */
    private cleanExpiredCache(): void {
		const now = Date.now();
		for (const [path, cached] of this.availabilityCache.entries()) {
			if (now - cached.timestamp > this.cacheTimeout) {
				this.availabilityCache.delete(path);
			}
		}
	}
	
	/**
	 * 检查缓存中的可用性
	 */
	private getCachedAvailability(path: string): boolean | null {
		const cached = this.availabilityCache.get(path);
		if (!cached) return null;
		
		const now = Date.now();
		if (now - cached.timestamp > this.cacheTimeout) {
			this.availabilityCache.delete(path);
			return null;
		}
		
		return cached.available;
	}
	
	/**
	 * 缓存可用性结果
	 */
	private setCachedAvailability(path: string, available: boolean): void {
		this.availabilityCache.set(path, {
			available,
			timestamp: Date.now()
		});
	}

	/**
	 * 更新设置
	 * @param newSettings 新的设置
	 */
	updateSettings(newSettings: PluginSettings): void {
		this.settings = newSettings;
		// 清除检测缓存，强制重新检测
		this.detectedUpicPath = null;
		this.availabilityCache.clear();
		this.lastCheckTime = 0;
	}
}