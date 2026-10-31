<!--
cv.zh-TW.md — cv.md 的繁體中文版。事實必須與 cv.md 完全一致，只是語言不同。

誰會讀：modes/score.md（評分證據）、modes/tailor.md（客製履歷唯一可用的素材；職缺是中文時以本檔為準）、
ats-check（客製後的草稿必須維持同樣的結構）。人也會讀，所以寫實話。

讓 AI 草擬者和 ATS 解析器都好用的規則：
1. 一行一個事實。一個 bullet = 做了什麼 + 數字 + 範圍。「訂單服務 p99 延遲降低 40%，日均 200 萬筆」。
2. 下面的標題名稱不要改（ATS 靠標題分段）。可以增加的只有：證照、專案、著作與專利、語言能力、獲獎、志工。
3. 每段經歷是「### 公司 — 職稱」，下一行是「YYYY-MM 至 YYYY-MM|至今 · 城市 · 背景」。全檔同一種日期格式，由新到舊。
4. 技術名稱照職缺的寫法（Kubernetes 不寫 k8s；PostgreSQL 不寫 pg），而且寫在用到它的那個 bullet 裡；
   只列在技能區是弱證據。
5. 寫得比任何一份履歷需要的都多。tailor 模式只會刪，不會加。
6. 不用表格、圖片、分欄、emoji。像這段一樣的註解，所有讀者都會略過。
7. 不要放年齡、性別、婚姻、照片、身分證字號、完整地址、希望待遇、希望職稱。那些屬於 profile.yml 和 answers.md，
   多數 ATS 會標記這類欄位。
-->
# 姓名（English Name）
email@example.com · +886-9xx-xxx-xxx · 台北市 · linkedin.com/in/handle · github.com/handle · yoursite.example

## 摘要
<!-- 3 到 5 行：一個名詞片語說明你是誰、年資、最拿得出手的兩三件事、下一步想做什麼。 -->
後端工程師，8 年經驗，以 Go 與 Kubernetes 建構支付與訂單系統。帶領 6 人團隊完成 AWS 遷移，客戶端零停機。尋求平台團隊的 Staff 或 Lead 職位。

## 技能
<!-- 分類列出。用正式產品名稱。只寫面試時講得出來的。 -->
- 程式語言：Go、TypeScript、Python、SQL
- 後端：gRPC、REST、GraphQL、PostgreSQL、Redis、Kafka
- 基礎設施：AWS（EKS、RDS、S3、IAM）、Kubernetes、Terraform、Helm、GitHub Actions
- 可觀測性：Prometheus、Grafana、OpenTelemetry
- 工程實務：系統設計、事故處理與 on-call、程式碼審查、指導新人
- 領導：招募、路線圖規劃、與產品及業務的跨部門交付

## 工作經歷
<!-- 由新到舊。近期職務 3 到 8 個 bullet，早期 1 到 3 個。每個 bullet 都是能證明的事實。 -->
### Acme Corp — 資深後端工程師
2021-03 至今 · 台北 · 金融科技，400 人
- 以 Go 重寫訂單服務並搬上 Kubernetes，p99 延遲降低 40%（日均 200 萬筆訂單）
- 主導 30 個服務以 Terraform 遷移至 AWS EKS；6 個月內客戶端零停機
- 以 GitHub Actions 建立 25 位工程師共用的 CI/CD 流程；部署前置時間從 2 天縮短到 20 分鐘
- 指導 3 位初階工程師，其中 2 位在 18 個月內晉升
- 支付系統 on-call 負責人；撰寫的事故處理手冊被所有後端團隊採用

### Beta Co — 後端工程師
2017-06 至 2021-02 · 新竹 · 電子商務，120 人
- 以 Kafka CDC 建立 PostgreSQL 帳務管線，日處理 200 萬筆
- 導入 OpenTelemetry 追蹤；平均偵測時間從 45 分鐘降到 8 分鐘

### Gamma Ltd — 初階開發者
2015-09 至 2017-05 · 台北 · SaaS，30 人
- 以 Node.js 交付面向客戶的報表 API；300 個付費帳戶

## 學歷
### 國立臺灣大學 — 資訊工程學系 學士
2011-09 至 2015-06

## 證照
- AWS Certified Solutions Architect – Associate（2022）
- Certified Kubernetes Administrator（2021）

## 專案
<!-- 副業、開源、你擁有的產品。名稱、一句話說明、你的角色、一個數字。 -->
- **otel-sampler**（github.com/handle/otel-sampler）：OpenTelemetry 的尾端取樣工具；400 顆星，2 家公司在正式環境使用
- **個人網站**（yoursite.example）：Next.js，分散式系統寫作

## 著作與專利
- 〈Zero-downtime migrations with Terraform and EKS〉，公司技術部落格，2022
- 演講：〈Tracing payments end to end〉，Taipei Go Meetup，2021

## 語言能力
- 中文：母語
- 英文：專業工作程度（TOEIC 900）
- 日文：基礎（JLPT N4）

## 獲獎
- Acme Corp 工程卓越獎，2023
