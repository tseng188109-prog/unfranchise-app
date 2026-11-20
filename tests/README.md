# 測試

這個資料夾是給「改程式的人」（現在是 Claude）檢查用的，**不是 App 的一部分**：
不會被打包進手機上的 App，Vercel 也不會用到它，大家用 App 完全不受影響。

每次要改 App 之前，先把這裡的測試全部跑一遍，確定舊功能都正常；改完再跑一遍，確定沒有改壞別的地方。

## 怎麼跑

在專案資料夾裡：

```bash
npm i --no-save esbuild@0.28 playwright   # 只有第一次需要；Claude 的工作環境通常已經有
bash tests/run-all.sh
```

最後看到「全部通過」就沒問題；有 ✗ 的地方會列出是哪一項沒過。

也可以只跑其中一段：

| 指令 | 測什麼 | 要多久 |
|---|---|---|
| `bash tests/unit/run.sh` | 純計算：每日節奏、連續天數、罐子和核桃、首頁推薦誰、系統管理後台、手機提醒要送什麼、搭檔連勝、打氣通知 | 幾秒 |
| `bash tests/ui/run.sh` | 畫面：用假的資料庫打開模擬手機，照真的操作一步一步點 | 十幾分鐘 |
| `bash tests/db/run.sh` | 資料庫權限：誰看得到誰的資料、管理用的功能一般帳號叫不動 | 幾十秒 |

## 三個資料夾

- **unit/**：直接呼叫 `src/lib`、`api` 裡的程式，比對算出來的結果。`fakedb*.js` 是假的資料庫。
  `data/rand2.json` 是 400 筆隨機產生的假名單（不是真的人），用來核對罐子數字。
- **ui/**：`entryNN.jsx` 把幾個頁面組成一個小網站，`fake-supabase.js` 取代真的 Supabase，
  資料全部是假的（王怡茜、林小美…都是虛構的名字）。`tNN.cjs` 用 Playwright 模擬 iPhone 去點。
  - t16–t26 是比較早的「觀察型」測試：會印出畫面上的數值，但不會自己判斷對錯，
    `run.sh` 只檢查它們跑完、沒有頁面錯誤。要確認數值，看那個測試印出來的內容。
  - 其他的會印 `PASS …` / `FAIL …`，有一個 FAIL 就算沒過。
  - 截圖會存在 `ui/shots/`（不會放進 GitHub）。
  - t36–t38：戰隊打氣、好消息、搭檔連勝、首頁旗子、設定（entry21）。
  - t39：真的打包兩次（舊版、新版），確認手機打開舊版後會自己換到新版、正在打字時不換。
- **db/**：在本機 PostgreSQL 16 上建一份跟 Supabase 一樣的表（`schema.sql`、`seed.sql`），
  套上 `migrations/` 裡每一包的 SQL，再用不同身分去讀寫。
  需要一個跑在 socket `/tmp/pg`、port `5544` 的 PostgreSQL，帳號 `postgres`；沒有的話 `run-all.sh` 會跳過這段。

## 每次改完要記得

- 新功能要加對應的測試（`ui/tNN.cjs` 編號往下排，`unit/` 加在相關的檔案）。
- 有新的 SQL（deliver-NN-xxx.sql），也複製一份到 `db/migrations/`。
- 改了畫面上的字，舊測試如果是找那個字，要一起改。
