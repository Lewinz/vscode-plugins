# Replace Go Import

🚀 **让 Go 项目导入路径管理变得简单高效**

还在为 Go 项目中的导入路径替换而头疼？手动查找替换太麻烦，批量替换又怕出错？这个插件帮你一键搞定！

## ✨ 为什么需要这个插件？

- 🔄 **开发环境切换**：本地开发时，需要将 `github.com/company/repo` 替换为 `./local/repo`
- 🏢 **公司内部迁移**：将 GitHub 仓库迁移到公司内部 Git 服务器
- 📦 **模块重构**：项目重构时批量更新导入路径
- 🚫 **避免误改**：某些文件（如 vendor、test）不需要替换

## 🎯 核心功能

### 📝 智能替换
- **正则表达式支持**：灵活匹配各种导入模式
- **一键处理**：保存文件时自动替换，或手动处理当前文件
- **安全可控**：支持路径豁免，避免误改重要文件

### 🎛️ 简单配置
- **可视化界面**：无需手写配置文件，图形化设置规则
- **实时测试**：配置规则后立即测试效果
- **批量管理**：支持多条规则同时生效

### 🛡️ 安全可靠
- **路径豁免**：vendor、test、mocks 等目录自动排除
- **作用域控制**：可选择只处理 import 语句或整个文件
- **备份建议**：重要项目使用前建议先备份

## 🚀 快速开始

### 1️⃣ 安装插件
在 VS Code 扩展商店搜索 "Replace Go Import" 并安装

### 2️⃣ 打开配置界面
- 按 `Ctrl+Shift+P`（Mac: `Cmd+Shift+P`）
- 输入 "Replace Go Import: 打开规则设置"
- 或右键 Go 文件选择相应命令

### 3️⃣ 配置替换规则
在配置界面中：

**全局设置**
- ✅ 启用插件功能
- 🎯 选择作用范围：仅 import 语句 或 整个文件

**添加规则**
- 📝 规则名称：给规则起个好记的名字
- 🔍 匹配模式：要替换的导入路径（支持正则）
- ➡️ 替换内容：替换后的新路径
- 🚫 豁免路径：不需要替换的文件/目录
- ✅ 启用规则：是否立即生效

## 💡 使用场景示例

### 🏠 场景1：本地开发环境
**需求**：本地开发时使用本地仓库，而不是远程 GitHub 仓库

**配置**：
- 匹配模式：`github\.com/mycompany/project`
- 替换内容：`./local/project`
- 豁免路径：`**/vendor/**`, `**/test/**`

**效果**：
```go
// 替换前
import "github.com/mycompany/project/utils"

// 替换后  
import "./local/project/utils"
```

### 🏢 场景2：公司内部迁移
**需求**：将 GitHub 仓库迁移到公司内部 Git 服务器

**配置**：
- 匹配模式：`github\.com/mycompany/(.*)`
- 替换内容：`git.company.com/mycompany/$1`
- 豁免路径：`**/vendor/**`

**效果**：
```go
// 替换前
import "github.com/mycompany/api"
import "github.com/mycompany/utils"

// 替换后
import "git.company.com/mycompany/api"
import "git.company.com/mycompany/utils"
```

### 📦 场景3：模块版本升级
**需求**：将 v1 版本的模块升级到 v2

**配置**：
- 匹配模式：`github\.com/company/module/v1`
- 替换内容：`github.com/company/module/v2`
- 豁免路径：`**/examples/**`, `**/test/**`

## 🔧 高级配置

### 正则表达式参考
| 模式 | 说明 | 示例 |
|------|------|------|
| `github\.com/company/repo` | 精确匹配 | `github.com/company/repo` |
| `github\.com/company/.*` | 匹配公司下所有仓库 | `github.com/company/any-repo` |
| `.*/internal/.*` | 匹配所有 internal 包 | `github.com/company/internal/utils` |
| `github\.com/.*/v\d+` | 匹配带版本号的包 | `github.com/company/repo/v2` |

### 豁免路径模式
支持通配符模式，常用示例：
- `**/vendor/**` - 排除 vendor 目录
- `**/test/**` - 排除测试文件
- `**/examples/**` - 排除示例代码
- `**/mocks/**` - 排除模拟文件

## ⚡ 快捷命令

- `Replace Go Import: 打开规则设置` - 打开配置界面
- `Replace Go Import: 测试规则` - 测试当前配置
- `Replace Go Import: 处理当前文件` - 手动处理当前 Go 文件

## ⚠️ 注意事项

1. **备份重要**：在重要项目中使用前，建议先备份代码
2. **测试先行**：使用"测试规则"功能验证配置是否正确
3. **正则语法**：确保正则表达式语法正确，可使用在线工具验证
4. **豁免路径**：使用通配符模式，不支持复杂正则表达式

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

- 🐛 发现问题？请提交 Issue
- 💡 有改进建议？欢迎 Pull Request
- 📧 联系方式：通过 GitHub Issues 联系

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件