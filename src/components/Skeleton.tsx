// Khung chờ tải: khối xám nhấp nháy mô phỏng bố cục trang trong lúc dữ liệu đang tải
// (thay cho chữ "Đang tải…"). Không dùng hook → dùng được cả ở server component.

const bone = "rounded-md bg-surface-2 animate-pulse motion-reduce:animate-none";

export function Bone({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`${bone} ${className}`} />;
}

/** Khung bọc: có nhãn cho trình đọc màn hình */
function Wrap({ label = "Đang tải", className = "", children }: { label?: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-label={label} className={className}>
      {children}
    </div>
  );
}

/** Một câu hỏi: số câu + đề + 4 phương án */
function QuestionBones() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <Bone className="size-8 rounded-full" />
        <Bone className="h-4 w-2/3" />
      </div>
      <div className="mt-4 space-y-2">
        {[0, 1, 2, 3].map((k) => (
          <Bone key={k} className="h-11 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/** Phòng thi / luyện tập: thanh trên + (ảnh/bài đọc | câu hỏi) */
export function ExamSkeleton({ label = "Đang tải đề" }: { label?: string }) {
  return (
    <Wrap label={label} className="flex flex-1 flex-col">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <div className="flex-1 space-y-1.5">
            <Bone className="h-4 w-32" />
            <Bone className="h-3 w-20" />
          </div>
          <Bone className="h-8 w-20" />
          <Bone className="h-8 w-24" />
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-3">
          <Bone className="h-6 w-48" />
          <Bone className="h-72 w-full rounded-lg" />
        </div>
        <div className="space-y-4">
          <QuestionBones />
          <QuestionBones />
        </div>
      </div>
    </Wrap>
  );
}

/** Một câu hỏi đứng riêng (luyện dạng câu, sổ câu sai) */
export function QuestionSkeleton({ label = "Đang tải câu hỏi" }: { label?: string }) {
  return (
    <Wrap label={label} className="mx-auto w-full max-w-3xl px-4 py-8">
      <Bone className="h-4 w-40" />
      <Bone className="mt-3 h-2 w-full" />
      <div className="mt-6">
        <QuestionBones />
      </div>
    </Wrap>
  );
}

/** Trang nội dung: tiêu đề + các thẻ (tiến độ, sổ câu sai, kho đề…) */
export function CardsSkeleton({ label, cards = 6, className = "mt-8" }: { label?: string; cards?: number; className?: string }) {
  return (
    <Wrap label={label} className={className}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((k) => (
          <div key={k} className="rounded-2xl border border-line bg-surface p-4">
            <Bone className="h-7 w-14" />
            <Bone className="mt-2 h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }, (_, k) => (
          <div key={k} className="rounded-2xl border border-line bg-surface p-4">
            <Bone className="h-4 w-1/2" />
            <Bone className="mt-3 h-3 w-full" />
            <Bone className="mt-2 h-3 w-4/5" />
          </div>
        ))}
      </div>
    </Wrap>
  );
}

/** Trang chi tiết đề / kết quả: tiêu đề + khối lớn + danh sách */
export function DetailSkeleton({ label = "Đang tải" }: { label?: string }) {
  return (
    <Wrap label={label} className="mx-auto w-full max-w-6xl px-4 py-10">
      <Bone className="h-3 w-20" />
      <Bone className="mt-3 h-8 w-64" />
      <Bone className="mt-3 h-4 w-80 max-w-full" />
      <div className="mt-8 grid gap-4 md:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <Bone className="h-5 w-40" />
          <div className="mt-4 space-y-2">
            {[0, 1, 2, 3].map((k) => (
              <Bone key={k} className="h-3 w-full" />
            ))}
          </div>
          <Bone className="mt-6 h-10 w-36 rounded-lg" />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6">
          <Bone className="h-5 w-32" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[0, 1, 2, 3, 4, 5].map((k) => (
              <Bone key={k} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </Wrap>
  );
}

/** Đoạn văn / bài nghe chép (luyện nghe) */
export function TextSkeleton({ label = "Đang tải", lines = 8, className = "mt-6" }: { label?: string; lines?: number; className?: string }) {
  return (
    <Wrap label={label} className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>
      <Bone className="h-10 w-full rounded-lg" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: lines }, (_, k) => (
          <Bone key={k} className={`h-4 ${k % 3 === 2 ? "w-3/5" : "w-full"}`} />
        ))}
      </div>
    </Wrap>
  );
}
