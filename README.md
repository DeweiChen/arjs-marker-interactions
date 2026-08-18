# AR.js + Three.js 雙 Marker 互動裝置

基於 AR.js 與 Three.js (r164) 的雙 Marker WebAR 互動裝置。

## 技術棧
- **AR 核心**：`@ar-js-org/ar.js` (v3.4.8)
- **3D 渲染**：`three` (v0.164.0)
- **打包與開發伺服器**：`Vite`
- **套件管理**：`pnpm`
- **部署平台**：GitHub Pages (HTTPS)

## 開發指令
```bash
# 安裝依賴
pnpm install

# 啟動開發伺服器（預設啟用 HTTPS 方便手機存取攝影機）
pnpm run dev

# 專案建置
pnpm run build

# 預覽建置產物
pnpm run preview
```
