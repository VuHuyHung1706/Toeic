"use client";
// Trang Từ vựng: chọn mục "Từ theo đề" (VocabTrainer) hoặc "Cụm giới từ" (PhraseTrainer). Mục đang xem ghi vào URL (?section=phrases).
// Hai mục giữ nguyên khi chuyển tab (chỉ ẩn đi), để phiên học thẻ dở không mất — chỉ mất khi bấm "Thoát".
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import PhraseTrainer from "./PhraseTrainer";
import SegmentedTabs from "./SegmentedTabs";
import VocabTrainer from "./VocabTrainer";

type Section = "words" | "phrases";

export default function VocabHub({ tests }: { tests: { id: string; year: number; number: number }[] }) {
  const router = useRouter();
  const [section, setSection] = useState<Section>(useSearchParams().get("section") === "phrases" ? "phrases" : "words");
  // mục Cụm giới từ chỉ tải dữ liệu khi được mở lần đầu
  const [phrasesOpened, setPhrasesOpened] = useState(section === "phrases");
  return (
    <>
      <div className="mt-6">
        <SegmentedTabs
          label="Mục từ vựng"
          items={[
            { key: "words" as const, label: "Từ theo đề" },
            { key: "phrases" as const, label: "Cụm giới từ" },
          ]}
          value={section}
          onChange={(s) => {
            setSection(s);
            if (s === "phrases") setPhrasesOpened(true);
            router.replace(s === "phrases" ? "/vocabulary?section=phrases" : "/vocabulary", { scroll: false });
          }}
        />
      </div>
      <div hidden={section !== "words"}>
        <VocabTrainer tests={tests} active={section === "words"} />
      </div>
      {phrasesOpened && (
        <div hidden={section !== "phrases"}>
          <PhraseTrainer active={section === "phrases"} />
        </div>
      )}
    </>
  );
}
