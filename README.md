# Regent Parts Firebase Starter

这个项目已经按你的 Excel `Data5.xlsm` 生成了以下结构：

- `parts`：零件主数据，142 条
- `bomItems`：零件 + 车型 + 数量明细，3195 条
- `models`：车型主数据，53 条
- `imports`：导入批次记录

## 先本地运行，不需要部署

```bash
npm install
npm run dev
```

浏览器打开 Vite 显示的地址即可。

当前网站默认读取 `src/data/*.json`，所以不用 Firebase 也能先看效果。

## 要不要部署？

开发阶段不需要部署。你只需要本地运行即可。

当你希望其他同事也能访问，例如 Store / Quality / Purchasing / Design 都能打开网页时，才需要部署。推荐部署到 Firebase Hosting。

## 导入 Firestore

1. 在 Firebase Console 创建项目。
2. 开启 Firestore Database。
3. 下载 Service Account JSON，放到项目根目录，命名为 `service-account.json`。
4. 设置环境变量：

```bash
$env:GOOGLE_APPLICATION_CREDENTIALS=".\service-account.json"
```

5. 导入数据：

```bash
npm run import:firestore
```

## 重新从 Excel 生成 JSON

把新的 `Data5.xlsm` 放到项目根目录，然后运行：

```bash
npm run convert:excel
```

或者指定文件路径：

```bash
node scripts/convert-excel-to-json.mjs "C:\path\to\Data5.xlsm"
```

## 推荐 Firestore Collections

```txt
parts/{partId}
bomItems/{partId}_{modelCode}
models/{modelCode}
imports/{importBatchId}
```

## 后续建议

下一步可以加：

- 登录权限
- Excel 上传按钮
- Firestore 实时读取
- 点击车型图表展开零件
- SAP Code 反查所有车型
- Source / Location / Group 统计图
