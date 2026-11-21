// Phân biệt "bấm để chọn đáp án" với "bôi đen chữ để copy" trên cùng một phương án.
// Không dựa vào window.getSelection() lúc click (trình duyệt có thể còn giữ vùng chọn cũ),
// mà dựa vào cử chỉ: kéo chuột đi xa điểm nhấn, hoặc bấm đúp/ba lần để chọn từ/dòng.

let down: { x: number; y: number } | null = null;
if (typeof window !== "undefined") {
  window.addEventListener(
    "pointerdown",
    (e) => {
      down = { x: e.clientX, y: e.clientY };
    },
    { capture: true, passive: true },
  );
}

/** true nếu cú click này thực ra là thao tác bôi đen chữ (kéo chuột, hoặc bấm đúp/ba lần) */
export function isTextSelectGesture(e: { detail: number; clientX: number; clientY: number }): boolean {
  if (e.detail === 0) return false; // click sinh ra từ bàn phím (Enter/Space)
  if (e.detail >= 2) return true; // bấm đúp chọn từ, bấm ba lần chọn dòng
  if (!down) return false;
  return Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5;
}
