// Dòng đếm phía trên danh sách có phân trang: "31–60 / 1.442 từ"
export default function ListCount({ from, shown, total, unit }: { from: number; shown: number; total: number; unit: string }) {
  const n = (x: number) => x.toLocaleString("vi-VN");
  return (
    <div className="mt-4 mb-2 text-sm text-muted tabular-nums">
      {total > shown ? (
        <>
          {n(from + 1)}–{n(from + shown)} / {n(total)} {unit}
        </>
      ) : (
        <>
          {n(total)} {unit}
        </>
      )}
    </div>
  );
}
