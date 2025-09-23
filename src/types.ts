/**
 * uPic Auto Uploader Plugin Types
 * 定义插件使用的所有类型接口
 */

import { Editor } from 'obsidian';

export interface PluginSettings {
	/** uPic 应用程序路径 */
	upicPath: string;
	/** 是否启用自动上传 */
	autoUpload: boolean;
	/** 上传成功后是否删除本地文件 */
	deleteLocalFile: boolean;
	/** 上传超时时间（秒） */
	uploadTimeout: number;
	/** 是否显示上传进度通知 */
	showNotifications: boolean;
	/** 支持的图片格式 */
	supportedFormats: string[];
}

export interface UploadResult {
	/** 上传是否成功 */
	success: boolean;
	/** 上传后的 URL */
	url?: string;
	/** 错误信息 */
	error?: string;
	/** 原始文件路径 */
	originalPath?: string;
}

export interface UploadProgress {
	/** 当前上传的文件名 */
	fileName: string;
	/** 上传状态 */
	status: 'uploading' | 'success' | 'error';
	/** 进度百分比 */
	progress: number;
	/** 错误信息（如果有） */
	error?: string;
}

export interface PasteEvent {
	/** 粘贴的文件列表 */
	files: File[];
	/** 粘贴事件的原始对象 */
	originalEvent: ClipboardEvent;
	/** 当前编辑器实例 */
	editor: Editor;
}

export interface UPicCommand {
	/** 命令类型 */
	type: 'upload';
	/** 文件路径 */
	filePath: string;
	/** 额外参数 */
	options?: Record<string, any>;
}

export interface FileInfo {
	/** 文件名 */
	name: string;
	/** 文件路径 */
	path: string;
	/** 文件大小（字节） */
	size: number;
	/** 文件类型 */
	type: string;
	/** 最后修改时间 */
	lastModified: number;
}

/** 默认插件设置 */
export const DEFAULT_SETTINGS: PluginSettings = {
	upicPath: '/Applications/uPic.app/Contents/MacOS/uPic',
	autoUpload: true,
	deleteLocalFile: false,
	uploadTimeout: 30,
	showNotifications: true,
	supportedFormats: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg']
};

/** 支持的图片 MIME 类型 */
export const SUPPORTED_IMAGE_TYPES = [
	'image/png',
	'image/jpeg',
	'image/jpg',
	'image/gif',
	'image/bmp',
	'image/webp',
	'image/svg+xml'
];

/** 插件常量 */
export const PLUGIN_CONSTANTS = {
	PLUGIN_ID: 'obsidian-upic-auto-uploader',
	SETTINGS_FILE: 'upic-settings.json',
	TEMP_DIR: '.upic-temp',
	MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
	UPLOAD_TIMEOUT: 30000, // 30 seconds
	NOTIFICATION_DURATION: 3000 // 3 seconds
};