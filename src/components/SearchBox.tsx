"use client";
// Ô tìm kiếm có icon kính lúp và nút xoá (danh sách từ / cụm)
import UiIcon from "./UiIcon";

export default function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 transition focus-within:border-primary">
      <UiIcon name="search" className="size-4 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Xoá tìm kiếm" className="grid size-6 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg">
          <UiIcon name="close" className="size-3.5" />
        </button>
      )}
    </label>
  );
}
