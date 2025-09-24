"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const ruleManager_1 = require("./ruleManager");
const configUI_1 = require("./configUI");
function activate(context) {
    console.log('Replace Go Import 插件已激活');
    // 初始化核心组件
    const ruleManager = new ruleManager_1.RuleManager();
    const configUI = new configUI_1.ConfigUI(ruleManager);
    // 注册命令
    const openSettingsCommand = vscode.commands.registerCommand('replace-go-import.openSettings', () => configUI.openSettings());
    const testRulesCommand = vscode.commands.registerCommand('replace-go-import.testRules', () => configUI.testRules());
    const processCurrentFileCommand = vscode.commands.registerCommand('replace-go-import.processCurrentFile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'go') {
            await ruleManager.processDocument(editor.document);
        }
        else {
            vscode.window.showWarningMessage('请打开一个Go文件');
        }
    });
    // 使用更精确的保存事件监听
    const runOnSaveDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (document.languageId === 'go') {
            try {
                await ruleManager.processDocument(document);
            }
            catch (error) {
                console.error('处理文档时出错:', error);
                vscode.window.showErrorMessage(`处理文件时出错: ${error}`);
            }
        }
    });
    // 注册配置变化监听
    const configChangeDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('replace-go-import')) {
            ruleManager.refreshConfiguration();
            console.log('配置已更新');
        }
    });
    // 注册文件变化监听（用于实时预览）
    const fileChangeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.languageId === 'go' &&
            event.contentChanges.length > 0) {
            // 可以在这里添加实时预览功能
        }
    });
    // 将所有disposable添加到context中
    context.subscriptions.push(openSettingsCommand, testRulesCommand, processCurrentFileCommand, runOnSaveDisposable, configChangeDisposable, fileChangeDisposable);
    // 初始化规则管理器
    ruleManager.refreshConfiguration();
}
exports.activate = activate;
function deactivate() {
    console.log('Replace Go Import 插件已停用');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map