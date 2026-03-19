# Spending Track

[English](./README.md) | [中文](./README.zh-CN.md)

一个用于追踪信用卡消费、估算里程/积分、并基于网银页面扫描结果监控 4 mpd 封顶进度的 Chrome 插件。

## 功能

- 从网银页面扫描交易数据（当前提取逻辑支持 DBS / UOB 相关流程）。
- 按卡片追踪：
  - `DBS Woman's World Card`
  - `UOB Lady's Solitaire Card`
- 按卡规则估算积分/里程。
- UOB 选择类别（Dining/Travel）封顶进度条追踪。
- 可报销模式：
  - 每笔交易可标记为可报销。
  - Dashboard 可选择在展示消费时排除可报销金额。
  - 4 mpd / 积分计算仍按原始金额计算（不受排除影响）。
- 商户级分类覆盖缓存（会学习你的手动分类结果）。
- 全局洞察：
  - 分类占比
  - 最大消费
  - 最常消费商户
  - 支持展开查看更多
- 每周 Chrome 通知提醒（`alarms` + `notifications`）。

## 项目结构

- `src/popup/*`：插件弹窗和扫描控制。
- `src/dashboard/*`：Dashboard 页面与分析组件。
- `src/content-scripts/extractor.ts`：页面数据提取逻辑。
- `src/utils/*`：计算器、卡规则、分类归一化。
- `src/background.ts`：每周提醒（alarm + notification）的 service worker。
- `manifest.json`：Chrome 扩展配置（MV3）。

## 环境要求

- 建议 Node.js 18+。
- npm。
- Google Chrome（用于加载解压扩展）。

## 安装依赖

```bash
npm install
```

## 构建

```bash
npm run build
```

构建产物目录：

- `dist/`

## 在 Chrome 中加载（Unpacked）

1. 打开 `chrome://extensions`。
2. 开启 **Developer mode**。
3. 点击 **Load unpacked**。
4. 选择项目的 `dist` 目录。

## 使用流程

1. 打开 DBS 或 UOB 的网银交易页面。
2. 点击插件弹窗，执行 **Start Scanning**。
3. 从弹窗进入 Dashboard。
4. 如有需要，手动调整交易分类。
5. （可选）将公司报销类交易勾选为 reimbursable。
6. 在主 Dashboard 使用 **Exclude Reimbursable** 查看净消费。

## 注意事项和限制

- 银行页面结构可能变更，扫描器规则可能需要跟进更新。
- 部分商户没有明确分类，系统会使用关键词/规则推断。
- 里程/积分为估算值，可能与银行最终入账逻辑存在小幅差异。

## 数据与隐私

- 数据默认保存在本地 `chrome.storage.local`。
- 项目默认不依赖后端服务。

## 常用脚本

- `npm run dev`：Vite 开发模式。
- `npm run build`：TypeScript 检查 + 生产构建。
- `npm run preview`：预览构建结果。

