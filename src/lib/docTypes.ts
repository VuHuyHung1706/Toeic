// Part 7: dòng hướng dẫn "Questions 147-148 refer to the following notice." như đề thật,
// và nhãn loại văn bản cho từng khung (Notice · Thông báo, E-mail, Article…).
import type { UiIconName } from "@/components/UiIcon";
import { parsePassage, type DocKind } from "./passage";

/** Nghĩa tiếng Việt của các loại văn bản hay gặp trong Part 7 */
const VI: Record<string, string> = {
  advertisement: "Quảng cáo",
  "job advertisement": "Tin tuyển dụng",
  "job posting": "Tin tuyển dụng",
  agenda: "Chương trình họp",
  announcement: "Thông báo",
  article: "Bài báo",
  "blog post": "Bài blog",
  "boarding pass": "Thẻ lên máy bay",
  "book review": "Bài điểm sách",
  biography: "Tiểu sử",
  bulletin: "Bản tin",
  calendar: "Lịch",
  "chat discussion": "Trò chuyện",
  checklist: "Danh sách kiểm tra",
  "company newsletter article": "Bài bản tin công ty",
  "company response": "Phản hồi của công ty",
  "company web page": "Trang web công ty",
  "contact form": "Biểu mẫu liên hệ",
  "contact list": "Danh bạ",
  contract: "Hợp đồng",
  estimate: "Bảng báo giá",
  "event schedule": "Lịch sự kiện",
  "fact sheet": "Tờ thông tin",
  "gift certificate": "Phiếu quà tặng",
  invitation: "Thư mời",
  "job description": "Mô tả công việc",
  "letter to the editor": "Thư gửi ban biên tập",
  "magazine article": "Bài tạp chí",
  "meeting agenda": "Chương trình họp",
  "meeting minutes": "Biên bản họp",
  "meeting schedule": "Lịch họp",
  "news article": "Bài báo",
  note: "Ghi chú",
  "online advertisement": "Quảng cáo trực tuyến",
  "online article": "Bài báo trực tuyến",
  "online chat": "Trò chuyện trực tuyến",
  "online forum posting": "Bài đăng diễn đàn",
  "online post": "Bài đăng trực tuyến",
  "online profile": "Hồ sơ trực tuyến",
  outline: "Dàn ý",
  "packing slip": "Phiếu đóng gói",
  "page from a handbook": "Trang sổ tay",
  "post on a web site": "Bài đăng trên trang web",
  "process chart": "Sơ đồ quy trình",
  "product chart": "Bảng sản phẩm",
  "product information": "Thông tin sản phẩm",
  reservation: "Đặt chỗ",
  "sales report": "Báo cáo doanh số",
  sign: "Biển báo",
  "summary of a report": "Tóm tắt báo cáo",
  "survey form": "Phiếu khảo sát",
  "survey response": "Phản hồi khảo sát",
  "table of contents": "Mục lục",
  testimonial: "Lời chứng thực",
  ticket: "Vé",
  "web site": "Trang web",
  "webinar description": "Giới thiệu hội thảo trực tuyến",
  "work order": "Phiếu công việc",
  brochure: "Tờ giới thiệu",
  card: "Thiệp",
  catalog: "Danh mục sản phẩm",
  chart: "Biểu đồ",
  coupon: "Phiếu giảm giá",
  "customer review": "Đánh giá của khách",
  "e-mail": "Email",
  flyer: "Tờ rơi",
  form: "Biểu mẫu",
  "online form": "Biểu mẫu trực tuyến",
  "application form": "Đơn đăng ký",
  "order form": "Phiếu đặt hàng",
  "registration form": "Phiếu đăng ký",
  guidelines: "Hướng dẫn",
  information: "Thông tin",
  instructions: "Hướng dẫn",
  invoice: "Hoá đơn",
  itinerary: "Lịch trình",
  label: "Nhãn",
  letter: "Thư",
  list: "Danh sách",
  memo: "Bản ghi nhớ",
  menu: "Thực đơn",
  notice: "Thông báo",
  "online chat discussion": "Trò chuyện trực tuyến",
  "online review": "Đánh giá trực tuyến",
  "press release": "Thông cáo báo chí",
  "price list": "Bảng giá",
  plan: "Kế hoạch",
  policy: "Chính sách",
  post: "Bài đăng",
  "product review": "Đánh giá sản phẩm",
  receipt: "Biên lai",
  report: "Báo cáo",
  review: "Bài đánh giá",
  schedule: "Lịch",
  survey: "Khảo sát",
  table: "Bảng",
  "text message": "Tin nhắn",
  "text-message chain": "Chuỗi tin nhắn",
  "web page": "Trang web",
};

/** Dạng số ít: "e-mails" → "e-mail", "Web pages" → "web page" (giữ "instructions", "guidelines"…) */
function singular(s: string): string {
  const t = s.toLowerCase();
  if (VI[t]) return t;
  if (t.endsWith("ies") && VI[t.slice(0, -3) + "y"]) return t.slice(0, -3) + "y";
  if (t.endsWith("s") && VI[t.slice(0, -1)]) return t.slice(0, -1);
  return t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t;
}

/**
 * "article, e-mail, and plan" → ["article", "e-mail", "plan"];
 * "e-mails and notice" (3 văn bản) → ["e-mail", "e-mail", "notice"].
 * Không khớp số văn bản → [] (không gắn nhãn sai).
 */
export function docTypes(phrase: string, docCount: number): string[] {
  const items = phrase
    .replace(/\.$/, "")
    .split(/\s*,\s*(?:and\s+)?|\s+and\s+/)
    .map((s) => s.replace(/^(?:an?|the|two|three)\s+/i, "").trim())
    .filter(Boolean);
  const plural = items.map((s) => s.toLowerCase() !== singular(s) && !VI[s.toLowerCase()]);
  const out: string[] = [];
  const extra = docCount - items.length;
  items.forEach((s, i) => {
    const one = singular(s);
    // "e-mails" chiếm phần văn bản còn dư (thường 2); nhiều mục số nhiều thì mỗi mục 2
    const n = plural[i] ? (plural.filter(Boolean).length === 1 ? 1 + extra : 2) : 1;
    for (let k = 0; k < n; k++) out.push(one);
  });
  return out.length === docCount ? out : [];
}

/** Tên hiển thị: "Web page" giữ chữ W hoa như đề, còn lại viết hoa chữ đầu */
export function docTitle(type: string): { en: string; vi?: string } {
  const en = (type.charAt(0).toUpperCase() + type.slice(1)).replace(/\bweb\b/gi, "Web");
  const vi = VI[type];
  // "E-mail · Email" thừa → chỉ hiện nghĩa khi khác tên tiếng Anh
  const same = (x: string) => x.toLowerCase().replace(/[^a-z]/g, "");
  return { en, vi: vi && same(vi) !== same(en) ? vi : undefined };
}

export function docIcon(type: string): UiIconName {
  if (/chat|message/.test(type)) return "chat";
  if (/e-mail|letter|memo/.test(type)) return "mail";
  if (/web|online|post/.test(type)) return "globe";
  if (/form|survey|invoice|receipt|list|schedule|table|chart|agenda|itinerary|coupon|label/.test(type)) return "list";
  return "document";
}

/** "147–148" từ danh sách số câu */
export function questionRange(numbers: number[]): string {
  return numbers.length > 1 ? `${numbers[0]}-${numbers[numbers.length - 1]}` : String(numbers[0]);
}

/** Loại văn bản có hợp với dạng nhận ra từ nội dung không (email ↔ e-mail/memo, chat ↔ tin nhắn, web ↔ trang web) */
function fits(kind: DocKind, type: string): boolean {
  if (kind === "email") return /e-mail|memo/.test(type);
  if (kind === "chat") return /chat|message/.test(type);
  if (kind === "web") return /web|online|post/.test(type);
  return false;
}

/**
 * Gán loại cho từng văn bản. Đề ghi số nhiều gộp lại ("e-mails and notice") nên thứ tự thật có thể là
 * e-mail, notice, e-mail → văn bản nhận ra được dạng (email/chat/web) lấy loại hợp trước, còn lại theo thứ tự.
 */
export function assignDocTypes(phrase: string, kinds: DocKind[]): string[] {
  const types = docTypes(phrase, kinds.length);
  if (!types.length || new Set(types).size === types.length) return types; // không gộp số nhiều → đúng thứ tự đề
  const left = [...types];
  const out: (string | undefined)[] = kinds.map((k) => {
    const i = left.findIndex((t) => fits(k, t));
    return i >= 0 ? left.splice(i, 1)[0] : undefined;
  });
  return out.map((t) => t ?? left.shift()!);
}

/**
 * Chia loại văn bản của cả nhóm cho từng đoạn (mỗi đoạn có thể gồm nhiều văn bản ngăn bởi "==="):
 * trả về mảng theo đoạn, đoạn nào không xác định được thì undefined.
 */
export function passageDocTypes(directions: string | undefined, texts: string[]): (string[] | undefined)[] {
  const kinds = texts.map((t) => parsePassage(t).map((d) => d.kind));
  const all = directions ? assignDocTypes(directions, kinds.flat()) : [];
  let start = 0;
  return kinds.map((k) => {
    const out = all.length ? all.slice(start, start + k.length) : undefined;
    start += k.length;
    return out;
  });
}
