# Kế hoạch xây dựng web luyện thi TOEIC (tham khảo byetoeic.com)

> Mục tiêu: một web luyện thi TOEIC Listening & Reading dùng bộ dữ liệu 50 đề trong `Data/`, với 2 chế độ chính giống ByeTOEIC: **Thi thử** (full 200 câu, bấm giờ 120 phút, chấm điểm 990) và **Luyện tập** (chọn part, xem đáp án + giải thích tiếng Việt ngay).

---

## 1. Hiện trạng dữ liệu (đã khảo sát)

### 1.1 Cấu trúc thư mục

```
Data/<năm>/<testN>/
├── csv/    testN-part1.csv … testN-part7.csv   (7 file / đề)
├── audio/  <năm>-testN.mp3 (audio full đề) + audio từng câu/nhóm câu
└── image/  ảnh Part 1 (6), ảnh đồ hoạ Part 3 (62,65,68), Part 4 (95,98), đôi khi Part 7
```

- **50 đề** = 5 năm (2022–2026) × 10 đề, mỗi đề **200 câu** → 10.000 câu.
- Tổng ~1,2 GB (chủ yếu mp3: 2.210 file; 449 ảnh jpg; 350 csv).

### 1.2 Cột dữ liệu theo part (CSV phân cách bằng `;`)

| Part | Số câu | Cột chính | Ghi chú |
|---|---|---|---|
| 1 – Tranh | 6 (1–6) | Audio, Image, Question, A–D, Answer, Explain | Explain = dịch 4 đáp án |
| 2 – Hỏi đáp | 25 (7–31) | Audio, Question, A–C, Answer, Explain | chỉ 3 đáp án |
| 3 – Hội thoại | 39 (32–70) | Audio, Image, Text, Question, A–D, Answer, Explain, Transcript | 3 câu/nhóm, `Text` = script tiếng Anh, `Transcript` = bản dịch |
| 4 – Bài nói | 30 (71–100) | như Part 3 | 3 câu/nhóm |
| 5 – Điền câu | 30 (101–130) | Part Number, Question, A–D, Answer, Explain | |
| 6 – Điền đoạn | 16 (131–146) | Text, Question, A–D, Answer, Explain, Transcript | 4 câu/đoạn |
| 7 – Đọc hiểu | 54 (147–200) | (Image), Text, Question, A–D, Answer, Explain, Transcript | đoạn đơn/kép/ba |

**Cách nhận diện nhóm câu (Part 3/4/6/7):** `Text` chỉ có ở **dòng đầu nhóm**, các dòng sau để trống → một nhóm kéo dài tới dòng tiếp theo có `Text`. Part 3/4 còn có thể nhóm theo tên audio (`…-32-34.mp3`).

### 1.3 Vấn đề dữ liệu cần làm sạch (bắt buộc trước khi import)

1. **Header không đồng nhất**: thừa cột rỗng cuối dòng, có file thừa cột rỗng ở đầu, 4 file Part 6 thiếu cột `Question`, 3 file (Part 6/7) toàn bộ header bị dính thành 1 cột do quoting lẫn lộn.
2. **Đáp án sai định dạng**: `"(B)"`, `" (C)"`, `" (B"` (toàn bộ Part 2 của 2023, một số đề 2024/2026) → chuẩn hoá về `A|B|C|D`.
3. **Dòng lệch cột** (~300 dòng, chủ yếu Part 7/3) → đáp án bị `None`; cần kiểm tra thủ công từng trường hợp.
4. **Số câu dạng `1.0`** (đề 2026) và **câu bị trùng** (`2025/test7` Part 7 có 2 dòng câu 161).
5. **Tên file audio 2 kiểu**: `test1-audio-32-34.mp3` (2025) và `test1_question_32_34.mp3` (2022–2024).
6. **Đề 2026 thiếu media**: chỉ có file audio full, ảnh hầu như không có; CSV trỏ tới URL bên ngoài (`data.toeicets.com`). Phương án: (a) cắt file full mp3 thành từng đoạn theo mốc thời gian, hoặc (b) chỉ cho phép chế độ Thi thử (phát audio liền mạch) với đề 2026; ảnh Part 1/3/4 thiếu thì phải bổ sung.
7. Một số tham chiếu `Image 1/2/3` (placeholder) và vài URL ảnh Part 7 không có file local.

> 👉 Bước đầu tiên của dự án là viết **script ETL** đọc toàn bộ CSV, tự sửa những lỗi trên, và xuất **báo cáo lỗi** cho phần còn lại để sửa tay.

---

## 2. Tính năng (đối chiếu ByeTOEIC)

ByeTOEIC có: trang chủ landing, **Mock Test** (danh sách đề theo bộ/năm, mỗi đề "200 câu – 120 phút – Thi thử / Luyện tập"), Listening, Reading, Grammar, Vocabulary, Speaking & Writing (chấm AI), dashboard tiến độ, lộ trình, blog, đăng nhập Google, gói Pro.

Với dữ liệu hiện có, chia làm 3 giai đoạn:

### MVP (giai đoạn 1) — dùng 100% dữ liệu sẵn có
- **Trang danh sách đề**: lọc theo năm (2022…2026), thẻ đề hiển thị số câu, thời gian, trạng thái (chưa làm / điểm lần gần nhất).
- **Thi thử (Full test)**:
  - Phòng thi: audio full đề phát liền mạch, không tua, đồng hồ đếm ngược 120 phút (Listening ~45' theo audio, Reading 75').
  - Bảng điều hướng 200 ô câu hỏi, đánh dấu "xem lại", lưu bài tự động (localStorage + server).
  - Nộp bài → điểm Listening/Reading/Tổng quy đổi thang 990, số câu đúng từng part.
- **Luyện tập (Practice)**: chọn 1 hoặc nhiều part, có/không bấm giờ; audio từng câu/nhóm, được nghe lại.
- **Xem đáp án & giải thích**: đáp án đúng/sai, `Explain` tiếng Việt, hiện script (`Text`) + bản dịch (`Transcript`) cho Part 3/4/6/7.
- **Tài khoản**: đăng ký/đăng nhập bằng email + mật khẩu, lịch sử bài làm.

### Giai đoạn 2 — phân tích & ôn luyện ✅ (hoàn thành 19/11/2026)
- ✅ Dashboard (`/history`): điểm dự đoán, biểu đồ điểm theo thời gian, heatmap ngày học, tỉ lệ đúng theo part.
- ✅ **Sổ câu sai** (`/mistakes`): tự gom câu làm sai; ôn ngắt quãng 1 → 3 → 7 ngày, đúng 3 lần liên tiếp = đã thuộc.
- ✅ **Luyện nghe chép chính tả** (`/listening`): chế độ điền từ (3 mức độ) và chép cả câu (so khớp từng từ).
- ✅ Luyện theo dạng câu (`/practice`): Part 2 theo 11 loại câu hỏi, Part 5 theo 7 chủ điểm ngữ pháp — nhãn gắn tự động
  bằng quy tắc trong `scripts/enrich.py` (chưa dùng AI; có thể lệch ở một số câu).
- ✅ Từ vựng (`/vocabulary`): ~2.100 từ gốc — nghĩa trích từ giải thích Part 5–6, gộp dạng chia về từ gốc, hiện các dạng khác của từ theo loại từ kèm nghĩa (submit → submission),
  ẩn từ cơ bản (`scripts/basic_words.txt`), thêm từ xuất hiện trong lời thoại Part 1–4; chia theo từng đề; flashcard hộp Leitner
  (1 → 3 → 7 → 14 → 30 ngày), phát âm bằng giọng đọc của trình duyệt.

### Giai đoạn 3 — mở rộng (tuỳ chọn)
- Trang admin: CRUD đề/câu hỏi, upload CSV/media, sửa lỗi dữ liệu.
- Lộ trình học cá nhân hoá, bảng xếp hạng, blog/SEO.
- Gia sư AI giải thích thêm theo yêu cầu (Claude API); chấm Speaking/Writing.
- Gói Pro / thanh toán.

---

## 3. Kiến trúc & công nghệ đề xuất

| Lớp | Lựa chọn | Lý do |
|---|---|---|
| Frontend + Backend | **Next.js (App Router) + TypeScript** | SSR cho SEO trang danh sách đề, API routes/Server Actions cho chấm bài |
| UI | **Tailwind CSS + shadcn/ui** | dựng nhanh giao diện phòng thi, dark mode |
| CSDL | **PostgreSQL + Drizzle ORM** (Aiven; dev dùng PGlite — xem mục 11) | dữ liệu quan hệ rõ ràng: đề → nhóm → câu → bài làm |
| Auth | **better-auth** – email + mật khẩu | không phụ thuộc dịch vụ ngoài (đã bỏ Google theo yêu cầu) |
| Lưu media | **Backblaze B2** (API S3) — xem mục 11 | 1,7 GB mp3/ảnh, không nên để trong repo |
| ETL | Script **Python** (pandas) hoặc **Node** | làm sạch CSV → JSON chuẩn → seed DB |
| State phòng thi | Zustand + localStorage | giữ bài làm khi reload/mất mạng |
| Deploy | Vercel (app) + Aiven PostgreSQL (DB) + Backblaze B2 (media) | chi phí thấp giai đoạn đầu |

Giai đoạn đầu có thể chạy hoàn toàn **local**: media phục vụ từ `public/media/…` hoặc một route đọc thẳng thư mục `Data/`.

---

## 4. Mô hình dữ liệu

```
Collection (bộ đề: "2022", "2023"…)
 └─ Test (id, collection, number, title, fullAudioUrl, durationMin=120)
     └─ QuestionGroup (id, testId, part, orderNo, audioUrl?, imageUrls[], passageEn?, passageVi?)
         └─ Question (id, groupId, number 1–200, part, prompt?, options{A,B,C,D?}, answer, explanationVi, tags[])

User (id, email, name, avatar, targetScore)
Attempt (id, userId, testId, mode: FULL|PRACTICE, parts[], startedAt, submittedAt,
         timeSpentSec, listeningCorrect, readingCorrect, listeningScore, readingScore, totalScore)
AttemptAnswer (attemptId, questionId, selected, isCorrect, flagged, timeSpentSec)
```

- Part 1, 2, 5: mỗi câu là một group riêng (cho thống nhất).
- Part 3/4/6/7: một group chứa 2–5 câu dùng chung audio/đoạn văn.

---

## 5. Pipeline nhập dữ liệu (ETL)

1. **Đọc CSV bền vững**: tự nhận diện delimiter/quoting; map header theo tên (bỏ cột rỗng), fallback theo vị trí khi header dính.
2. **Chuẩn hoá**: số câu → int; đáp án regex `[ABCD]`; `\n` literal → xuống dòng thật; trim khoảng trắng.
3. **Gom nhóm** Part 3/4/6/7 theo quy tắc "dòng có Text bắt đầu nhóm mới".
4. **Resolve media**: tên file local (2 kiểu đặt tên) hoặc URL → đường dẫn trong `Data/`; nếu là URL ngoài thì lấy basename tra local, không có thì đánh dấu thiếu.
5. **Kiểm tra**: mỗi đề đủ 200 câu, đúng số câu từng part, không trùng số câu, mọi media tồn tại.
6. **Xuất** `data/tests/<năm>-<testN>.json` + `etl-report.md` (danh sách lỗi cần sửa tay) → **seed** vào DB.
7. Upload media lên Backblaze B2 với key `"<năm>/<testN>/audio/…"`.

---

## 6. Trang & route

| Route | Nội dung |
|---|---|
| `/` | Landing: giới thiệu, CTA "Thi thử ngay" |
| `/tests` | Danh sách đề, lọc theo năm, trạng thái/điểm |
| `/tests/[testId]` | Chi tiết đề: chọn **Thi thử** hoặc **Luyện tập** (tick part, chọn giới hạn thời gian) |
| `/tests/[testId]/exam?mode=full\|practice&parts=1,2` | Phòng thi |
| `/attempts/[attemptId]` | Kết quả: điểm 990, đúng/sai theo part, lưới 200 câu |
| `/attempts/[attemptId]/review?q=32` | Xem lại từng câu + giải thích + script/dịch |
| `/dashboard` | Thống kê, lịch sử (GĐ2) |
| `/mistakes` | Sổ câu sai (GĐ2) |
| `/login` | Đăng nhập / tạo tài khoản (email + mật khẩu) |

### Giao diện phòng thi
- **Header**: tên đề, đồng hồ đếm ngược, nút Nộp bài.
- **Cột trái** (Part 3/4/6/7): ảnh / đoạn văn (Part 6–7 cho cuộn độc lập).
- **Cột phải**: câu hỏi + đáp án radio, nút đánh dấu.
- **Thanh điều hướng**: 200 ô (đã làm / chưa làm / đánh dấu), nhảy theo part.
- Full test: audio player khoá tua, chạy tự động; Practice: player đầy đủ, chỉnh tốc độ 0.75×–1.25×.
- Responsive: mobile chuyển thành bố cục 1 cột, đoạn văn thu gọn được.

---

## 7. Chấm điểm

- Listening = số câu đúng Part 1–4 (0–100) → tra **bảng quy đổi** ra 5–495.
- Reading = số câu đúng Part 5–7 (0–100) → bảng quy đổi riêng ra 5–495.
- Tổng = L + R (10–990).
- ETS không công bố bảng quy đổi chính thức; dùng bảng ước lượng phổ biến và ghi rõ "điểm ước tính" trên giao diện (giống cách ByeTOEIC ghi chú).
- Chế độ Practice: chỉ hiển thị % đúng theo part, không quy đổi 990.

---

## 8. Lộ trình triển khai (ước tính cho 1 dev)

| Tuần | Công việc | Kết quả |
|---|---|---|
| 1 | Khởi tạo Next.js + Tailwind + Drizzle; viết ETL & báo cáo lỗi; sửa dữ liệu bẩn | JSON sạch 50 đề, DB đã seed |
| 2 | Trang danh sách đề, chi tiết đề; route phục vụ media | Duyệt được đề, nghe audio, xem ảnh |
| 3 | Phòng thi Practice (theo part) + chấm + xem giải thích | Luyện từng part chạy end-to-end |
| 4 | Phòng thi Full test (audio liền mạch, timer, autosave) + trang kết quả 990 | Thi thử 200 câu hoàn chỉnh |
| 5 | Đăng nhập, lưu lịch sử, trang review bài làm | MVP có tài khoản |
| 6 | Responsive, kiểm thử (Playwright cho luồng thi), deploy Vercel + Backblaze B2 | **MVP online** |
| 7+ | Dashboard, sổ câu sai, nghe chép, tag dạng câu, từ vựng | Giai đoạn 2 |

---

## 9. Rủi ro & lưu ý

- **Bản quyền**: nội dung đề (ETS/các bộ sách) có bản quyền. Dùng cá nhân/học tập thì ổn; nếu public hoặc thu phí cần cân nhắc kỹ. Chỉ tham khảo bố cục/tính năng của ByeTOEIC, **không sao chép** logo, tên thương hiệu, nội dung hay mã nguồn của họ.
- **Media đề 2026 thiếu** → quyết định cắt audio full hay chỉ hỗ trợ chế độ Thi thử cho bộ này.
- **Chất lượng giải thích** không đồng đều giữa các năm (có nơi chỉ dịch đáp án) → có thể dùng AI sinh bổ sung ở GĐ2.
- **Hiệu năng audio**: audio full ~45 phút; cần preload, xử lý mất mạng giữa chừng (tiếp tục từ mốc thời gian đã lưu).
- **Dung lượng**: không commit `Data/` media vào git; thêm vào `.gitignore`, dùng object storage.

---

## 10. Việc cần làm ngay ✅ (đã xong)

Đã khởi tạo project, ETL, xử lý đề 2026 (tải đủ media), phòng thi. Xem mục 11 cho phần tiếp theo.

---

## 11. Kế hoạch tiếp theo: backend + deploy (cập nhật 19/11/2026)

### 11.1 Hiện trạng ảnh hưởng tới deploy

| Thành phần | Hiện tại | Vấn đề khi deploy |
|---|---|---|
| Audio/ảnh (`Data/`, 1,7 GB) | Route `/media` đọc từ ổ đĩa | Không có trên server/GitHub → phải lên object storage |
| Dữ liệu đề (`content/`, 25 MB JSON) | Đọc bằng `fs`, đã được đóng gói vào bản build | ✅ Chạy được trên Vercel |
| Bài làm, câu sai, thẻ từ vựng | ✅ Khách: `localStorage`; đã đăng nhập: đồng bộ Postgres | ✅ Aiven đã tạo bảng; cần đặt `DATABASE_URL` + `BETTER_AUTH_SECRET` trên Vercel |
| Chấm điểm | Ở trình duyệt, đáp án gửi kèm dữ liệu | Người dùng xem trộm được đáp án |
| Kiểm thử | Unit test + `check_content.py` | `check_content` cần `Data/` → CI không chạy được |

### 11.2 Hạ tầng đề xuất (đều có gói miễn phí)

| Việc | Dịch vụ | Ghi chú |
|---|---|---|
| Chạy web | **Vercel** (Hobby) | Kết nối thẳng repo GitHub, tự deploy mỗi lần push. Gói Hobby chỉ cho mục đích phi thương mại |
| Audio/ảnh | **Backblaze B2** ✅ (đã chọn) | ~10 GB lưu trữ miễn phí; API tương thích S3; hỗ trợ tua audio (HTTP Range) |
| Database | **Aiven for PostgreSQL** ✅ (đã chọn, gói Free) | Chỉ lưu dữ liệu người dùng; nội dung đề vẫn là JSON tĩnh trong `content/` |
| Đăng nhập | **better-auth, email + mật khẩu** ✅ | Chưa có dịch vụ gửi email → chưa xác minh email / quên mật khẩu |
| ORM | **Drizzle ORM + drizzle-kit** ✅ | Dev không cần cài gì: bỏ trống `DATABASE_URL` → PGlite (Postgres WASM) trong `.data/pglite`; prod đặt `DATABASE_URL` của Aiven |
| CI | **GitHub Actions** | lint, typecheck, unit test, build mỗi lần push/PR |

**Lưu ý với Backblaze B2**
- Truy cập file qua địa chỉ dạng `https://f00X.backblazeb2.com/file/<bucket>/<đường dẫn>` (hoặc endpoint S3 `https://<bucket>.s3.<region>.backblazeb2.com/...`)
  → đặt `NEXT_PUBLIC_MEDIA_BASE` bằng phần trước đường dẫn file.
- Bucket phải để **Public** để trình duyệt phát audio trực tiếp. Backblaze có thể yêu cầu xác minh tài khoản (email / thanh toán) mới cho tạo bucket public — kiểm tra khi tạo.
- Cấu hình **CORS** cho domain web: cho phép `GET`, `HEAD`; lộ header `Content-Range`, `Accept-Ranges`, `Content-Length` (để tua audio).
- **Băng thông tải xuống**: miễn phí trong một hạn mức theo dung lượng lưu (khoảng gấp 3 lần/tháng ≈ 5 GB với 1,7 GB media); một bài thi thử tải ~25–40 MB audio.
  Khi có nhiều người dùng → đặt **Cloudflare** (miễn phí) làm CDN phía trước B2 để không tốn phí tải xuống (Bandwidth Alliance).

**Lưu ý với Aiven PostgreSQL (gói Free)**
- Gói miễn phí: 1 máy chủ nhỏ, dung lượng giới hạn (vài GB), không có bản dự phòng/nhân bản; dịch vụ có thể bị tắt khi lâu không dùng — đủ cho giai đoạn thử nghiệm.
- Kết nối bắt buộc SSL: `DATABASE_URL="postgres://user:pass@host:port/defaultdb?sslmode=require"`.
- Vercel chạy serverless (mỗi instance mở pool riêng) trong khi gói Free giới hạn số kết nối → pool nhỏ (`DATABASE_POOL_MAX`, mặc định 3);
  phiên đăng nhập được giữ 5 phút trong cookie đã ký để bớt truy vấn. Nên đặt `DATABASE_CA_CERT` (CA của Aiven) để xác thực chứng chỉ.
- Chọn region gần Vercel (vd. cùng khu vực Singapore) để giảm độ trễ.
- Giới hạn gói miễn phí có thể thay đổi — kiểm tra lại trang giá của Aiven và Backblaze khi tạo.

### 11.3 Các giai đoạn

**Giai đoạn A — Đưa bản hiện tại lên mạng (~1–2 ngày, chưa cần database)**
1. Script `scripts/upload_media.sh` đồng bộ `Data/` lên bucket Backblaze B2 (`b2 sync` hoặc `aws s3 sync --endpoint-url https://s3.<region>.backblazeb2.com`), giữ nguyên cấu trúc thư mục `<năm>/<testN>/audio|image/…`; đặt bucket Public và CORS cho domain web.
2. Đặt `NEXT_PUBLIC_MEDIA_BASE=https://f00X.backblazeb2.com/file/<bucket>` trên Vercel; route `/media` chỉ còn dùng khi chạy local. Thử phát và tua audio, kể cả tên file có dấu cách.
3. `check_content.py --skip-media` để chạy được khi không có `Data/`; thêm GitHub Actions (lint, tsc, vitest, check_content, build).
4. Kết nối repo với Vercel, deploy; thử toàn bộ luồng trên domain `*.vercel.app` (audio tua được, ảnh hiện, thi thử, luyện tập).
5. Sửa trả mã 404 thật cho đường dẫn đề sai; thêm `robots.txt` (tạm `noindex` — xem 11.5).

→ Kết quả: web chạy công khai, dữ liệu học vẫn lưu trên trình duyệt như hiện nay.

**Giai đoạn B — Database + đăng nhập** ✅ (19/11/2026, trừ mục ghi chú)
1. ✅ Drizzle schema (`src/db/schema.ts`, migration trong `drizzle/`): `user/session/account/verification` (better-auth),
   `attempt`, `review_event`, `dictation_event`, `vocab_card`, `vocab_day`, `exam_progress`, `user_pref`. Dev dùng PGlite, tự migrate; prod `npm run db:migrate`.
2. ✅ better-auth, đăng ký/đăng nhập bằng email + mật khẩu (`/api/auth/*`, đã bỏ Google), trang `/login`, avatar + trạng thái đồng bộ trên menu,
   đăng xuất xoá bản sao dữ liệu khỏi trình duyệt. ⏳ Trang hồ sơ (mục tiêu điểm), quên mật khẩu / xác minh email (cần dịch vụ gửi mail, vd Resend) để sau.
3. ✅ Tầng lưu trữ hai chế độ (`src/lib/storage.ts`, giữ nguyên các hook): khách → `localStorage`; đã đăng nhập → vùng riêng `toeic:u:<id>:…`,
   thay đổi xếp hàng (lưu cả khi tắt trình duyệt) và đẩy lên `POST /api/me/sync`; mở trang / quay lại tab → kéo `GET /api/me/sync`.
4. ✅ Lần đăng nhập đầu: banner hỏi **chuyển dữ liệu khách trên trình duyệt** vào tài khoản (hỏi một lần).
5. ✅ API `/api/me/sync`: kiểm tra phiên, kiểm tra dữ liệu bằng zod, bắt buộc JSON (chống CSRF), giới hạn 200 thao tác / 4 MB mỗi lần.
   ✅ Giới hạn tần suất của better-auth lưu trong bảng `rate_limit` (đăng nhập 5 lần/phút, đăng ký 5 lần/giờ mỗi IP).

**Giai đoạn C — Chấm điểm trên server, giấu đáp án (~2–3 ngày)**
1. Phòng thi nhận dữ liệu đề **đã bỏ** `answer`, `explanation`, `optionNotes`, `questionVi`, `evidence`.
2. Nộp bài → server chấm theo đáp án trong `content/` → trả kết quả + phần giải thích.
3. Luyện tập "hiện đáp án ngay": khi làm xong một đoạn, gọi API lấy đáp án + giải thích của đoạn đó.
4. Trang kết quả, sổ câu sai, luyện dạng lấy giải thích qua API (chỉ sau khi đã trả lời).

**Giai đoạn D — Chất lượng & vận hành (~2–3 ngày, làm xen kẽ)**
1. Playwright E2E: thi thử (nộp tay + hết giờ), luyện tập, đăng nhập, sổ câu sai, từ vựng.
2. Theo dõi lỗi (Sentry gói free hoặc log của Vercel), Vercel Analytics.
3. Sao lưu database: gói Free của Aiven không có bản dự phòng tự động → GitHub Actions chạy `pg_dump` định kỳ, lưu bản sao vào một bucket B2 riêng (private).

**Giai đoạn E — Tính năng Giai đoạn 3 (sau khi đã chạy ổn)**
Trang quản trị sửa câu hỏi/giải thích, lộ trình học cá nhân, bảng xếp hạng, gia sư AI giải thích thêm (Claude API), gói Pro.

### 11.4 Việc bạn cần chuẩn bị

1. Tài khoản **Vercel** (đăng nhập bằng GitHub) và cấp quyền repo `VuHuyHung1706/Toeic`.
2. Tài khoản **Backblaze** → tạo bucket B2 (Public) → tạo **Application Key** (keyID + applicationKey, quyền đọc/ghi bucket đó) để chạy script tải media.
3. ✅ **Aiven PostgreSQL** đã tạo, đã chạy migration. Trên Vercel đặt `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (xem `.env.example`).
4. (Tuỳ chọn) tên miền riêng.

Mọi khoá bí mật đặt trong biến môi trường của Vercel / file `.env.local` (đã nằm trong `.gitignore`), **không commit**.

### 11.5 Rủi ro

- **Bản quyền:** nội dung đề ETS có bản quyền. Đưa lên mạng công khai (nhất là có thu phí) có rủi ro bị yêu cầu gỡ. Nên để `noindex`, chỉ chia sẻ link riêng, hoặc bật bảo vệ bằng mật khẩu/đăng nhập cho tới khi có phương án nội dung riêng.
- Gói miễn phí có giới hạn (Vercel Hobby không dùng thương mại; Aiven Free giới hạn dung lượng/kết nối, có thể tự tắt khi lâu không dùng; Backblaze B2 giới hạn băng thông tải xuống miễn phí) — đủ cho giai đoạn thử nghiệm.
- Giới hạn của gói miễn phí có thể thay đổi — kiểm tra lại trang giá trước khi chọn.

### 11.6 Thứ tự đề xuất

A (deploy bản hiện tại) → B (đăng nhập + database) → C (giấu đáp án) → D (song song) → E.
Giai đoạn A làm được ngay sau khi có bucket Backblaze B2 và tài khoản Vercel; Giai đoạn B đã chạy được trên Aiven PostgreSQL.
