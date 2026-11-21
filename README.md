# ĐMToeic — web luyện thi TOEIC

Next.js 16 (App Router, Cache Components) + Tailwind CSS 4. Kế hoạch tổng thể: [PLAN.md](PLAN.md).

## Chạy local

```bash
npm install
python3 scripts/etl.py   # Data/ → content/ (đề, ngân hàng câu theo dạng, từ vựng); chạy lại mỗi khi sửa CSV
npm run dev              # http://localhost:3000
```

- `Data/` (~1,7 GB audio/ảnh, không commit) được phục vụ qua route `/media/...` (hỗ trợ HTTP Range để tua audio).
  Đổi vị trí bằng biến môi trường `TOEIC_DATA_DIR`; khi đưa media lên CDN thì đặt `NEXT_PUBLIC_MEDIA_BASE`.
- `content/tests/` là dữ liệu đã chuẩn hoá do ETL sinh ra; báo cáo lỗi dữ liệu ở `content/etl-report.md`.

### CSDL & đăng nhập

- Không cần cài Postgres: khi **không** có `DATABASE_URL`, server dùng PGlite (Postgres chạy bằng WASM) lưu ở `.data/pglite` và tự áp migration.
- Đăng nhập bằng email + mật khẩu (tab "Tạo tài khoản" ở `/login`); sai mật khẩu quá 5 lần/phút sẽ bị chặn tạm.
- Dùng Postgres thật (Aiven): chép `.env.example` thành `.env.local` rồi điền `DATABASE_URL`, `BETTER_AUTH_SECRET` (file này không commit).
  Khi đó cả `npm run dev` cũng ghi vào CSDL đó; muốn quay về PGlite thì comment dòng `DATABASE_URL`.

```bash
npm run db:generate      # sửa src/db/schema.ts xong → sinh migration SQL mới trong drizzle/
npm run db:migrate       # áp migration lên DATABASE_URL (không có → PGlite local)
npm run db:studio        # xem dữ liệu (drizzle-kit studio, cần DATABASE_URL)
```

## Deploy (Vercel + Aiven + Backblaze B2)

1. **Media:** ✅ đã tải 3.327 file lên bucket B2 **TOEICCC (Private)**. Tải lại / bổ sung (bỏ qua file đã có):
   ```bash
   npm run media:upload -- --dry-run
   npm run media:upload
   ```
   Bucket Private nên `/media/...` trả 302 tới B2 kèm giấy phép tải 7 ngày (`src/lib/b2.ts`) khi `MEDIA_SOURCE=b2`.
2. **CSDL:** `npm run db:migrate` với `DATABASE_URL` của Aiven (chạy lại mỗi khi có migration mới trong `drizzle/`).
3. **Vercel:** Import repo GitHub → Environment Variables: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://<domain>`,
   `MEDIA_SOURCE=b2`, `B2_KEY_ID`, `B2_APP_KEY`, `B2_BUCKET=TOEICCC` (nên là key **Read Only**). Settings → Functions → Region: chọn gần region của Aiven.
4. GitHub Actions (`.github/workflows/ci.yml`) chạy lint, typecheck, test, kiểm tra dữ liệu và build mỗi lần push.

## Kiểm thử

```bash
npm test                  # unit test (Vitest): chấm điểm, điểm dự đoán, song ngữ, chép chính tả, sổ câu sai, ghi/đọc CSDL (PGlite trong bộ nhớ)
npm run check:content     # kiểm tra toàn vẹn content/ (200 câu/đề, đáp án, media tồn tại, ngân hàng câu, từ vựng); thêm -- --skip-media khi không có Data/
npm run lint && npx tsc --noEmit && npm run build
```

## Tính năng hiện có

| Trang | Mô tả |
|---|---|
| `/tests` | Kho 48 đề (bỏ 2025 test 7, 8 vì audio lệch), lọc theo năm, hiện điểm lần thi gần nhất |
| `/tests/[id]` | Chọn **Thi thử** hoặc **Luyện tập** (chọn part, giới hạn giờ, hiện đáp án ngay) |
| `/tests/[id]/exam?mode=full` | Thi thật, giao diện giống máy thi IIG: 200 câu, 120 phút; Listening tự chuyển câu theo audio, hết audio sang Reading (làm tự do, đánh dấu xem lại); hộp NOTIFICATION khi nộp |
| `/tests/[id]/exam?mode=practice&parts=…` | Audio từng nhóm câu, chỉnh tốc độ, hiện giải thích ngay |
| `/tests/[id]/result?attempt=…` | Điểm 990 ước tính, đúng/sai theo part, xem lại từng câu + script + bản dịch |
| `/practice` | Luyện theo dạng câu: Part 2 theo loại câu hỏi, Part 5 theo chủ điểm ngữ pháp (gom từ 48 đề) |
| `/listening` | Luyện nghe Part 1–4: điền từ (3 mức độ) hoặc chép cả câu, so khớp từng từ, xem bản dịch |
| `/vocabulary` | ~2.100 từ (kèm dạng danh/động/tính/trạng từ và nghĩa, ẩn từ cơ bản) từ phần nghe và đọc, chia theo từng đề (`?test=2026-test1`), lọc Nghe/Đọc, flashcard ôn ngắt quãng |
| `/mistakes` | Sổ câu sai: gom câu sai từ mọi nguồn, hẹn ôn lại 1 → 3 → 7 ngày tới khi thuộc |
| `/history` | Tiến độ: điểm dự đoán, biểu đồ điểm thi thử, tỉ lệ đúng theo part, lịch học 16 tuần, lịch sử làm bài |
| `/login` | Đăng nhập / tạo tài khoản bằng email + mật khẩu; lần đầu hỏi chuyển dữ liệu khách vào tài khoản |
| `/api/tests/[id]`, `/api/bank/[part]/[tag]` | JSON đề / ngân hàng câu theo dạng (prerender sẵn) cho các trang phía client |
| `/api/me/sync` | `GET` toàn bộ dữ liệu học của người đang đăng nhập, `POST {ops}` ghi thay đổi |

Bài làm, lần ôn câu sai, luyện nghe, thẻ từ vựng, bài làm dở và tuỳ chọn hiển thị: khách lưu ở `localStorage`;
đã đăng nhập thì đồng bộ lên PostgreSQL (vẫn giữ bản sao trên trình duyệt để mở trang tức thì và dùng được khi mất mạng).

## Cấu trúc

```
scripts/etl.py              ETL CSV → JSON
scripts/enrich.py           gắn nhãn dạng câu Part 2/5, trích từ vựng
scripts/audio_timeline.mjs  tìm mốc thời gian từng nhóm câu nghe trong audio cả đề → content/audio-timeline.json
                            (thi thật tự chuyển câu theo audio; chạy lại ETL sau đó)
scripts/fix_group_audio.mjs cắt lại audio riêng của nhóm câu bị gán nhầm file, từ audio cả đề
                            → Data/<năm>/<testN>/audio/fixed/ (chạy sau audio_timeline, trước ETL; rồi media:upload)
src/components/CbtRoom.tsx  giao diện thi thật mô phỏng máy thi TOEIC trên máy tính (IIG)
scripts/passage.py          chuẩn hoá bài đọc Part 6/7 (ký hiệu chèn câu [1]–[4], dòng phân cách giữa các văn bản)
src/lib/passage.ts          tách bài đọc Part 6/7 thành khối: email/memo, tin nhắn, trang web, bảng, biểu mẫu, danh sách
src/components/PassageView.tsx hiển thị bài đọc Part 6/7 dạng HTML (song ngữ theo từng dòng khi bản dịch khớp dòng)
src/lib/                    types, tải dữ liệu (server), quy đổi điểm
src/lib/storage.ts          lưu trữ phía trình duyệt + hàng đợi đồng bộ server
src/lib/auth.ts             better-auth (email + mật khẩu, giới hạn tần suất)
src/db/                     Drizzle: schema, kết nối (Postgres/PGlite), đọc/ghi dữ liệu học
drizzle/                    migration SQL (sinh bằng drizzle-kit)
src/app/media/[...path]/    phục vụ audio/ảnh từ Data/
src/components/ExamRoom.tsx phòng thi (timer, autosave, audio full, nộp bài)
src/components/GroupView.tsx hiển thị một nhóm câu (dùng chung cho làm bài & xem lại)
```
