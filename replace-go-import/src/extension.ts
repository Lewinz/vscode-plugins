import * as vscode from 'vscode';
import { RuleManager } from './ruleManager';
import { ConfigUI } from './configUI';

export function activate(context: vscode.ExtensionContext) {
    console.log('Replace Go Import 插件已激活');

    // 初始化核心组件
    const ruleManager = new RuleManager();
    const configUI = new ConfigUI(ruleManager);

    // 注册命令
    const openSettingsCommand = vscode.commands.registerCommand(
        'replace-go-import.openSettings',
        () => configUI.openSettings()
    );

    const testRulesCommand = vscode.commands.registerCommand(
        'replace-go-import.testRules',
        () => configUI.testRules()
    );

    const processCurrentFileCommand = vscode.commands.registerCommand(
        'replace-go-import.processCurrentFile',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'go') {
                await ruleManager.processDocument(editor.document);
            } else {
                vscode.window.showWarningMessage('请打开一个Go文件');
            }
        }
    );

    // 使用更精确的保存事件监听
    const runOnSaveDisposable = vscode.workspace.onDidSaveTextDocument(
        async (document: vscode.TextDocument) => {
            if (document.languageId === 'go') {
                try {
                    await ruleManager.processDocument(document);
                } catch (error) {
                    console.error('处理文档时出错:', error);
                    vscode.window.showErrorMessage(`处理文件时出错: ${error}`);
                }
            }
        }
    );

    // 注册配置变化监听
    const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(
        (event: vscode.ConfigurationChangeEvent) => {
            if (event.affectsConfiguration('replace-go-import')) {
                ruleManager.refreshConfiguration();
                console.log('配置已更新');
            }
        }
    );

    // 注册文件变化监听（用于实时预览）
    const fileChangeDisposable = vscode.workspace.onDidChangeTextDocument(
        (event: vscode.TextDocumentChangeEvent) => {
            if (event.document.languageId === 'go' && 
                event.contentChanges.length > 0) {
                // 可以在这里添加实时预览功能
            }
        }
    );

    // 将所有disposable添加到context中
    context.subscriptions.push(
        openSettingsCommand,
        testRulesCommand,
        processCurrentFileCommand,
        runOnSaveDisposable,
        configChangeDisposable,
        fileChangeDisposable
    );

    // 初始化规则管理器
    ruleManager.refreshConfiguration();
}

export function deactivate() {
    console.log('Replace Go Import 插件已停用');
}
