"use client";

import type { Letter, PartNo, QuestionGroup } from "@/lib/types";

export type CellState = "empty" | "answered" | "correct" | "wrong" | "skipped";

export default function QuestionNav({
  groups,
  currentGroup,
  cellState,
  flagged,
  onJump,
}: {
  groups: QuestionGroup[];
  currentGroup: number;
  cellState: (n: number) => CellState;
  flagged?: Set<number>;
  onJump: (groupIndex: number, n: number) => void;
}) {
  const byPart = new Map<PartNo, { gi: number; n: number }[]>();
  groups.forEach((g, gi) => {
    for (const n of g.questionNumbers) {
      byPart.set(g.part, [...(byPart.get(g.part) ?? []), { gi, n }]);
    }
  });
  const styles: Record<CellState, string> = {
    empty: "border-line bg-surface text-muted hover:bg-surface-2",
    answered: "border-primary bg-primary text-on-primary",
    correct: "border-success bg-success-soft text-success",
    wrong: "border-danger bg-danger-soft text-danger",
    skipped: "border-warn bg-warn-soft text-warn",
  };

  return (
    <div className="space-y-4">
      {[...byPart.entries()].map(([part, cells]) => (
        <div key={part}>
          <div className="mb-1.5 text-xs font-semibold uppercase text-muted">Part {part}</div>
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-6">
            {cells.map(({ gi, n }) => (
              <button
                key={n}
                onClick={() => onJump(gi, n)}
                className={`relative h-8 rounded-md border text-xs font-semibold ${styles[cellState(n)]} ${
                  gi === currentGroup ? "ring-2 ring-fg/60 ring-offset-1 ring-offset-surface" : ""
                }`}
              >
                {n}
                {flagged?.has(n) && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-warn" />}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function answeredCount(answers: Record<number, Letter>, groups: QuestionGroup[]) {
  return groups.reduce((s, g) => s + g.questionNumbers.filter((n) => answers[n]).length, 0);
}
