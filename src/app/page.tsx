import Link from "next/link";
import ClientOnly from "@/components/ClientOnly";
import HomeToday from "@/components/HomeToday";
import { Icon, sectionOf } from "@/components/SectionIcons";
import { PARTS } from "@/lib/toeic";

const CARDS: [href: string, title: string, desc: string][] = [
  ["/tests", "Thi thử & luyện đề", "200 câu bấm giờ như phòng thi, hoặc luyện riêng từng part kèm giải thích."],
  ["/practice", "Luyện theo dạng câu", "Part 2 theo loại câu hỏi, Part 5 theo chủ điểm ngữ pháp — gom từ cả 48 đề."],
  ["/listening", "Luyện nghe chép chính tả", "Điền từ còn thiếu hoặc chép lại cả câu từ audio Part 1–4."],
  ["/vocabulary", "Từ vựng TOEIC", "50–90 từ TOEIC hay gặp mỗi đề, học bằng thẻ ghi nhớ với lịch ôn ngắt quãng."],
  ["/mistakes", "Sổ câu sai", "Tự gom câu làm sai và hẹn ngày ôn lại tới khi thuộc."],
  ["/history", "Tiến độ & điểm dự đoán", "Biểu đồ điểm, tỉ lệ đúng từng part, lịch học và điểm dự đoán."],
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <ClientOnly>
        <HomeToday />
      </ClientOnly>

      <section className="grid gap-3 md:grid-cols-3">
        {CARDS.map(([href, title, desc]) => {
          const s = sectionOf(href);
          return (
            <Link
              key={href}
              href={href}
              className="group flex gap-4 rounded-xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-sm motion-reduce:hover:translate-y-0"
            >
              <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${s.tint}`}>
                <Icon
                  name={s.icon}
                  className={`size-6 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6 motion-reduce:transition-none ${s.color}`}
                />
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="mt-1 block text-sm text-muted">{desc}</span>
              </span>
            </Link>
          );
        })}
      </section>

      <section className="mt-16">
        <h2 className="text-xl font-bold">Cấu trúc đề thi</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PARTS.map((p) => (
            <div key={p.part} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between text-xs font-semibold uppercase text-muted">
                <span>Part {p.part}</span>
                <span>{p.skill === "listening" ? "Nghe" : "Đọc"}</span>
              </div>
              <div className="mt-1 font-semibold">{p.name}</div>
              <div className="mt-1 text-sm text-muted">
                {p.count} câu · {p.desc}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
