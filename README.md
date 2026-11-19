# ToeicLab — web luyện thi TOEIC

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

## Tính năng hiện có

| Trang | Mô tả |
|---|---|
| `/tests` | Kho 50 đề, lọc theo năm, hiện điểm lần thi gần nhất |
| `/tests/[id]` | Chọn **Thi thử** hoặc **Luyện tập** (chọn part, giới hạn giờ, hiện đáp án ngay) |
| `/tests/[id]/exam?mode=full` | 200 câu, 120 phút, audio full phát liền không tua, tự nộp khi hết giờ |
| `/tests/[id]/exam?mode=practice&parts=…` | Audio từng nhóm câu, chỉnh tốc độ, hiện giải thích ngay |
| `/tests/[id]/result?attempt=…` | Điểm 990 ước tính, đúng/sai theo part, xem lại từng câu + script + bản dịch |
| `/practice` | Luyện theo dạng câu: Part 2 theo loại câu hỏi, Part 5 theo chủ điểm ngữ pháp (gom từ 50 đề) |
| `/listening` | Luyện nghe Part 1–4: điền từ (3 mức độ) hoặc chép cả câu, so khớp từng từ, xem bản dịch |
| `/vocabulary` | ~1.400 từ trích từ đề, flashcard ôn ngắt quãng (hộp Leitner), tìm kiếm, lọc theo loại từ |
| `/mistakes` | Sổ câu sai: gom câu sai từ mọi nguồn, hẹn ôn lại 1 → 3 → 7 ngày tới khi thuộc |
| `/history` | Tiến độ: điểm dự đoán, biểu đồ điểm thi thử, tỉ lệ đúng theo part, lịch học 16 tuần, lịch sử làm bài |
| `/api/tests/[id]`, `/api/bank/[part]/[tag]` | JSON đề / ngân hàng câu theo dạng (prerender sẵn) cho các trang phía client |

Bài làm, lần ôn câu sai, luyện nghe và thẻ từ vựng đang lưu ở `localStorage` (chưa có tài khoản / CSDL — giai đoạn sau).

## Cấu trúc

```
scripts/etl.py              ETL CSV → JSON
scripts/enrich.py           gắn nhãn dạng câu Part 2/5, trích từ vựng
src/lib/                    types, tải dữ liệu (server), quy đổi điểm, localStorage
src/app/media/[...path]/    phục vụ audio/ảnh từ Data/
src/components/ExamRoom.tsx phòng thi (timer, autosave, audio full, nộp bài)
src/components/GroupView.tsx hiển thị một nhóm câu (dùng chung cho làm bài & xem lại)
```
