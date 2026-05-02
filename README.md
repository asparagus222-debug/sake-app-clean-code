# 酒跡（Sake Notes）

清酒品飲筆記 Web App：記錄風味雷達、展場試飲、AI 輔助酒標辨識與文案、使用者個人頁與社群互動。前端為 **Next.js App Router**，資料與登入使用 **Firebase（Auth + Firestore + Storage）**，敏感操作與 AI 呼叫經 **Next.js Route Handlers** 搭配 **Firebase Admin**。

## 技術概要

| 區塊 | 說明 |
|------|------|
| 框架 | Next.js 15、React 19、TypeScript、Tailwind CSS |
| UI | Radix UI / shadcn 風格元件（`src/components/ui/`） |
| 資料 | Firestore 規則見 `firestore.rules`，索引見 `firestore.indexes.json` |
| AI | `@google/generative-ai` 部分路由直連；酒造摘要、酒標辨識等使用 **Genkit**（`src/ai/`） |
| 部署 | Firebase App Hosting（`firebase.json` 可連結 GitHub 分支建置） |

## 本地開發

**需求**：Node.js ≥ 18、npm ≥ 9。

```bash
npm install
cp .env.example .env.local
# 編輯 .env.local，至少填入 GEMINI_API_KEY；若需完整辨識流程再加 GOOGLE_CLOUD_VISION_API_KEY
npm run dev
```

開發伺服器預設為 **http://localhost:9002**（見 `package.json` 的 `dev` 指令）。

其他指令：

| 指令 | 用途 |
|------|------|
| `npm run build` | 正式建置 |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript 檢查 |
| `npm run genkit:dev` | 本機跑 Genkit 開發介面（除錯 flow） |
| `node scripts/set-admin-claim.mjs ...` | 設定管理員 custom claim（見下方） |
| `npm run backfill:author-stats` | 補寫作者統計（需 Admin 憑證） |

## 環境變數說明

請以 **`.env.local`** 覆寫（已列入 `.gitignore`）。範本見 **`.env.example`**。

### 幾乎一定會用到

| 變數 | 用途 |
|------|------|
| `GEMINI_API_KEY` | Gemini：生成品飲筆記、頭像、熟成摘要、vision-web-detect 等；Genkit 的 Google 模型亦依賴 Google AI 憑證。 |

### 依功能選填

| 變數 | 用途 |
|------|------|
| `GOOGLE_CLOUD_VISION_API_KEY` | Cloud Vision：酒標辨識（`/api/ai/identify-sake`）內 OCR／網路預檢。未設定時流程仍可能靠 Gemini，但與 Vision 相關能力會受限。 |
| `GOOGLE_API_KEY` | `vision-web-detect` 的備援金鑰（與 GEMINI 擇一用途見該路由）。 |
| `NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY` | 前端初始化 Firebase App Check（`src/firebase/index.ts`）。 |
| `FIREBASE_APP_CHECK_ENFORCED` | 設為 `true` 時，受保護 API 會強制驗證 `X-Firebase-AppCheck`。本機若未設 reCAPTCHA，請勿強制，否則請求會失敗。 |
| `NEXT_PUBLIC_BASE_URL` | 公開站點網址；贊助／綠界建立訂單時需要正確的 callback 基底網址。 |
| `ECPAY_MERCHANT_ID` / `ECPAY_HASH_KEY` / `ECPAY_HASH_IV` | 綠界金流（贊助）。 |
| `ECPAY_IS_TEST` | 非 `false` 時視為測試模式（預設行為見 `sponsor/create-order`）。 |
| `GOOGLE_APPLICATION_CREDENTIALS` | 本機檔案路徑，指向 Firebase 服務帳戶 JSON。 |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | 服務帳戶 JSON **字串**（適合託管環境）；與上一項擇一供 Admin SDK 使用。 |
| `ANTHROPIC_API_KEY` | Genkit 已註冊 Anthropic 外掛；僅在實際呼叫 Claude 相關模型時需要。 |

### Firebase 前端設定（非 `.env`）

目前 Web SDK 設定寫在 **`src/firebase/config.ts`**（`apiKey`、`projectId` 等）。這些值在 Firebase Console 的「專案設定 → 一般 → 您的應用程式」可取得；客戶端金鑰會出現在打包後前端，屬預期行為，**仍以 Firestore Security Rules 控管資料存取**。

若要區分「開發專案／正式專案」，較佳做法是改為 **`NEXT_PUBLIC_FIREBASE_*`** 並在 `config.ts` 讀取 `process.env`，本 repo 尚未拆分時請直接修改該檔對應欄位。

## 修改專案時建議從哪裡下手

| 你想改… | 建議位置 |
|---------|----------|
| 畫面與路由 | `src/app/**/page.tsx`、共用元件 `src/components/` |
| 資料結構／常數選項 | `src/lib/types.ts`、各頁使用的 Firestore 讀寫 |
| 後端 API、AI 提示詞 | `src/app/api/**/route.ts`、`src/ai/flows/` |
| 登入與 Firestore 連線 | `src/firebase/`、`FirebaseClientProvider` |
| 誰能讀寫哪筆資料 | `firestore.rules`（改完需部署規則） |
| 機密與第三方金鑰 | `.env.local` / 託管環境變數，勿寫進程式碼 |

## 管理員權限（Custom Claims）

後台與部分 API 會檢查 Firebase Auth 的 **`admin: true`** claim。

在本機具備 Admin SDK 憑證（`GOOGLE_APPLICATION_CREDENTIALS` 或 `FIREBASE_SERVICE_ACCOUNT_KEY`）時執行：

```bash
node scripts/set-admin-claim.mjs --email you@example.com --admin true
node scripts/set-admin-claim.mjs --uid someFirebaseUid --admin true
```

取消管理員：`--admin false`。變更後使用者需**重新登入**才会拿到新 token。

## 授權與備註

本 README 僅描述專案結構與設定方式；授權若未於 repo 內標示，請於儲存庫根目錄補上 `LICENSE`。
