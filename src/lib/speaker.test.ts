import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { speakerTones, splitSpeaker } from "./speaker";
import type { TestData } from "./types";

describe("splitSpeaker — giữ nguyên nhãn như trong đề", () => {
  it.each([
    ["W-Am: Good morning.", "W-Am", "W", "am", "Good morning."],
    ["**M-Cn: **Oakview Apartments.", "M-Cn", "M", "cn", "Oakview Apartments."],
    ["**W-Am**: Good morning.", "W-Am", "W", "am", "Good morning."],
    ["w-Br: Hello.", "w-Br", "W", "br", "Hello."],
    ["M- Cn: Sure.", "M- Cn", "M", "cn", "Sure."],
    ["M1: First man.", "M1", "M", null, "First man."],
    ["W2: Second woman.", "W2", "W", null, "Second woman."],
    ["Man: Hi.", "Man", "M", null, "Hi."],
    ["Nữ: Xin chào.", "Nữ", "W", null, "Xin chào."],
    ["M-Nam: Chào.", "M-Nam", "M", null, "Chào."],
    ['"**M-Cn: **Căn hộ Oakview.', "M-Cn", "M", "cn", "Căn hộ Oakview."],
    ["W-Am Hello, I'm calling.", "W-Am", "W", "am", "Hello, I'm calling."],
    ["M Sure-what is it?", "M", "M", null, "Sure-what is it?"],
    ["w Good morning.", "w", "W", null, "Good morning."],
    ["M1 Thanks.", "M1", "M", null, "Thanks."],
    ["W- Am: What time?", "W- Am", "W", "am", "What time?"],
    ["W.Am I heard that.", "W.Am", "W", "am", "I heard that."],
    ["V-Au Welcome to The Boat Center.", "V-Au", null, "au", "Welcome to The Boat Center."],
    ["N-Au Thank you, Amany.", "N-Au", null, "au", "Thank you, Amany."],
    ["Mi-Au Astrid and Ulrike, do you have a minute?", "Mi-Au", "M", "au", "Astrid and Ulrike, do you have a minute?"],
    ["V-Nam: Chào mừng.", "V-Nam", "M", null, "Chào mừng."],
  ])("%s", (line, label, gender, accent, rest) => {
    const s = splitSpeaker(line)!;
    expect(s.speaker).toEqual({ label, gender, accent });
    expect(s.rest).toBe(rest);
  });

  it("không nhận nhầm câu thường", () => {
    for (const l of ["Manager: please call.", "Meeting rooms are full.", "We will start at 9:00.", "Mr. Park: hello", "Nam đã gọi điện.", "Well, let me check.", "I think so.", "Hi. I'm Malik.", "Oh, really?"])
      expect(splitSpeaker(l)).toBeNull();
  });
});

describe("speakerTones — màu theo người", () => {
  const tone = (lines: string[], l: string) => speakerTones(lines)(splitSpeaker(l)!.speaker);
  it("mỗi giới một người", () => {
    const lines = ["W-Am: Hi.", "M-Cn: Hello.", "W-Am: Bye."];
    expect(tone(lines, "W-Am: x")).toBe("W1");
    expect(tone(lines, "M-Cn: x")).toBe("M1");
  });
  it("hai người nam khác giọng → hai tông", () => {
    const lines = ["M-Cn: Hi.", "W-Br: Hello.", "M-Au: Hey."];
    expect(tone(lines, "M-Cn: x")).toBe("M1");
    expect(tone(lines, "M-Au: x")).toBe("M2");
  });
  it("cách ghi khác nhau của cùng nhãn cùng màu; W trơn cùng đoạn với W-Am là một người", () => {
    const lines = ["W: Hello.", "M: Hi.", "W- Am: What time?", "W-Au: Five.", "w-am: OK."];
    expect(tone(lines, "W: x")).toBe("W1");
    expect(tone(lines, "W-Am: x")).toBe("W1");
    expect(tone(lines, "w.am x")).toBe("W1");
    expect(tone(lines, "W-Au: x")).toBe("W2");
  });
  it("nhãn không rõ giới (V-Au) có tông riêng", () => {
    const lines = ["V-Au Welcome.", "M-Cn Thanks."];
    expect(tone(lines, "V-Au x")).toBe("X1");
    expect(tone(lines, "M-Cn x")).toBe("M1");
  });
});

describe("dữ liệu Part 3", () => {
  const all = () => {
    const idx = JSON.parse(readFileSync("content/tests/index.json", "utf8")) as { id: string }[];
    return idx.flatMap(({ id }) => {
      const t = JSON.parse(readFileSync(`content/tests/${id}.json`, "utf8")) as TestData;
      return t.parts.filter((p) => p.part === 3).flatMap((p) => p.groups.map((g) => ({ id, g })));
    });
  };

  it("dòng có dạng nhãn kèm dấu hai chấm đều được nhận ra", () => {
    const missed: string[] = [];
    let labelled = 0;
    for (const { id, g } of all())
      for (const ps of g.passages)
        for (const line of `${ps.en}\n${ps.vi}`.split("\n")) {
          if (!/^\s*["“]?\s*(\*\*)?\s*[A-Za-zữ]{1,5}\s*[-\d]?\s*[A-Za-zữ]{0,4}\s*(\*\*)?\s*:/u.test(line)) continue;
          if (splitSpeaker(line)) labelled++;
          else missed.push(`${id}: ${line.slice(0, 40)}`);
        }
    expect(labelled).toBeGreaterThan(2000);
    expect(missed.slice(0, 10)).toEqual([]);
  });

  // khoảng 8% đoạn hội thoại trong dữ liệu gốc không ghi nhãn người nói (vd 2024 Test 4–5)
  it("phần lớn đoạn hội thoại nhận ra người nói ở dòng đầu", () => {
    const groups = all();
    const ok = groups.filter(({ g }) => g.passages[0] && splitSpeaker(g.passages[0].en.split("\n")[0])).length;
    expect(ok / groups.length).toBeGreaterThan(0.9);
  });
});
