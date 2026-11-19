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
- **Tài khoản**: đăng nhập Google, lịch sử bài làm.

### Giai đoạn 2 — phân tích & ôn luyện
- Dashboard: điểm dự đoán, biểu đồ điểm theo thời gian, heatmap ngày học, tỉ lệ đúng theo part.
- **Sổ câu sai**: tự gom câu làm sai để luyện lại (spaced repetition đơn giản).
- **Luyện nghe chép chính tả** (dictation) từ audio + `Text` Part 1–4 (giống "Nghe chép" của ByeTOEIC).
- Luyện theo dạng câu (tag): Part 5 theo chủ điểm ngữ pháp (từ loại, thì, giới từ…), Part 2 theo loại câu hỏi (Wh-, Yes/No…) — gắn tag bán tự động bằng AI.
- Từ vựng: trích từ vựng từ các đề, flashcard + ôn tập ngắt quãng.

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
| CSDL | **PostgreSQL + Prisma** (hoặc Supabase) | dữ liệu quan hệ rõ ràng: đề → nhóm → câu → bài làm |
| Auth | **Auth.js (NextAuth)** – Google OAuth | giống "Đăng nhập Google trong 30 giây" |
| Lưu media | **Cloudflare R2 / S3 + CDN** | 1,2 GB mp3/ảnh, không nên để trong repo |
| ETL | Script **Python** (pandas) hoặc **Node** | làm sạch CSV → JSON chuẩn → seed DB |
| State phòng thi | Zustand + localStorage | giữ bài làm khi reload/mất mạng |
| Deploy | Vercel (app) + Neon/Supabase (DB) + R2 (media) | chi phí thấp giai đoạn đầu |

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
7. Upload media lên R2 với key `"<năm>/<testN>/audio/…"`.

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
| `/login` | Đăng nhập Google |

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
| 1 | Khởi tạo Next.js + Tailwind + Prisma; viết ETL & báo cáo lỗi; sửa dữ liệu bẩn | JSON sạch 50 đề, DB đã seed |
| 2 | Trang danh sách đề, chi tiết đề; route phục vụ media | Duyệt được đề, nghe audio, xem ảnh |
| 3 | Phòng thi Practice (theo part) + chấm + xem giải thích | Luyện từng part chạy end-to-end |
| 4 | Phòng thi Full test (audio liền mạch, timer, autosave) + trang kết quả 990 | Thi thử 200 câu hoàn chỉnh |
| 5 | Đăng nhập Google, lưu lịch sử, trang review bài làm | MVP có tài khoản |
| 6 | Responsive, kiểm thử (Playwright cho luồng thi), deploy Vercel + R2 | **MVP online** |
| 7+ | Dashboard, sổ câu sai, nghe chép, tag dạng câu, từ vựng | Giai đoạn 2 |

---

## 9. Rủi ro & lưu ý

- **Bản quyền**: nội dung đề (ETS/các bộ sách) có bản quyền. Dùng cá nhân/học tập thì ổn; nếu public hoặc thu phí cần cân nhắc kỹ. Chỉ tham khảo bố cục/tính năng của ByeTOEIC, **không sao chép** logo, tên thương hiệu, nội dung hay mã nguồn của họ.
- **Media đề 2026 thiếu** → quyết định cắt audio full hay chỉ hỗ trợ chế độ Thi thử cho bộ này.
- **Chất lượng giải thích** không đồng đều giữa các năm (có nơi chỉ dịch đáp án) → có thể dùng AI sinh bổ sung ở GĐ2.
- **Hiệu năng audio**: audio full ~45 phút; cần preload, xử lý mất mạng giữa chừng (tiếp tục từ mốc thời gian đã lưu).
- **Dung lượng**: không commit `Data/` media vào git; thêm vào `.gitignore`, dùng object storage.

---

## 10. Việc cần làm ngay

1. `git init`, tạo project Next.js trong thư mục này, thêm `Data/` vào `.gitignore`.
2. Viết `scripts/etl.py` theo mục 5, chạy và đọc `etl-report.md`.
3. Quyết định phương án cho đề 2026.
4. Dựng trang `/tests` + phòng thi Practice để có bản chạy được sớm nhất.
