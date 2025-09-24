import * as vscode from 'vscode';
import { RuleManager } from './ruleManager';
import { ReplaceRule } from './types';

interface WebviewMessage {
    command: string;
    rules?: ReplaceRule[];
    rule?: ReplaceRule;
    testText?: string;
    prompt?: string;
    placeholder?: string;
    value?: string;
    ruleIndex?: number;
    testCases?: Array<{name: string, description: string, content: string}>;
}

export class ConfigUI {
    private ruleManager: RuleManager;
    private panel: vscode.WebviewPanel | undefined;

    constructor(ruleManager: RuleManager) {
        this.ruleManager = ruleManager;
    }

    /**
     * 打开设置界面
     */
    openSettings(): void {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'replaceGoImportSettings',
            'Replace Go Import 设置',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getWebviewContent();
        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });

        // 处理来自webview的消息
        this.panel.webview.onDidReceiveMessage(
            async (message: WebviewMessage) => {
                switch (message.command) {
                    case 'saveRules':
                        if (message.rules) {
                            await this.saveRules(message.rules);
                        }
                        break;
                    case 'testRule':
                        if (message.rule && message.testText) {
                            await this.testRule(message.rule, message.testText);
                        }
                        break;
                    case 'getCommonPatterns':
                        this.sendCommonPatterns();
                        break;
                    case 'showInputBox':
                        await this.showInputBox(message);
                        break;
                    case 'testAllCases':
                        await this.testAllCases(message);
                        break;
                    case 'testAllCasesWithRule':
                        await this.testAllCasesWithRule(message);
                        break;
                    case 'testRuleDirect':
                        await this.testRuleDirect(message);
                        break;
                }
            }
        );
    }

    /**
     * 测试规则
     */
    async testRules(): Promise<void> {
        const config = this.ruleManager.getConfig();
        if (!config) {
            vscode.window.showErrorMessage('无法获取配置');
            return;
        }

        // 提供多种测试用例
        const testCases = this.getTestCases();
        const selectedCase = await vscode.window.showQuickPick(
            testCases.map(case_ => ({
                label: case_.name,
                description: case_.description,
                detail: case_.content.substring(0, 100) + '...',
                value: case_.content
            })),
            {
                placeHolder: '选择测试用例',
                title: '选择要测试的import格式'
            }
        );

        if (!selectedCase) {
            return;
        }

        const results = config.rules.map(rule => {
            const testResult = this.ruleManager.testRule(rule, selectedCase.value);
            return {
                rule: rule,
                result: testResult
            };
        });

        this.showTestResults(selectedCase.value, results);
    }

    /**
     * 保存规则
     */
    private async saveRules(rules: ReplaceRule[]): Promise<void> {
        try {
            // 验证规则
            const validatedRules = this.validateRules(rules);
            
            if (validatedRules.length !== rules.length) {
                const invalidCount = rules.length - validatedRules.length;
                vscode.window.showWarningMessage(
                    `保存完成，但有 ${invalidCount} 个规则因格式错误被忽略`
                );
            }

            const config = vscode.workspace.getConfiguration('replace-go-import');
            await config.update('rules', validatedRules, vscode.ConfigurationTarget.Global);
            
            this.ruleManager.refreshConfiguration();
            
            vscode.window.showInformationMessage(
                `已保存 ${validatedRules.length} 个有效规则`
            );
        } catch (error) {
            console.error('保存规则时出错:', error);
            vscode.window.showErrorMessage(`保存规则失败: ${error}`);
        }
    }

    /**
     * 验证规则
     */
    private validateRules(rules: ReplaceRule[]): ReplaceRule[] {
        const validRules: ReplaceRule[] = [];
        
        for (const rule of rules) {
            // 基本验证
            if (!rule.name || !rule.name.trim()) {
                continue;
            }
            
            if (!rule.from || !rule.from.trim()) {
                continue;
            }

            validRules.push({
                name: rule.name.trim(),
                from: rule.from.trim(),
                to: rule.to || '',
                exemptPaths: Array.isArray(rule.exemptPaths) ? rule.exemptPaths : [],
                enabled: Boolean(rule.enabled)
            });
        }

        return validRules;
    }

    /**
     * 测试单个规则
     */
    private async testRule(rule: ReplaceRule, testText: string): Promise<void> {
        const result = this.ruleManager.testRule(rule, testText);
        
        if (result.success) {
            vscode.window.showInformationMessage(
                `规则 "${rule.name}" 测试成功`,
                '查看结果'
            ).then((selection: string | undefined) => {
                if (selection === '查看结果') {
                    this.showSingleTestResult(rule, testText, result.result);
                }
            });
        } else {
            vscode.window.showErrorMessage(
                `规则 "${rule.name}" 测试失败: ${result.error}`
            );
        }
    }

    /**
     * 显示输入框
     */
    private async showInputBox(message: WebviewMessage): Promise<void> {
        if (message.ruleIndex !== undefined) {
            // 获取所有测试用例
            const testCases = this.getTestCases();
            
            // 发送消息给WebView，让它获取规则数据并测试所有用例
            this.panel?.webview.postMessage({
                command: 'testAllCases',
                ruleIndex: message.ruleIndex,
                testCases: testCases
            });
        }
    }

    /**
     * 测试所有用例
     */
    private async testAllCases(message: WebviewMessage): Promise<void> {
        if (!message.ruleIndex) {
            return;
        }

        // 获取所有测试用例
        const testCases = this.getTestCases();
        
        // 发送消息给WebView，让它获取规则数据并测试所有用例
        this.panel?.webview.postMessage({
            command: 'getRuleDataForAllTests',
            ruleIndex: message.ruleIndex,
            testCases: testCases
        });
    }

    /**
     * 使用规则测试所有用例
     */
    private async testAllCasesWithRule(message: WebviewMessage): Promise<void> {
        console.log('收到测试请求:', message.rule, message.testCases?.length);
        
        if (!message.rule || !message.testCases) {
            console.error('缺少规则或测试用例:', message.rule, message.testCases);
            return;
        }

        // 测试所有用例
        const results = message.testCases.map(testCase => {
            const testResult = this.ruleManager.testRule(message.rule!, testCase.content);
            return {
                testCase: testCase,
                result: testResult
            };
        });

        console.log('测试完成，结果数量:', results.length);

        // 显示综合测试结果
        this.showAllTestResults(message.rule, results);
    }

    /**
     * 直接测试规则
     */
    private async testRuleDirect(message: WebviewMessage): Promise<void> {
        console.log('收到直接测试请求:', message.rule);
        
        if (!message.rule) {
            console.error('缺少规则:', message.rule);
            return;
        }

        try {
            // 获取所有测试用例，使用用户的A规则
            const testCases = this.getTestCases(message.rule.from);
            
            // 测试所有用例
            const results = testCases.map(testCase => {
                const testResult = this.ruleManager.testRule(message.rule!, testCase.content);
                return {
                    testCase: testCase,
                    result: testResult
                };
            });

            console.log('测试完成，结果数量:', results.length);

            // 显示综合测试结果
            this.showAllTestResults(message.rule, results);
        } catch (error) {
            console.error('测试过程中出错:', error);
            vscode.window.showErrorMessage(`测试失败: ${error}`);
        }
    }

    /**
     * 发送常见模式
     */
    private sendCommonPatterns(): void {
        const patterns = this.getCommonPatterns();
        this.panel?.webview.postMessage({
            command: 'commonPatterns',
            patterns: patterns
        });
    }

    /**
     * 获取测试用例
     */
    private getTestCases(fromPath: string = "github.com/company/repo"): Array<{name: string, description: string, content: string}> {
        return [
            {
                name: "单行import",
                description: "简单的单行import语句",
                content: `import "${fromPath}"`
            },
            {
                name: "多行import块",
                description: "包含多个包的多行import块",
                content: `import (
    "context"
    "fmt"
    "${fromPath}"
    "github.com/company/another-repo"
)`
            },
            {
                name: "带注释的import",
                description: "import语句中包含注释",
                content: `import (
    "context"
    "fmt"
    "${fromPath}" // 这是注释
    "github.com/company/another-repo"
)`
            },
            {
                name: "分组import",
                description: "按功能分组的import块",
                content: `import (
    "context"
    "fmt"
    "time"

    "github.com/example/third-party-lib"
    "${fromPath}"
    "${fromPath}/cmd/client/auth"
    "${fromPath}/internal/logic/errors"
    "${fromPath}/internal/model/usermodel"
    "${fromPath}/internal/svc"
    "${fromPath}/internal/types"
    "${fromPath}/common/errorx"
    "${fromPath}/common/errorx/errorcode"
    "${fromPath}/common/utils/timeutil"
    "${fromPath}/sharedmodel"

    "github.com/example/framework/core/logx"
)`
            },
            {
                name: "混合格式",
                description: "包含单行和多行import的混合格式",
                content: `import "context"
import "fmt"
import (
    "${fromPath}"
    "github.com/company/another-repo"
)`
            },
            {
                name: "带别名的import",
                description: "包含包别名的import语句",
                content: `import (
    "context"
    "fmt"
    repo "${fromPath}"
    another "github.com/company/another-repo"
)`
            },
            {
                name: "点导入",
                description: "使用点导入的import语句",
                content: `import (
    "context"
    "fmt"
    . "${fromPath}"
    _ "github.com/company/another-repo"
)`
            },
            {
                name: "版本化包",
                description: "包含版本号的包导入",
                content: `import (
    "context"
    "fmt"
    "${fromPath}/v2"
    "github.com/company/another-repo/v1.0.0"
)`
            }
        ];
    }

    /**
     * 获取常见模式
     */
    private getCommonPatterns(): Array<{name: string, pattern: string, description: string}> {
        return [
            {
                name: "GitHub仓库",
                pattern: "github\\.com/company/repo",
                description: "匹配特定的GitHub仓库"
            },
            {
                name: "公司所有仓库",
                pattern: "github\\.com/company/.*",
                description: "匹配公司下的所有仓库"
            },
            {
                name: "内部包",
                pattern: ".*/internal/.*",
                description: "匹配所有internal包"
            },
            {
                name: "版本化包",
                pattern: "github\\.com/.*/v\\d+",
                description: "匹配带版本号的包"
            },
            {
                name: "本地路径",
                pattern: "\\./.*",
                description: "匹配相对路径"
            },
            {
                name: "绝对路径",
                pattern: "/.*",
                description: "匹配绝对路径"
            }
        ];
    }

    /**
     * 显示测试结果
     */
    private showTestResults(testText: string, results: Array<{rule: ReplaceRule, result: any}>): void {
        const panel = vscode.window.createWebviewPanel(
            'testResults',
            '规则测试结果',
            vscode.ViewColumn.Two,
            {}
        );

        const items = results.map(({rule, result}) => `
            <div class="test-item ${result.success ? 'success' : 'error'}">
                <div class="test-header">
                    <span class="rule-name">${rule.name}</span>
                    <span class="status">${result.success ? '✓ 成功' : '✗ 失败'}</span>
                </div>
                <div class="test-content">
                    <div class="original">
                        <span class="label">原始:</span>
                        <code>${this.escapeHtml(testText)}</code>
                    </div>
                    <div class="result">
                        <span class="label">结果:</span>
                        <code>${this.escapeHtml(result.result)}</code>
                    </div>
                    ${result.error ? `<div class="error">错误: ${this.escapeHtml(result.error)}</div>` : ''}
                </div>
            </div>
        `).join('');

        panel.webview.html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>规则测试结果</title>
                <style>
                    body { 
                        font-family: var(--vscode-font-family); 
                        padding: 20px; 
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                    }
                    .test-item { 
                        margin-bottom: 20px; 
                        padding: 15px; 
                        border-radius: 5px; 
                        background-color: var(--vscode-editor-background);
                    }
                    .test-item.success { 
                        border: 1px solid var(--vscode-testing-iconPassed); 
                    }
                    .test-item.error { 
                        border: 1px solid var(--vscode-testing-iconFailed); 
                    }
                    .test-header { 
                        display: flex; 
                        justify-content: space-between; 
                        margin-bottom: 10px; 
                    }
                    .rule-name { 
                        font-weight: bold; 
                    }
                    .status { 
                        font-weight: bold; 
                    }
                    .success .status { 
                        color: var(--vscode-testing-iconPassed); 
                    }
                    .error .status { 
                        color: var(--vscode-testing-iconFailed); 
                    }
                    .test-content { 
                        margin-top: 10px; 
                    }
                    .original, .result { 
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
                    .error { 
                        color: var(--vscode-testing-iconFailed); 
                        margin-top: 5px; 
                    }
                </style>
            </head>
            <body>
                <h2>规则测试结果</h2>
                <div class="test-text">
                    <strong>测试文本:</strong> <code>${this.escapeHtml(testText)}</code>
                </div>
                ${items}
            </body>
            </html>
        `;
    }

    /**
     * 显示所有测试结果
     */
    private showAllTestResults(rule: ReplaceRule, results: Array<{testCase: any, result: any}>): void {
        const panel = vscode.window.createWebviewPanel(
            'allTestResults',
            `规则测试结果: ${rule.name}`,
            vscode.ViewColumn.Two,
            {}
        );

        const items = results.map(({testCase, result}) => `
            <div class="test-item ${result.success ? 'success' : 'error'}">
                <div class="test-header">
                    <span class="test-case-name">${testCase.name}</span>
                    <span class="status">${result.success ? '✓ 成功' : '✗ 失败'}</span>
                </div>
                <div class="test-description">${testCase.description}</div>
                <div class="test-content">
                    <div class="original">
                        <span class="label">原始:</span>
                        <pre class="code-block">${this.escapeHtml(testCase.content)}</pre>
                    </div>
                    <div class="result">
                        <span class="label">结果:</span>
                        <pre class="code-block">${this.escapeHtml(result.result)}</pre>
                    </div>
                    ${result.error ? `<div class="error">错误: ${this.escapeHtml(result.error)}</div>` : ''}
                </div>
            </div>
        `).join('');

        panel.webview.html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>规则测试结果</title>
                <style>
                    body { 
                        font-family: var(--vscode-font-family); 
                        padding: 20px; 
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                    }
                    .test-item { 
                        margin-bottom: 20px; 
                        padding: 15px; 
                        border-radius: 5px; 
                        background-color: var(--vscode-editor-background);
                    }
                    .test-item.success { 
                        border: 1px solid var(--vscode-testing-iconPassed); 
                    }
                    .test-item.error { 
                        border: 1px solid var(--vscode-testing-iconFailed); 
                    }
                    .test-header { 
                        display: flex; 
                        justify-content: space-between; 
                        margin-bottom: 10px; 
                    }
                    .test-case-name { 
                        font-weight: bold; 
                        color: var(--vscode-textLink-foreground);
                    }
                    .test-description {
                        color: var(--vscode-descriptionForeground);
                        font-size: 12px;
                        margin-bottom: 10px;
                    }
                    .status { 
                        font-weight: bold; 
                    }
                    .success .status { 
                        color: var(--vscode-testing-iconPassed); 
                    }
                    .error .status { 
                        color: var(--vscode-testing-iconFailed); 
                    }
                    .test-content { 
                        margin-top: 10px; 
                    }
                    .original, .result { 
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
                        word-break: break-all;
                    }
                    .code-block {
                        background-color: var(--vscode-textCodeBlock-background);
                        padding: 10px;
                        border-radius: 5px;
                        font-family: var(--vscode-editor-font-family);
                        font-size: 12px;
                        line-height: 1.4;
                        white-space: pre-wrap;
                        word-wrap: break-word;
                        border: 1px solid var(--vscode-panel-border);
                        margin: 5px 0;
                        overflow-x: auto;
                    }
                    .error { 
                        color: var(--vscode-testing-iconFailed); 
                        margin-top: 5px; 
                    }
                </style>
            </head>
            <body>
                <h2>规则测试结果: ${rule.name}</h2>
                <div class="rule-info">
                    <strong>规则:</strong> ${this.escapeHtml(rule.from)} → ${this.escapeHtml(rule.to)}
                </div>
                ${items}
            </body>
            </html>
        `;
    }

    /**
     * 显示单个测试结果
     */
    private showSingleTestResult(rule: ReplaceRule, testText: string, result: string): void {
        const panel = vscode.window.createWebviewPanel(
            'singleTestResult',
            `规则测试: ${rule.name}`,
            vscode.ViewColumn.Two,
            {}
        );

        panel.webview.html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>规则测试结果</title>
                <style>
                    body { 
                        font-family: var(--vscode-font-family); 
                        padding: 20px; 
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                    }
                    .test-item { 
                        margin-bottom: 20px; 
                        padding: 15px; 
                        border: 1px solid var(--vscode-panel-border); 
                        border-radius: 5px; 
                        background-color: var(--vscode-editor-background);
                    }
                    .rule-info { 
                        margin-bottom: 15px; 
                    }
                    .rule-name { 
                        font-weight: bold; 
                        color: var(--vscode-textLink-foreground); 
                    }
                    .rule-pattern { 
                        margin: 5px 0; 
                        font-family: var(--vscode-editor-font-family);
                        background-color: var(--vscode-textCodeBlock-background);
                        padding: 5px;
                        border-radius: 3px;
                    }
                    .test-content { 
                        margin-top: 10px; 
                    }
                    .original, .result { 
                        margin: 10px 0; 
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
                <h2>规则测试结果</h2>
                <div class="test-item">
                    <div class="rule-info">
                        <div class="rule-name">${rule.name}</div>
                        <div class="rule-pattern">${this.escapeHtml(rule.from)} → ${this.escapeHtml(rule.to)}</div>
                    </div>
                    <div class="test-content">
                        <div class="original">
                            <span class="label">原始:</span>
                            <code>${this.escapeHtml(testText)}</code>
                        </div>
                        <div class="result">
                            <span class="label">结果:</span>
                            <code>${this.escapeHtml(result)}</code>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * 获取webview内容
     */
    private getWebviewContent(): string {
        const config = this.ruleManager.getConfig();
        const rules = config?.rules || [];
        const commonPatterns = this.getCommonPatterns();

        return `
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Replace Go Import 设置</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        color: var(--vscode-editor-foreground);
                        background-color: var(--vscode-editor-background);
                        padding: 20px;
                        margin: 0;
                    }
                    .container {
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    .header {
                        margin-bottom: 30px;
                        padding-bottom: 20px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                    }
                    .section {
                        margin-bottom: 30px;
                        padding: 20px;
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 5px;
                        background-color: var(--vscode-editor-background);
                    }
                    .section-title {
                        font-size: 18px;
                        font-weight: bold;
                        margin-bottom: 15px;
                        color: var(--vscode-textLink-foreground);
                    }
                    .form-group {
                        margin-bottom: 15px;
                    }
                    .form-label {
                        display: block;
                        margin-bottom: 5px;
                        font-weight: bold;
                    }
                    .form-input {
                        width: 100%;
                        padding: 8px;
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 3px;
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        font-family: var(--vscode-font-family);
                    }
                    .rule-name-input {
                        width: 50%;
                    }
                    .form-textarea {
                        width: 100%;
                        height: 60px;
                        padding: 8px;
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 3px;
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        font-family: var(--vscode-font-family);
                        resize: vertical;
                    }
                    .form-checkbox {
                        margin-right: 8px;
                    }
                    .form-help {
                        margin-top: 8px;
                        padding: 8px 12px;
                        background-color: var(--vscode-textBlockQuote-background);
                        border-left: 3px solid var(--vscode-textBlockQuote-border);
                        border-radius: 3px;
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                        line-height: 1.4;
                    }
                    .btn {
                        padding: 8px 16px;
                        border: none;
                        border-radius: 3px;
                        cursor: pointer;
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        height: 34px;
                        box-sizing: border-box;
                    }
                    .btn-primary {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                    }
                    .btn-primary:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    .btn-secondary {
                        background-color: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                    }
                    .btn-secondary:hover {
                        background-color: var(--vscode-button-secondaryHoverBackground);
                    }
                    .btn-danger {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                    }
                    .btn-danger:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    .rule-item {
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 5px;
                        padding: 15px;
                        margin-bottom: 15px;
                        background-color: var(--vscode-editor-background);
                    }
                    .rule-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 10px;
                    }
                    .rule-name {
                        font-weight: bold;
                        color: var(--vscode-textLink-foreground);
                    }
                    .rule-actions {
                        display: flex;
                        gap: 10px;
                    }
                    .rule-content {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 15px;
                        margin-bottom: 10px;
                    }
                    .rule-pattern {
                        font-family: var(--vscode-editor-font-family);
                        background-color: var(--vscode-textCodeBlock-background);
                        padding: 5px;
                        border-radius: 3px;
                        word-break: break-all;
                    }
                    .exempt-paths {
                        margin-top: 10px;
                    }
                    .exempt-path {
                        display: inline-block;
                        background-color: var(--vscode-badge-background);
                        color: var(--vscode-badge-foreground);
                        padding: 2px 6px;
                        border-radius: 3px;
                        margin: 2px;
                        font-size: 12px;
                    }
                    .common-patterns {
                        margin-top: 15px;
                    }
                    .pattern-item {
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 3px;
                        padding: 10px;
                        margin-bottom: 10px;
                        cursor: pointer;
                        background-color: var(--vscode-editor-background);
                    }
                    .pattern-item:hover {
                        background-color: var(--vscode-list-hoverBackground);
                    }
                    .pattern-name {
                        font-weight: bold;
                        color: var(--vscode-textLink-foreground);
                    }
                    .pattern-description {
                        color: var(--vscode-descriptionForeground);
                        font-size: 12px;
                        margin-top: 5px;
                    }
                    .pattern-pattern {
                        font-family: var(--vscode-editor-font-family);
                        background-color: var(--vscode-textCodeBlock-background);
                        padding: 3px;
                        border-radius: 3px;
                        margin-top: 5px;
                        font-size: 12px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Replace Go Import 设置</h1>
                        <p>配置Go文件中的导入路径替换规则</p>
                    </div>

                    <div class="section">
                        <div class="section-title">全局设置</div>
                        <div class="form-group">
                            <label class="form-label">
                                <input type="checkbox" class="form-checkbox" id="enabled" ${config?.enabled ? 'checked' : ''}>
                                启用插件
                            </label>
                        </div>
                        <div class="form-help">
                            <strong>功能说明：</strong>插件会自动处理Go文件中的import语句，将指定的字符串替换为新的字符串
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">替换规则</div>
                        <div id="rules-container">
                            ${rules.map((rule, index) => this.generateRuleHtml(rule, index)).join('')}
                        </div>
                        <button class="btn btn-primary" onclick="addRule()">添加规则</button>
                        <div class="form-help">
                            <strong>示例：</strong><br>
                            A: github.com/company/repo<br>
                            B: ./local/repo<br>
                            <em>结果：import "github.com/company/repo" → import "./local/repo"</em><br><br>
                            <strong>豁免路径：</strong>指定不应用此规则的文件路径，如 <code>**/vendor/**</code>、<code>**/test/**</code><br><br>
                            <strong>提示：</strong>此页面保存的规则写入<strong>用户级（全局）设置</strong>。如需按项目生效，可在当前项目的 <code>.vscode/settings.json</code> 中设置相同键以覆盖：
                            <code>replace-go-import.enabled</code>、<code>replace-go-import.rules</code>、<code>replace-go-import.showNotifications</code>。
                        </div>
                    </div>

                    <div class="section">
                        <button class="btn btn-primary" onclick="saveSettings()">保存设置</button>
                    </div>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    let ruleCounter = ${rules.length};

                    // 监听来自VS Code的消息
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'getRuleData':
                                handleGetRuleData(message.ruleIndex, message.testText);
                                break;
                            case 'getRuleDataForAllTests':
                                handleGetRuleDataForAllTests(message.ruleIndex, message.testCases);
                                break;
                        }
                    });

                    function handleGetRuleData(ruleIndex, testText) {
                        const ruleElement = document.getElementById(\`rule-\${ruleIndex}\`);
                        if (ruleElement) {
                            const name = ruleElement.querySelector('.rule-name-input').value;
                            const from = ruleElement.querySelector('.rule-from-input').value;
                            const to = ruleElement.querySelector('.rule-to-input').value;
                            const enabled = ruleElement.querySelector('.rule-enabled-input').checked;
                            const exemptPaths = Array.from(ruleElement.querySelectorAll('.exempt-paths-input')).map(input => input.value);

                            const rule = { name, from, to, exemptPaths, enabled };
                            
                            // 发送规则数据回VS Code
                            vscode.postMessage({
                                command: 'testRule',
                                rule: rule,
                                testText: testText
                            });
                        }
                    }

                    function handleGetRuleDataForAllTests(ruleIndex, testCases) {
                        const ruleElement = document.getElementById(\`rule-\${ruleIndex}\`);
                        if (ruleElement) {
                            const name = ruleElement.querySelector('.rule-name-input').value;
                            const from = ruleElement.querySelector('.rule-from-input').value;
                            const to = ruleElement.querySelector('.rule-to-input').value;
                            const enabled = ruleElement.querySelector('.rule-enabled-input').checked;
                            const exemptPaths = Array.from(ruleElement.querySelectorAll('.exempt-paths-input')).map(input => input.value);

                            const rule = { name, from, to, exemptPaths, enabled };
                            
                            console.log('发送规则数据:', rule);
                            console.log('测试用例数量:', testCases ? testCases.length : 0);
                            
                            // 发送规则数据和测试用例回VS Code
                            vscode.postMessage({
                                command: 'testAllCasesWithRule',
                                rule: rule,
                                testCases: testCases
                            });
                        } else {
                            console.error('找不到规则元素:', \`rule-\${ruleIndex}\`);
                        }
                    }

                    function addRule() {
                        const container = document.getElementById('rules-container');
                        const ruleHtml = generateRuleHtml({
                            name: '新规则',
                            from: '',
                            to: '',
                            exemptPaths: [],
                            enabled: true
                        }, ruleCounter++);
                        container.insertAdjacentHTML('beforeend', ruleHtml);
                    }

                    function removeRule(index) {
                        const ruleElement = document.getElementById(\`rule-\${index}\`);
                        if (ruleElement) {
                            ruleElement.remove();
                        }
                    }

                    function testRule(index) {
                        const ruleElement = document.getElementById(\`rule-\${index}\`);
                        if (ruleElement) {
                            const name = ruleElement.querySelector('.rule-name-input').value;
                            const from = ruleElement.querySelector('.rule-from-input').value;
                            const to = ruleElement.querySelector('.rule-to-input').value;
                            const enabled = ruleElement.querySelector('.rule-enabled-input').checked;
                            const exemptPaths = Array.from(ruleElement.querySelectorAll('.exempt-paths-input')).map(input => input.value);

                            const rule = { name, from, to, exemptPaths, enabled };
                            
                            // 直接发送规则数据，让后端处理测试
                            vscode.postMessage({
                                command: 'testRuleDirect',
                                rule: rule
                            });
                        }
                    }

                    function usePattern(pattern) {
                        const newRuleIndex = ruleCounter++;
                        const container = document.getElementById('rules-container');
                        const ruleHtml = generateRuleHtml({
                            name: '新规则',
                            from: pattern,
                            to: '',
                            exemptPaths: [],
                            enabled: true
                        }, newRuleIndex);
                        container.insertAdjacentHTML('beforeend', ruleHtml);
                    }

                    function saveSettings() {
                        const enabled = document.getElementById('enabled').checked;
                        
                        const rules = [];
                        const ruleElements = document.querySelectorAll('.rule-item');
                        ruleElements.forEach(ruleElement => {
                            const name = ruleElement.querySelector('.rule-name-input').value;
                            const from = ruleElement.querySelector('.rule-from-input').value;
                            const to = ruleElement.querySelector('.rule-to-input').value;
                            const enabled = ruleElement.querySelector('.rule-enabled-input').checked;
                            const exemptPaths = Array.from(ruleElement.querySelectorAll('.exempt-paths-input')).map(input => input.value).filter(path => path.trim());

                            if (name && from && to) {
                                rules.push({ name, from, to, exemptPaths, enabled });
                            }
                        });

                        vscode.postMessage({
                            command: 'saveRules',
                            rules: rules
                        });
                    }

                    

                    function generateRuleHtml(rule, index) {
                        return \`
                            <div class="rule-item" id="rule-\${index}">
                                <div class="rule-header">
                                    <input type="text" class="form-input rule-name-input" value="\${rule.name}" placeholder="规则名称">
                                    <div class="rule-actions">
                                        <button class="btn btn-secondary" onclick="testRule(\${index})">测试</button>
                                        <button class="btn btn-danger" onclick="removeRule(\${index})">删除</button>
                                    </div>
                                </div>
                                <div class="rule-content">
                                    <div class="form-group">
                                        <label class="form-label">A (源路径)</label>
                                        <input type="text" class="form-input rule-from-input" value="\${rule.from}" placeholder="例如: github.com/company/repo">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">B (目标路径)</label>
                                        <input type="text" class="form-input rule-to-input" value="\${rule.to}" placeholder="例如: ./local/repo">
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">
                                        <input type="checkbox" class="form-checkbox rule-enabled-input" \${rule.enabled ? 'checked' : ''}>
                                        启用此规则
                                    </label>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">豁免路径 (每行一个)</label>
                                    <textarea class="form-textarea exempt-paths-input" placeholder="例如: **/vendor/**">\${rule.exemptPaths.join('\\n')}</textarea>
                                </div>
                            </div>
                        \`;
                    }
                </script>
            </body>
            </html>
        `;
    }

    /**
     * 生成规则HTML
     */
    private generateRuleHtml(rule: ReplaceRule, index: number): string {
        const exemptPathsHtml = rule.exemptPaths.map(path => 
            `<span class="exempt-path">${this.escapeHtml(path)}</span>`
        ).join('');

        return `
            <div class="rule-item" id="rule-${index}">
                <div class="rule-header">
                    <input type="text" class="form-input rule-name-input" value="${this.escapeHtml(rule.name)}" placeholder="规则名称">
                    <div class="rule-actions">
                        <button class="btn btn-secondary" onclick="testRule(${index})">测试</button>
                        <button class="btn btn-danger" onclick="removeRule(${index})">删除</button>
                    </div>
                </div>
                <div class="rule-content">
                    <div class="form-group">
                        <label class="form-label">A (源路径)</label>
                        <input type="text" class="form-input rule-from-input" value="${this.escapeHtml(rule.from)}" placeholder="例如: github.com/company/repo">
                    </div>
                    <div class="form-group">
                        <label class="form-label">B (目标路径)</label>
                        <input type="text" class="form-input rule-to-input" value="${this.escapeHtml(rule.to)}" placeholder="例如: ./local/repo">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">
                        <input type="checkbox" class="form-checkbox rule-enabled-input" ${rule.enabled ? 'checked' : ''}>
                        启用此规则
                    </label>
                </div>
                <div class="form-group">
                    <label class="form-label">豁免路径 (每行一个)</label>
                    <textarea class="form-textarea exempt-paths-input" placeholder="例如: **/vendor/**">${rule.exemptPaths.join('\n')}</textarea>
                </div>
            </div>
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
}

