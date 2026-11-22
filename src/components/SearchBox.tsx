"use client";
// Ô tìm kiếm có icon kính lúp và nút xoá (danh sách từ / cụm)

export default function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 transition focus-within:border-primary">
      <svg viewBox="0 0 24 24" aria-hidden className="size-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Xoá tìm kiếm" className="text-sm text-muted hover:text-fg">
          ✕
        </button>
      )}
    </label>
  );
}
