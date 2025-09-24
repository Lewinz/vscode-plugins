# Replace Go Import 插件安装指南

## 🚀 快速开始（开发模式）

### 1. 编译插件
```bash
cd /Users/lewin/workspace/vscode-plugins/replace-go-import
npm run compile
```

### 2. 在 Cursor 中加载
- 打开 Cursor
- 按 `F5` 启动调试模式
- 或者按 `Ctrl+Shift+P` (Windows/Linux) 或 `Cmd+Shift+P` (Mac)
- 输入 `Developer: Reload Window`

### 3. 测试插件
- 打开一个 `.go` 文件
- 按 `Ctrl+Shift+P` 打开命令面板
- 输入 `Replace Go Import` 查看可用命令

## 📦 正式安装（打包模式）

### 1. 安装打包工具
```bash
npm install -g vsce
```

### 2. 打包插件
```bash
cd /Users/lewin/workspace/vscode-plugins/replace-go-import
vsce package
```

### 3. 安装插件
```bash
# 安装生成的 .vsix 文件
code --install-extension replace-go-import-0.1.0.vsix
```

## 🎯 使用方法

### 打开配置界面
1. 按 `Ctrl+Shift+P` 打开命令面板
2. 输入 `Replace Go Import: 打开规则设置`
3. 在 Web 界面中配置规则

### 手动处理文件
1. 打开一个 `.go` 文件
2. 按 `Ctrl+Shift+P` 打开命令面板
3. 输入 `Replace Go Import: 处理当前文件`

### 测试规则
1. 按 `Ctrl+Shift+P` 打开命令面板
2. 输入 `Replace Go Import: 测试规则`

## ⚙️ 配置示例

### 基本配置
```json
{
  "replace-go-import.enabled": true,
  "replace-go-import.scope": "imports",
  "replace-go-import.rules": [
    {
      "name": "GitHub 到本地",
      "pattern": "github\\.com/company/repo",
      "replacement": "./local/repo",
      "exemptPaths": ["**/vendor/**"],
      "enabled": true
    }
  ]
}
```

### 常见规则模式
- **GitHub 仓库**: `github\\.com/company/repo`
- **公司所有仓库**: `github\\.com/company/.*`
- **内部包**: `.*/internal/.*`

## 🔍 故障排除

### 插件未激活
- 确保打开了 `.go` 文件
- 检查插件是否启用：`replace-go-import.enabled: true`

### 规则不生效
- 检查正则表达式语法
- 确认规则已启用
- 查看豁免路径设置

### 配置界面打不开
- 重新加载窗口：`Developer: Reload Window`
- 检查控制台错误信息

## 📝 开发模式说明

在开发模式下，插件会：
- 自动监听文件变化
- 在保存 `.go` 文件时自动应用规则
- 显示处理结果通知
- 记录详细日志到控制台

## 🎉 开始使用

1. 编译插件：`npm run compile`
2. 在 Cursor 中按 `F5`
3. 打开一个 `.go` 文件
4. 配置规则并测试

享受使用 Replace Go Import 插件！

