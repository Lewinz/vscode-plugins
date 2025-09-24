# Replace Go Import

一个智能的VSCode插件，用于处理Go项目中的导入路径替换。支持正则表达式规则和路径豁免功能。

## 功能特性

- ✅ **规则配置**：支持 `A --> B` 的替换规则，A 支持正则表达式
- ✅ **路径豁免**：每条规则可以设置豁免路径，豁免名单内的Go文件不进行替换
- ✅ **作用范围控制**：可选择仅处理import语句或整个文件
- ✅ **界面化管理**：提供友好的Web界面进行规则配置
- ✅ **实时测试**：支持规则测试功能
- ✅ **常见模式**：提供常用的正则表达式示例

## 安装方法

1. 克隆此仓库到本地
2. 在VSCode中打开插件目录
3. 按 `F5` 启动调试模式，或使用 `vsce package` 打包安装

## 使用方法

### 1. 打开设置界面

- 使用命令面板 (`Ctrl+Shift+P` 或 `Cmd+Shift+P`)
- 输入 "Replace Go Import: 打开规则设置"
- 或右键Go文件选择相应命令

### 2. 配置规则

在设置界面中：

1. **全局设置**
   - 启用/禁用插件
   - 选择作用范围（imports/all）

2. **添加替换规则**
   - 规则名称：便于识别的名称
   - 正则表达式：匹配模式
   - 替换内容：替换后的内容
   - 豁免路径：不应用此规则的路径模式
   - 启用状态：是否启用此规则

### 3. 常见正则表达式示例

| 模式 | 说明 | 示例 |
|------|------|------|
| `github\.com/company/repo` | 匹配特定的GitHub仓库 | `github.com/company/repo` |
| `github\.com/company/.*` | 匹配公司下的所有仓库 | `github.com/company/any-repo` |
| `.*/internal/.*` | 匹配所有internal包 | `github.com/company/internal/utils` |
| `github\.com/.*/v\d+` | 匹配带版本号的包 | `github.com/company/repo/v2` |
| `\./.*` | 匹配相对路径 | `./local/repo` |
| `/.*` | 匹配绝对路径 | `/usr/local/repo` |

### 4. 豁免路径模式

支持简单的通配符模式：

- `**/vendor/**` - 豁免vendor目录下的所有文件
- `**/test/**` - 豁免test目录下的所有文件
- `**/examples/**` - 豁免examples目录下的所有文件
- `**/mocks/**` - 豁免mocks目录下的所有文件

## 工作原理

1. **触发时机**：当保存Go文件时自动触发
2. **文件检查**：检查文件是否在豁免路径中
3. **规则应用**：根据作用范围设置处理文件内容
4. **正则替换**：应用匹配的规则进行替换
5. **结果反馈**：显示替换结果和详情

## 配置示例

### 示例1：本地开发替换

```json
{
  "name": "本地开发替换",
  "pattern": "github\\.com/company/repo",
  "replacement": "./local/repo",
  "exemptPaths": [
    "**/vendor/**",
    "**/test/**"
  ],
  "enabled": true
}
```

### 示例2：公司内部包替换

```json
{
  "name": "内部包替换",
  "pattern": "github\\.com/company/.*",
  "replacement": "git.company.com/company/$1",
  "exemptPaths": [
    "**/vendor/**"
  ],
  "enabled": true
}
```

## 命令

- `Replace Go Import: 打开规则设置` - 打开配置界面
- `Replace Go Import: 测试规则` - 测试当前配置的规则

## 注意事项

1. **正则表达式**：请确保正则表达式语法正确，可以使用在线工具验证
2. **豁免路径**：豁免路径使用简单的通配符模式，不支持复杂的正则表达式
3. **备份**：建议在重要项目中使用前先备份代码
4. **测试**：使用测试功能验证规则是否正确

## 开发说明

### 项目结构

```
src/
├── extension.ts      # 主扩展文件
├── ruleManager.ts    # 规则管理器
├── configUI.ts       # 配置界面
└── types.ts          # 类型定义
```

### 构建和调试

```bash
# 安装依赖
npm install

# 编译
npm run compile

# 监听模式
npm run watch

# 打包
vsce package
```

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！
