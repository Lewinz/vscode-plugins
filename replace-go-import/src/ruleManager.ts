import * as vscode from 'vscode';
import * as path from 'path';
import { ReplaceRule, PluginConfig, ProcessResult, ReplacementResult } from './types';

export class RuleManager {
    private config: PluginConfig | null = null;
    private processedFiles: Set<string> = new Set();
    private lastProcessTime: Map<string, number> = new Map();

    constructor() {
        this.refreshConfiguration();
    }

    /**
     * 刷新配置
     */
    refreshConfiguration(): void {
        const vscodeConfig = vscode.workspace.getConfiguration('replace-go-import');
        
        const rawRules = vscodeConfig.get('rules', []);
        const validatedRules = this.validateRules(rawRules);
        
        this.config = {
            enabled: vscodeConfig.get('enabled', true),
            rules: validatedRules,
            showNotifications: vscodeConfig.get('showNotifications', true)
        };

        console.log(`配置已刷新: 启用=${this.config.enabled}, 规则数量=${this.config.rules.length}`);
    }

    /**
     * 验证规则配置
     */
    private validateRules(rawRules: any[]): ReplaceRule[] {
        const validRules: ReplaceRule[] = [];
        
        if (!Array.isArray(rawRules)) {
            console.warn('规则配置不是数组格式');
            return validRules;
        }

        for (let i = 0; i < rawRules.length; i++) {
            const rule = rawRules[i];
            
            if (!rule || typeof rule !== 'object') {
                console.warn(`规则 ${i} 不是有效对象`);
                continue;
            }

            // 验证必需字段
            if (!rule.name || typeof rule.name !== 'string') {
                console.warn(`规则 ${i} 缺少有效的名称`);
                continue;
            }

            if (!rule.from || typeof rule.from !== 'string') {
                console.warn(`规则 "${rule.name}" 缺少有效的源字符串`);
                continue;
            }

            if (typeof rule.to !== 'string') {
                console.warn(`规则 "${rule.name}" 缺少有效的目标字符串`);
                continue;
            }

            // 验证豁免路径
            let exemptPaths: string[] = [];
            if (Array.isArray(rule.exemptPaths)) {
                exemptPaths = rule.exemptPaths.filter((path: any) => typeof path === 'string');
            }

            validRules.push({
                name: rule.name.trim(),
                from: rule.from.trim(),
                to: rule.to,
                exemptPaths,
                enabled: Boolean(rule.enabled)
            });
        }

        return validRules;
    }

    /**
     * 处理文档
     */
    async processDocument(document: vscode.TextDocument): Promise<void> {
        if (!this.config || !this.config.enabled) {
            console.log('插件未启用或配置为空');
            return;
        }

        const filePath = document.uri.fsPath;
        const now = Date.now();
        
        // 防止重复处理（5秒内不重复处理同一文件）
        const lastProcessed = this.lastProcessTime.get(filePath);
        if (lastProcessed && (now - lastProcessed) < 5000) {
            console.log(`文件 ${filePath} 在5秒内已处理过，跳过`);
            return;
        }

        // 检查文件是否在豁免路径中
        if (this.isFileExempt(filePath)) {
            console.log(`文件 ${filePath} 在豁免路径中，跳过处理`);
            return;
        }

        try {
            // 定期清理过期记录
            this.cleanupProcessedFiles();
            
            console.log(`开始处理文件: ${filePath}`);
            const result = this.processText(document.getText(), filePath);
            
            if (result.hasChanges) {
                await this.applyChanges(document, result);
                this.lastProcessTime.set(filePath, now);
                console.log(`文件 ${filePath} 处理完成，应用了 ${result.replacements.length} 个替换`);
            } else {
                console.log(`文件 ${filePath} 无需替换`);
            }
        } catch (error) {
            console.error(`处理文件 ${filePath} 时出错:`, error);
            throw error;
        }
    }

    /**
     * 处理文本内容
     */
    private processText(text: string, filePath: string): ProcessResult {
        if (!this.config) {
            return { hasChanges: false, replacements: [] };
        }

        const lines = text.split('\n');
        const replacements: ReplacementResult[] = [];
        let hasChanges = false;

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            
            // 只处理import行
            if (!this.isImportLine(line)) {
                continue;
            }

            // 应用所有启用的规则
            for (const rule of this.config.rules) {
                if (!rule.enabled) {
                    continue;
                }

                const result = this.applyRule(line, rule, lineIndex);
                if (result) {
                    replacements.push(result);
                    hasChanges = true;
                }
            }
        }

        return { hasChanges, replacements };
    }

    /**
     * 应用单个规则
     */
    private applyRule(line: string, rule: ReplaceRule, lineIndex: number): ReplacementResult | null {
        try {
            // 验证源字符串
            if (!rule.from || rule.from.trim() === '') {
                console.warn(`规则 "${rule.name}" 的源字符串为空`);
                return null;
            }

            // 检查是否包含源字符串
            if (!line.includes(rule.from)) {
                return null;
            }

            // 执行字符串替换（全局替换）
            const replacedLine = line.replace(new RegExp(rule.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), rule.to);
            
            // 检查是否有实际变化
            if (replacedLine === line) {
                return null;
            }

            // 找到替换位置
            const index = line.indexOf(rule.from);
            
            return {
                originalText: line,
                replacedText: replacedLine,
                ruleName: rule.name,
                lineNumber: lineIndex,
                columnStart: index,
                columnEnd: index + rule.from.length
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : '未知错误';
            console.error(`规则 "${rule.name}" 执行失败: ${errorMsg}`);
            
            // 显示用户友好的错误信息
            if (this.config?.showNotifications) {
                vscode.window.showErrorMessage(
                    `规则 "${rule.name}" 执行失败: ${errorMsg}`
                );
            }
            
            return null;
        }
    }

    /**
     * 应用更改到文档
     */
    private async applyChanges(document: vscode.TextDocument, result: ProcessResult): Promise<void> {
        const edit = new vscode.WorkspaceEdit();
        const lines = document.getText().split('\n');

        // 按行号分组替换
        const replacementsByLine = new Map<number, ReplacementResult[]>();
        for (const replacement of result.replacements) {
            if (!replacementsByLine.has(replacement.lineNumber)) {
                replacementsByLine.set(replacement.lineNumber, []);
            }
            replacementsByLine.get(replacement.lineNumber)!.push(replacement);
        }

        // 应用替换
        for (const [lineNumber, lineReplacements] of replacementsByLine) {
            const line = document.lineAt(lineNumber);
            let newLineText = line.text;

            // 按列位置倒序排列，避免位置偏移
            lineReplacements.sort((a, b) => b.columnStart - a.columnStart);

            for (const replacement of lineReplacements) {
                newLineText = replacement.replacedText;
            }

            edit.replace(document.uri, line.range, newLineText);
        }

        const success = await vscode.workspace.applyEdit(edit);
        
        if (success && this.config?.showNotifications) {
            vscode.window.showInformationMessage(
                `已应用 ${result.replacements.length} 个替换规则`,
                '查看详情'
            ).then((selection: string | undefined) => {
                if (selection === '查看详情') {
                    this.showReplacementDetails(result.replacements);
                }
            });
        }
    }

    /**
     * 检查是否为import行
     */
    private isImportLine(line: string): boolean {
        const trimmed = line.trim();
        
        // 检查是否是import语句的开始
        if (trimmed.startsWith('import ') || 
            trimmed.startsWith('import"') ||
            trimmed.startsWith("import'") ||
            trimmed.includes(' import ') ||
            trimmed.includes(' import"') ||
            trimmed.includes(" import'")) {
            return true;
        }
        
        // 检查是否是import块中的内容（包含引号的行）
        // 这种情况适用于多行import块，如：
        // import (
        //     "context"
        //     "fmt"
        //     "github.com/company/repo"
        // )
        if (trimmed.match(/^\s*"[^"]*"\s*$/) || 
            trimmed.match(/^\s*'[^']*'\s*$/) ||
            trimmed.match(/^\s*"[^"]*"\s*\/\/.*$/) ||
            trimmed.match(/^\s*'[^']*'\s*\/\/.*$/)) {
            return true;
        }
        
        return false;
    }

    /**
     * 检查文件是否在豁免路径中
     */
    private isFileExempt(filePath: string): boolean {
        if (!this.config) {
            return false;
        }

        for (const rule of this.config.rules) {
            if (!rule.enabled) {
                continue;
            }

            for (const exemptPath of rule.exemptPaths) {
                if (this.matchPath(filePath, exemptPath)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * 路径匹配（支持简单的通配符）
     */
    private matchPath(filePath: string, pattern: string): boolean {
        // 将通配符模式转换为正则表达式
        const regexPattern = pattern
            .replace(/\*\*/g, '.*')  // ** 匹配任意路径
            .replace(/\*/g, '[^/]*') // * 匹配除/外的任意字符
            .replace(/\?/g, '.');   // ? 匹配单个字符

        try {
            const regex = new RegExp(`^${regexPattern}$`);
            return regex.test(filePath);
        } catch (error) {
            console.error(`路径模式 "${pattern}" 无效:`, error);
            return false;
        }
    }

    /**
     * 显示替换详情
     */
    private showReplacementDetails(replacements: ReplacementResult[]): void {
        const panel = vscode.window.createWebviewPanel(
            'replacementDetails',
            '替换详情',
            vscode.ViewColumn.Two,
            {}
        );

        const html = this.generateDetailsHtml(replacements);
        panel.webview.html = html;
    }

    /**
     * 生成详情HTML
     */
    private generateDetailsHtml(replacements: ReplacementResult[]): string {
        const items = replacements.map(replacement => `
            <div class="replacement-item">
                <div class="replacement-header">
                    <span class="rule-name">${replacement.ruleName}</span>
                    <span class="line-info">第 ${replacement.lineNumber + 1} 行</span>
                </div>
                <div class="replacement-content">
                    <div class="original">
                        <span class="label">原始:</span>
                        <code>${this.escapeHtml(replacement.originalText)}</code>
                    </div>
                    <div class="replaced">
                        <span class="label">替换后:</span>
                        <code>${this.escapeHtml(replacement.replacedText)}</code>
                    </div>
                </div>
            </div>
        `).join('');

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>替换详情</title>
                <style>
                    body { 
                        font-family: var(--vscode-font-family); 
                        padding: 20px; 
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                    }
                    .replacement-item { 
                        margin-bottom: 20px; 
                        padding: 15px; 
                        border: 1px solid var(--vscode-panel-border); 
                        border-radius: 5px; 
                        background-color: var(--vscode-editor-background);
                    }
                    .replacement-header { 
                        display: flex; 
                        justify-content: space-between; 
                        margin-bottom: 10px; 
                    }
                    .rule-name { 
                        font-weight: bold; 
                        color: var(--vscode-textLink-foreground); 
                    }
                    .line-info { 
                        color: var(--vscode-descriptionForeground); 
                    }
                    .replacement-content { 
                        margin-top: 10px; 
                    }
                    .original, .replaced { 
                        margin: 5px 0; 
                    }
                    .label { 
                        font-weight: bold; 
                        margin-right: 10px; 
                    }
                    code { 
                        background-color: var(--vscode-textCodeBlock-background);
                        padding: 2px 4px;
                        border-radius: 3px;
                        font-family: var(--vscode-editor-font-family);
                    }
                </style>
            </head>
            <body>
                <h2>替换详情 (${replacements.length} 项)</h2>
                ${items}
            </body>
            </html>
        `;
    }

    /**
     * HTML转义
     */
    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * 获取当前配置
     */
    getConfig(): PluginConfig | null {
        return this.config;
    }

    /**
     * 清理过期的处理记录
     */
    private cleanupProcessedFiles(): void {
        const now = Date.now();
        const expireTime = 5 * 60 * 1000; // 5分钟过期
        
        for (const [filePath, timestamp] of this.lastProcessTime.entries()) {
            if (now - timestamp > expireTime) {
                this.lastProcessTime.delete(filePath);
            }
        }
    }

    /**
     * 测试规则
     */
    testRule(rule: ReplaceRule, testText: string): { success: boolean; result: string; error?: string } {
        try {
            if (!rule.from || rule.from.trim() === '') {
                return { 
                    success: false, 
                    result: testText, 
                    error: '源字符串为空' 
                };
            }

            const result = testText.replace(new RegExp(rule.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), rule.to);
            return { success: true, result };
        } catch (error) {
            return { 
                success: false, 
                result: testText, 
                error: error instanceof Error ? error.message : '未知错误' 
            };
        }
    }
}
