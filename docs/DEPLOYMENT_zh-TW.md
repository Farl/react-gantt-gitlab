# 部署指南

本指南說明如何將此 React Gantt 應用程式部署到 GitHub Pages 和 GitLab Pages。

## 目錄

- [部署選項](#部署選項)
- [CORS 跨域問題與解決方案](#cors-跨域問題與解決方案)
- [建置指令](#建置指令)
- [環境變數](#環境變數)
- [疑難排解](#疑難排解)

---

## 部署選項

### 選項 1：GitLab Pages

**優點：**

- 與 GitLab 在同一組織內
- 自動 CI/CD 部署

**限制：**

- ⚠️ **若 Pages 與 GitLab API 網域不同，仍有 CORS 問題**
  - 例如：GitLab API 在 `gitlab.yourcompany.com`，Pages 在 `pages.yourcompany.io`
  - 需要額外配置 CORS proxy

**部署步驟：**

1. 推送程式碼到 GitLab repository：

   ```bash
   git push gitlab main
   ```

2. CI/CD pipeline 會自動執行（`.gitlab-ci.yml`）

3. Pipeline 完成後，網站將部署至：

   ```
   https://<project-name>-<hash>.pages.yourcompany.io/
   ```

4. 檢查部署狀態：
   - Pipeline: `https://your-gitlab-domain.com/<username>/<project-name>/-/pipelines`
   - Pages 設定: Settings > Pages

### 選項 2：GitHub Pages

**優點：**

- 免費託管
- 支援自訂網域

**限制：**

- 跨域存取 GitLab API 會有 CORS 問題
- 需要 CORS proxy 處理 API 呼叫

**部署步驟：**

1. 推送程式碼到 GitHub repository：

   ```bash
   git push origin main
   ```

2. 啟用 GitHub Pages：

   - 前往：Repository Settings > Pages
   - Source：選擇 "GitHub Actions"

3. GitHub Actions 會自動建置並部署（`.github/workflows/deploy-github-pages.yml`）

4. 網站將部署至：
   ```
   https://<username>.github.io/<repository-name>/
   ```

---

## CORS 跨域問題與解決方案

### 什麼是 CORS？

跨來源資源共用（Cross-Origin Resource Sharing, CORS）是瀏覽器的安全機制，會阻擋從一個網域向另一個網域發送請求，除非伺服器明確允許。

### 問題說明

當你的應用程式部署在與 GitLab API 不同的網域時（例如 GitLab Pages 在 `pages.yourcompany.io`，API 在 `gitlab.yourcompany.com`），瀏覽器會因為 CORS 政策而阻擋這些請求。

**錯誤訊息範例：**

```
Access to fetch at 'https://gitlab.yourcompany.com/api/v4/...' from origin 'https://pages.yourcompany.io'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the
requested resource.
```

### 解決方案

#### 方案 1：使用 Cloudflare Workers（推薦）

**特點：**

- ✅ 免費方案可用（每天 100,000 requests）
- ✅ 設定簡單，部署快速
- ✅ 全球 CDN，速度快

**設定步驟：**

本專案已包含可直接使用的 Cloudflare Worker，詳細說明請參考 [`worker/README.md`](../worker/README.md)。

**快速步驟：**

1. 編輯 `worker/worker.js` — 將你的 GitLab 網域加入 `ALLOWED_DOMAINS`
2. 部署至 Cloudflare Workers（免費方案：每天 100,000 requests）
3. 設定 `VITE_CORS_PROXY` 環境變數指向你的 Worker URL

**CI/CD 配置範例：**

**GitHub Actions** (`.github/workflows/deploy-github-pages.yml`)：

```yaml
- name: Build
  run: npm run build:pages
  env:
    VITE_BASE_PATH: /react-gantt-gitlab/
    VITE_CORS_PROXY: https://gitlab-cors-proxy.your-account.workers.dev
```

**GitLab CI** (`.gitlab-ci.yml`)：

```yaml
pages:
  script:
    - npm ci
    - npm run build:pages
    - mkdir -p public
    - cp -r dist-demos/* public/
  variables:
    VITE_CORS_PROXY: 'https://gitlab-cors-proxy.your-account.workers.dev'
```

#### 方案 2：使用內部 Nginx 反向代理（最安全）

如果有自己的伺服器，可以設定 Nginx 反向代理。

**Nginx 配置範例：**

```nginx
# /etc/nginx/sites-available/gitlab-proxy

server {
    listen 80;
    server_name gitlab-proxy.yourcompany.com;

    # CORS headers
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization, PRIVATE-TOKEN' always;

    # Handle preflight OPTIONS requests
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Max-Age' 1728000;
        add_header 'Content-Type' 'text/plain charset=UTF-8';
        add_header 'Content-Length' 0;
        return 204;
    }

    location / {
        # 轉發到 GitLab
        proxy_pass https://gitlab.yourcompany.com;
        proxy_set_header Host gitlab.yourcompany.com;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 保留 Authorization headers
        proxy_pass_request_headers on;
    }
}
```

**使用方式：**

```env
VITE_CORS_PROXY=https://gitlab-proxy.yourcompany.com
```

#### 方案 3：請管理員在 GitLab 上啟用 CORS（最理想）

如果可以的話，直接在 GitLab 伺服器上設定 CORS headers 是最好的解決方案。

**需要在 GitLab 伺服器上設定：**

```
Access-Control-Allow-Origin: https://your-pages-domain.com, https://username.github.io
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, PRIVATE-TOKEN
```

這需要聯絡 IT 部門或 GitLab 管理員。

---

## 建置指令

### 本地開發

```bash
npm run dev
```

### 正式環境建置

```bash
# 建置 demo/pages 版本
npm run build:pages

# 建置函式庫版本
npm run build

# 建置完整 CSS
npm run build:full-css
```

### 預覽正式環境建置

```bash
npm run build:pages
npm run preview
```

---

## 環境變數

建立 `.env.local` 用於本地開發：

```env
# GitLab 配置
VITE_GITLAB_URL=https://gitlab.yourcompany.com
VITE_GITLAB_TOKEN=你的-token
VITE_GITLAB_PROJECT_ID=你的-project-id

# 選用：CORS Proxy（用於正式環境不同網域）
# VITE_CORS_PROXY=https://your-cors-proxy.workers.dev
```

**注意：** 永遠不要將 `.env.local` 或真實的 token 提交到 git！

---

## 疑難排解

### 問題：GitLab CI Pipeline 沒有執行

**原因：** Runner 未配置或 tag 錯誤

**解決方案：** 確認 `.gitlab-ci.yml` 有正確的 tags：

```yaml
pages:
  tags:
    - docker # 使用你的 GitLab instance 的正確 tag
```

### 問題：GitLab Pages 出現 404

**原因：** `public/` 目錄結構錯誤

**解決方案：** 確認 CI script 正確複製檔案：

```yaml
script:
  - npm ci
  - npm run build:pages
  - mkdir -p public
  - cp -r dist-demos/* public/ # 複製內容，不是目錄本身
```

檢查 artifacts：`index.html` 應該在 `public/` 根目錄，不是 `public/dist-demos/`

### 問題：CORS 錯誤

**症狀：**

```
Access to fetch at 'https://gitlab.yourcompany.com/...' has been blocked by CORS policy
```

**解決方案：** 使用上述的 CORS 解決方案之一：

1. Cloudflare Workers CORS proxy（推薦）
2. 公司內部 Nginx 反向代理
3. 請 IT 在 GitLab 上啟用 CORS

### 問題：Assets 無法載入

**原因：** 路徑配置錯誤

**解決方案：** 檢查 `vite.config.js` 的 base 配置：

```javascript
// GitLab Pages 使用根路徑 '/'
// GitHub Pages 使用子路徑（透過 VITE_BASE_PATH 環境變數設定）
const base = process.env.VITE_BASE_PATH || '/';
```

---

## 多個 Remote 設定

可以同時推送到 GitHub 和 GitLab：

```bash
# 加入 remotes
git remote add origin git@github.com:username/repo.git
git remote add gitlab git@your-gitlab-domain.com:username/repo.git

# 推送到兩個 remote
git push origin main
git push gitlab main

# 查看 remotes
git remote -v
```

---

## 安全注意事項

1. **永遠不要提交 GitLab tokens** 到 repository
2. 使用 GitHub Secrets 儲存敏感的環境變數
3. 如果使用 CORS proxy，**只允許 GitLab 網域的白名單**
4. 正式環境考慮使用短期 token 或 OAuth

---

## CORS Proxy 比較

| 方案                   | 優點                 | 缺點               | 適用情境               |
| ---------------------- | -------------------- | ------------------ | ---------------------- |
| **Cloudflare Workers** | 免費、快速、全球 CDN | 需要註冊帳號       | 最推薦，適合大多數情況 |
| **Nginx 反向代理**     | 完全掌控、內部網路   | 需要自己的伺服器   | 有內部伺服器時使用     |
| **GitLab CORS 設定**   | 最簡單、無需額外服務 | 需要 IT/管理員權限 | 理想方案，但需要權限   |
| **公開 CORS Proxy**    | 快速測試             | 不安全、不穩定     | 僅限開發測試           |

---

## 推薦部署流程

1. **開發階段**

   - 使用 `npm run dev`
   - Vite proxy 自動處理 CORS

2. **測試階段**

   - 部署到 GitLab Pages
   - 設定 Cloudflare Workers CORS proxy
   - 測試所有 API 功能

3. **正式環境**
   - 根據需求選擇：
     - GitLab Pages + Cloudflare Workers
     - GitHub Pages + Cloudflare Workers
     - 公司內部伺服器 + Nginx

---

## 額外資源

- [Vite 部署指南](https://vitejs.dev/guide/static-deploy.html)
- [GitHub Pages 文件](https://docs.github.com/en/pages)
- [GitLab Pages 文件](https://docs.gitlab.com/ee/user/project/pages/)
- [CORS MDN 文件](https://developer.mozilla.org/zh-TW/docs/Web/HTTP/CORS)
- [Cloudflare Workers 文件](https://developers.cloudflare.com/workers/)
