# 中国福利彩票智能选号工具

一个完全运行在浏览器中的双色球、七乐彩随机选号单页应用。页面支持动态切换玩法、自定义生成 1–100 注互不重复号码、统计当前组合、复制号码和查看理论中奖概率。项目不包含后端、数据库、账号系统、AI 接口或用户追踪。

## 本地运行

环境要求：Windows 11、Node.js 20 或更高版本、npm。

```powershell
npm install
npm run dev
```

终端会显示本地地址，通常为 `http://localhost:5173/`。在浏览器中打开该地址即可使用。

生产构建与本地预览：

```powershell
npm run build
npm run preview
```

构建产物位于 `dist/`，可直接用于静态托管。

## 自动化测试

```powershell
npm test
```

测试内容包括：

- 双色球可调注数、每注 6 个红球和 1 个蓝球、范围、升序与整注去重。
- 七乐彩可调注数、每注 7 个基本号码、范围、升序与整注去重。
- Web Crypto 调用、拒绝采样、有限样本分布检查。
- 双色球和七乐彩统计计算及覆盖率。
- 默认玩法、生成、动态切换、旧结果清空、概率联动、单注与整批复制。

持续监听测试可运行：

```powershell
npm run test:watch
```

## 项目结构

```text
.
├─ public/
│  └─ favicon.svg
├─ src/
│  ├─ lib/
│  │  ├─ lottery.ts          # 无偏抽样、批次校验、统计与复制格式
│  │  └─ lottery.test.ts     # 算法与统计测试
│  ├─ test/
│  │  └─ setup.ts
│  ├─ App.tsx                # 单页界面、玩法状态与复制交互
│  ├─ App.test.tsx           # 页面生成、切换和复制测试
│  ├─ main.tsx
│  ├─ styles.css             # 桌面与手机响应式视觉样式
│  └─ vite-env.d.ts
├─ index.html
├─ package.json
├─ tsconfig.json
├─ tsconfig.app.json
├─ tsconfig.node.json
└─ vite.config.ts
```

## 随机算法

### 双色球

1. 从号码池 `01–33` 中用 Fisher–Yates 洗牌均匀抽取 6 个不同红球。
2. 从号码池 `01–16` 中用同样方式抽取 1 个蓝球。
3. 红球升序排列，形成一注完整组合。
4. 整注以“6 个红球 + 蓝球”为键检查是否重复。
5. 重复时重新抽取，直到获得指定注数且完整组合互不重复。

### 七乐彩

1. 从号码池 `01–30` 中均匀抽取 7 个不同基本号码。
2. 号码升序排列，形成一注完整组合。
3. 不额外选择特别号码；特别号码由开奖过程产生。
4. 整注去重，直到获得指定注数且完整组合互不重复。

### 无偏随机整数

正式页面使用 `crypto.getRandomValues(new Uint32Array(1))`，不使用 `Math.random()` 选号。随机整数通过拒绝采样生成：先计算 32 位无符号整数范围内可整除抽样区间的上界，丢弃会造成取模偏差的尾部数值，再从剩余区间取模。Fisher–Yates 只从尚未选取的号码区间交换位置，因此每个合法号码组合具有相同的抽样机会。

算法不限制奇偶比、连号、大小比、和值、冷热号或遗漏周期，不因组合外观排除合法结果。

## 动态切换

页面只有一份当前玩法状态 `selectedLottery` 和一份当前号码 `tickets`。切换下拉框时：

1. 更新当前彩票类型。
2. 立即清空 `tickets` 与生成时间；修改生成注数时也执行同样的清理。
3. 由当前类型重新渲染选号规则、号码样式、统计名称和计算范围。
4. 更新中奖概率与一等奖规则。
5. 禁用整批复制，直到当前玩法重新生成号码。

切换过程不会保留上一种彩票的号码或统计。页面刷新后默认回到双色球，且不会恢复任何旧号码。

## 部署

### Vercel

将项目目录连接为 Vercel 项目，使用以下配置：

- Framework Preset：Vite
- Build Command：`npm run build`
- Output Directory：`dist`

### Cloudflare Pages

创建 Pages 项目并连接代码仓库，使用以下配置：

- Build Command：`npm run build`
- Build Output Directory：`dist`

本项目是单页静态站点，没有服务端路由或环境变量要求。部署到 HTTPS 站点后可直接使用浏览器 Web Crypto。

### GitHub Pages

项目已包含 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)。将代码推送到公开 GitHub 仓库的 `main` 分支后：

1. 打开仓库的 `Settings → Pages`。
2. 在 `Build and deployment` 中把 `Source` 设为 `GitHub Actions`。
3. 等待 `Deploy to GitHub Pages` 工作流完成。
4. 免费访问地址通常是 `https://<GitHub用户名>.github.io/<仓库名>/`。

每次推送到 `main`，工作流会先运行测试与生产构建，再自动发布。

## 隐私与概率说明

- 号码只存在于当前页面内存，不上传、不写入本地存储，刷新即清除。
- 不调用 AI、数据库、第三方号码生成服务或用户追踪脚本。
- 双色球单注一等奖理论概率为 `1 / 17,721,088`，N 注互不重复组合为 `N / 17,721,088`。
- 七乐彩单注一等奖理论概率为 `1 / 2,035,800`，N 注互不重复组合为 `N / 2,035,800`。
- 开奖结果随机，任何算法都不能预测下一期开奖。统计只描述本次组合分布，不改变中奖概率。
