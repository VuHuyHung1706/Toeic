# ToeicLab — web luyện thi TOEIC

Next.js 16 (App Router, Cache Components) + Tailwind CSS 4. Kế hoạch tổng thể: [PLAN.md](PLAN.md).

## Chạy local

```bash
npm install
python3 scripts/etl.py   # Data/ → content/tests/*.json (chạy lại mỗi khi sửa CSV)
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
| `/history` | Lịch sử làm bài |

Bài làm và tiến độ đang lưu ở `localStorage` (chưa có tài khoản / CSDL — giai đoạn sau).

## Cấu trúc

```
scripts/etl.py              ETL CSV → JSON
src/lib/                    types, tải dữ liệu (server), quy đổi điểm, localStorage
src/app/media/[...path]/    phục vụ audio/ảnh từ Data/
src/components/ExamRoom.tsx phòng thi (timer, autosave, audio full, nộp bài)
src/components/GroupView.tsx hiển thị một nhóm câu (dùng chung cho làm bài & xem lại)
```
