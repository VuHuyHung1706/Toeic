// Bài ngữ pháp TOEIC (nội dung viết riêng cho ĐMToeic).
// Mỗi bài: các mục (đoạn văn, danh sách, bảng, mẹo, bẫy, ví dụ song ngữ) + cách chọn câu thật trong đề làm ví dụ
// (`examples`: các dạng câu trong ngân hàng Part 5 + điều kiện lọc) + dạng câu để "Luyện ngay".
// Trong chuỗi, **chữ** được in đậm; "____" là chỗ trống.

import type { Question } from "./types";

export type Block =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "tip"; text: string }
  | { kind: "trap"; text: string }
  | { kind: "examples"; items: { en: string; vi: string }[] };

export interface GrammarSection {
  heading: string;
  blocks: Block[];
}

export interface GrammarTopic {
  slug: string;
  group: (typeof GROUPS)[number];
  title: string;
  summary: string;
  /** dạng câu Part 5 để luyện ngay (bank tag) */
  practice?: string;
  /** chọn câu thật trong đề làm ví dụ: các dạng câu Part 5 cần tìm + điều kiện */
  examples?: { tags: string[]; match?: (q: Question) => boolean };
  sections: GrammarSection[];
  /** trang ngữ pháp Cambridge / British Council đã dùng để đối chiếu nội dung bài */
  sources: { label: string; url: string }[];
}

const CAM = "https://dictionary.cambridge.org/grammar/british-grammar/";
const CAM_US = "https://dictionary.cambridge.org/us/grammar/british-grammar/";
const BC = "https://learnenglish.britishcouncil.org/free-resources/grammar/";

export const GROUPS = ["Từ loại & cụm từ", "Động từ", "Mệnh đề & liên kết"] as const;

const ans = (q: Question) => (q.answer ? (q.options[q.answer] ?? "").trim().toLowerCase() : "");
const inSet = (words: string[]) => (q: Question) => words.includes(ans(q));
const BE = /^(is|are|was|were|be|been|being|has been|have been|had been|will be|can be|should be|must be|to be)\s+\w+(ed|en|wn|t|ne)$/;
/** từ đứng ngay trước chỗ trống (chữ thường) */
const BLANK = /(?:-\s*){3,}|—[-—\s]*|_{3,}/;
const before = (q: Question) => {
  const m = BLANK.exec(q.question);
  return m ? (q.question.slice(0, m.index).trim().split(/\s+/).pop() ?? "").toLowerCase().replace(/[^a-z']/g, "") : "";
};
const PREPS = ["for", "by", "before", "after", "without", "of", "in", "on", "about", "upon", "from", "at", "with", "toward", "towards", "despite", "besides"];
const DETS = ["the", "a", "an", "its", "their", "our", "your", "his", "her", "this", "these", "those", "that", "my"];

export const TOPICS: GrammarTopic[] = [
  // ================= TỪ LOẠI & CỤM TỪ =================
  {
    slug: "tu-loai",
    group: "Từ loại & cụm từ",
    title: "Từ loại: danh từ, tính từ, trạng từ",
    summary: "Nhìn vị trí chỗ trống để biết cần loại từ nào — dạng câu chiếm nhiều nhất Part 5.",
    practice: "word-form",
    examples: { tags: ["word-form"], match: (q) => /(tion|sion|ment|ness|ity|ance|ence|ship|ive|able|ible|ful|ous|al|ic|ly)$/.test(ans(q)) },
    sources: [
      { label: "Cambridge — Adjectives: forms", url: CAM + 'adjectives-forms' },
      { label: "Cambridge — Adverbs: forms", url: CAM_US + 'adverbs-forms' },
      { label: "Cambridge — Suffixes", url: CAM_US + 'suffixes' },
    ],
    sections: [
      {
        heading: "Cách làm nhanh",
        blocks: [
          {
            kind: "p",
            text: "Bốn phương án thường cùng một gốc (vd *produce, product, productive, productively*). Không cần dịch cả câu: chỉ cần xem **từ đứng ngay trước và ngay sau chỗ trống** để biết câu đang thiếu loại từ nào, rồi nhận diện loại từ qua đuôi.",
          },
        ],
      },
      {
        heading: "Vị trí của từng loại từ",
        blocks: [
          {
            kind: "table",
            head: ["Cần", "Vị trí thường gặp", "Ví dụ"],
            rows: [
              ["Danh từ", "sau mạo từ / tính từ sở hữu (a, the, their…); sau tính từ; sau giới từ; làm chủ ngữ / tân ngữ", "the **approval** of the budget"],
              ["Tính từ", "trước danh từ; sau be / become / seem / remain / stay; sau find / make / keep + tân ngữ", "a **reliable** supplier · remain **competitive**"],
              ["Trạng từ", "bổ nghĩa động từ, tính từ, trạng từ khác hoặc cả câu; thường giữa trợ động từ và động từ chính", "has **recently** expanded · **highly** effective"],
              ["Động từ", "sau chủ ngữ; sau trợ động từ / động từ khuyết thiếu (will, can, should…)", "The firm will **expand** next year."],
            ],
          },
        ],
      },
      {
        heading: "Nhận diện qua đuôi từ",
        blocks: [
          {
            kind: "table",
            head: ["Loại từ", "Đuôi hay gặp"],
            rows: [
              ["Danh từ", "-tion, -sion, -ment, -ness, -ity, -ance/-ence, -ship, -er/-or/-ee/-ant (chỉ người), -ure, -al (arrival, approval)"],
              ["Tính từ", "-ive, -able/-ible, -ful, -less, -ous, -al, -ic, -ent/-ant, -y"],
              ["Trạng từ", "phần lớn là tính từ + -ly (quickly, carefully)"],
              ["Động từ", "-ize/-ise, -ify, -en, -ate"],
            ],
          },
          {
            kind: "trap",
            text: "Một số từ đuôi **-ly** chỉ là **tính từ**: *friendly, costly, timely, likely, lovely, orderly* (muốn diễn tả cách thức thì nói *in a friendly way*). Vài từ vừa là tính từ vừa là trạng từ: *daily, weekly, monthly, early*. Ngược lại *-al* có thể là danh từ: *proposal, arrival, approval, rental*.",
          },
        ],
      },
      {
        heading: "Bẫy hay gặp",
        blocks: [
          {
            kind: "list",
            items: [
              "Danh từ chỉ người hay chỉ vật: *applicant* (người nộp đơn) ≠ *application* (đơn). Xem nghĩa và mạo từ: **an** applicant / **the** applications.",
              "Danh từ đếm được số ít luôn cần mạo từ/từ hạn định: ~~a~~ ____ *information* (không đếm được) nhưng **an** *instruction*.",
              "Giữa **be** và V-ed/V-ing (bị động/tiếp diễn) là chỗ của **trạng từ**: is ____ *(carefully)* reviewed.",
              "Sau *become, remain, seem, appear* cần **tính từ**, không dùng trạng từ: seems **reasonable**.",
            ],
          },
        ],
      },
      {
        heading: "Ví dụ",
        blocks: [
          {
            kind: "examples",
            items: [
              { en: "The new policy requires the **approval** of two managers.", vi: "Chính sách mới cần sự phê duyệt của hai quản lý." },
              { en: "Our technicians respond **promptly** to every service request.", vi: "Kỹ thuật viên của chúng tôi phản hồi nhanh chóng mọi yêu cầu dịch vụ." },
              { en: "Customers found the online form **confusing**.", vi: "Khách hàng thấy biểu mẫu trực tuyến khó hiểu." },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "dai-tu",
    group: "Từ loại & cụm từ",
    title: "Đại từ: nhân xưng, sở hữu, phản thân",
    summary: "Chọn đúng dạng he / him / his / himself theo vị trí trong câu.",
    practice: "pronoun",
    examples: { tags: ["pronoun"] },
    sources: [
      { label: "Cambridge — Possessive pronouns", url: CAM + 'pronouns-possessive-my-mine-your-yours-etc' },
      { label: "Cambridge — Reflexive pronouns", url: CAM + 'pronouns-reflexive-myself-themselves-etc' },
      { label: "British Council — Reflexive pronouns", url: BC + 'english-grammar-reference/reflexive-pronouns' },
    ],
    sections: [
      {
        heading: "Bảng đại từ",
        blocks: [
          {
            kind: "table",
            head: ["Chủ ngữ", "Tân ngữ", "Tính từ sở hữu", "Đại từ sở hữu", "Phản thân"],
            rows: [
              ["I", "me", "my", "mine", "myself"],
              ["you", "you", "your", "yours", "yourself / yourselves"],
              ["he", "him", "his", "his", "himself"],
              ["she", "her", "her", "hers", "herself"],
              ["it", "it", "its", "—", "itself"],
              ["we", "us", "our", "ours", "ourselves"],
              ["they", "them", "their", "theirs", "themselves"],
            ],
          },
        ],
      },
      {
        heading: "Chọn theo vị trí",
        blocks: [
          {
            kind: "list",
            items: [
              "Trước động từ (làm chủ ngữ) → **chủ ngữ**: ____ *will* attend → **she**.",
              "Sau động từ / giới từ → **tân ngữ**: send it to ____ → **them**.",
              "Trước danh từ → **tính từ sở hữu**: ____ *report* → **their** report.",
              "Đứng một mình thay cho \"tính từ sở hữu + danh từ\" → **đại từ sở hữu**: *My office is small; ____ is larger* → **hers**.",
              "Chủ ngữ và tân ngữ là một người → **phản thân**: *He introduced* **himself**. Đứng cuối câu hoặc sau chủ ngữ để nhấn mạnh: *The CEO* **herself** *approved it*.",
            ],
          },
          { kind: "tip", text: "**by + đại từ phản thân** = tự mình, một mình: *She completed the audit* **by herself**." },
          { kind: "trap", text: "Sau giới từ chỉ nơi chốn dùng **tân ngữ**, không dùng phản thân: *She put the bag* **beside her** (không phải *beside herself*)." },
          { kind: "trap", text: "**its** (của nó) khác **it's** (= it is). Không có dạng *its'* hay *their's*." },
        ],
      },
      {
        heading: "Đại từ bất định & chỉ định",
        blocks: [
          {
            kind: "list",
            items: [
              "**those who** + động từ số nhiều = những người mà: *Those who register early receive a discount.*",
              "**anyone / everyone / someone** + động từ số ít: *Everyone* **has** *received the memo.*",
              "**one another / each other**: lẫn nhau. **others** (những người/cái khác) — **the others** (phần còn lại đã xác định).",
            ],
          },
        ],
      },
      {
        heading: "Ví dụ",
        blocks: [
          {
            kind: "examples",
            items: [
              { en: "Ms. Lee asked us to send the revised contract to **her** by Friday.", vi: "Bà Lee yêu cầu chúng tôi gửi hợp đồng đã chỉnh sửa cho bà trước thứ Sáu." },
              { en: "The interns organized the workshop **themselves**.", vi: "Các thực tập sinh tự tổ chức buổi hội thảo." },
              { en: "Our prices are lower than **theirs**.", vi: "Giá của chúng tôi thấp hơn giá của họ." },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "luong-tu",
    group: "Từ loại & cụm từ",
    title: "Từ hạn định & lượng từ",
    summary: "each, every, many, much, few, little, all, most… đi với danh từ số ít, số nhiều hay không đếm được.",
    examples: {
      tags: ["word-form", "pronoun", "vocabulary", "prep-conj"],
      match: inSet(["each", "every", "many", "much", "few", "a few", "little", "a little", "several", "all", "most", "both", "either", "neither", "another", "other", "others", "any", "some", "numerous", "various"]),
    },
    sources: [
      { label: "British Council — Quantifiers", url: BC + 'english-grammar-reference/quantifiers' },
      { label: "Cambridge — Much, many, a lot of", url: CAM + 'much-many-a-lot-of-lots-of-quantifiers' },
    ],
    sections: [
      {
        heading: "Đi với loại danh từ nào?",
        blocks: [
          {
            kind: "table",
            head: ["Từ", "Danh từ đi kèm", "Ví dụ"],
            rows: [
              ["each, every, another, either, neither", "đếm được **số ít**", "**every** employee · **each** department"],
              ["many, few, a few, several, numerous, both, various", "đếm được **số nhiều**", "**several** options · **a few** days"],
              ["much, little, a little, a great deal of", "**không đếm được**", "**much** information · **little** time"],
              ["all, most, some, any, a lot of, plenty of", "số nhiều **hoặc** không đếm được", "**most** customers · **some** equipment"],
            ],
          },
          {
            kind: "tip",
            text: "**each of / most of / all of / some of** + **the / my / these…** + danh từ: *each* **of the** *participants*. Không nói *most of participants*.",
          },
        ],
      },
      {
        heading: "few / a few, little / a little",
        blocks: [
          {
            kind: "list",
            items: [
              "**a few / a little** = một vài, một chút (ý tích cực, đủ dùng).",
              "**few / little** = rất ít, hầu như không (ý tiêu cực).",
              "**each** có thể đứng sau chủ ngữ số nhiều: *The rooms* **each** *have a balcony.*",
            ],
          },
          { kind: "trap", text: "Danh từ không đếm được hay gặp: *information, equipment, furniture, advice, luggage, baggage, merchandise, feedback, research* — không thêm -s, không dùng *many / a / several*." },
        ],
      },
      {
        heading: "Ví dụ",
        blocks: [
          {
            kind: "examples",
            items: [
              { en: "**Every** applicant must submit two references.", vi: "Mỗi ứng viên phải nộp hai thư giới thiệu." },
              { en: "We received **little** feedback on the first draft.", vi: "Chúng tôi nhận được rất ít phản hồi về bản nháp đầu." },
              { en: "**Most of the** staff prefer the new schedule.", vi: "Phần lớn nhân viên thích lịch làm việc mới." },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "so-sanh",
    group: "Từ loại & cụm từ",
    title: "So sánh hơn, so sánh nhất, so sánh bằng",
    summary: "Dấu hiệu than / the / as…as quyết định dạng của tính từ, trạng từ.",
    practice: "comparison",
    examples: { tags: ["comparison"], match: (q) => /(er|est)$|^(more|most|less|least|better|best|worse|worst|as)\b/.test(ans(q)) },
    sources: [
      { label: "Cambridge — Comparison: adjectives", url: CAM + 'comparison-adjectives-bigger-biggest-more-interesting' },
      { label: "British Council — Modifying comparatives", url: BC + 'b1-b2/modifying-comparatives' },
      { label: "Cambridge — Farther or further", url: CAM + 'farther-farthest-or-further-furthest' },
    ],
    sections: [
      {
        heading: "Công thức",
        blocks: [
          {
            kind: "table",
            head: ["Loại", "Tính từ/trạng từ ngắn", "Tính từ/trạng từ dài", "Dấu hiệu"],
            rows: [
              ["So sánh hơn", "adj-**er** + than", "**more** adj + than", "than; much / far / even / still + so sánh hơn"],
              ["So sánh nhất", "the adj-**est**", "the **most** adj", "the; of / in / among…; ever; one of the + số nhiều"],
              ["So sánh bằng", "as + adj/adv (nguyên dạng) + as", "", "as … as; the same (noun) as"],
            ],
          },
          {
            kind: "tip",
            text: "Bất quy tắc: good/well → better → best · bad/badly → worse → worst · many/much → more → most · little → less → least · far → farther/further → farthest/furthest.",
          },
        ],
      },
      {
        heading: "Mẫu hay gặp trong đề",
        blocks: [
          {
            kind: "list",
            items: [
              "**much / far / even / a lot / considerably / significantly** + so sánh hơn (nhấn mạnh): *far* **more** *efficient*. Chênh ít: **slightly / a little / a bit**. Không dùng *very* trước so sánh hơn.",
              "**The + so sánh hơn …, the + so sánh hơn …**: càng … càng …: *The earlier you book, the* **lower** *the price.*",
              "**one of the + so sánh nhất + danh từ số nhiều**: *one of the* **largest** *suppliers*.",
              "Trạng từ bổ nghĩa động từ cũng so sánh được: *work* **more efficiently** *than before*.",
            ],
          },
          { kind: "trap", text: "Thấy **than** thì chắc chắn là so sánh hơn, dù phương án nguyên dạng nghe hợp nghĩa. Thấy **as … as** thì giữ nguyên dạng, không thêm -er/more." },
        ],
      },
      {
        heading: "Ví dụ",
        blocks: [
          {
            kind: "examples",
            items: [
              { en: "The new printer is **much faster than** the old one.", vi: "Máy in mới nhanh hơn nhiều so với máy cũ." },
              { en: "This is **the most popular** tour we offer.", vi: "Đây là tour được ưa chuộng nhất mà chúng tôi có." },
              { en: "Sales this quarter were **as high as** last year's.", vi: "Doanh số quý này cao bằng năm ngoái." },
            ],
          },
        ],
      },
    ],
  },

  // ================= ĐỘNG TỪ =================
  {
    slug: "thi",
    group: "Động từ",
    title: "Thì của động từ & dấu hiệu thời gian",
    summary: "Đọc trạng từ thời gian trong câu để chọn thì — không cần dịch cả câu.",
    practice: "verb",
    examples: {
      tags: ["verb"],
      match: (q) =>
        !BE.test(ans(q)) &&
        /^(will|has|have|had|is|are|was|were|am)\s+\w+|^\w+ed$/.test(ans(q)) &&
        before(q) !== "to" &&
        /\b(yesterday|last|ago|since|for the past|so far|already|recently|currently|now|next|tomorrow|by the time|by the end|until|soon|upcoming|every|usually|each)\b/i.test(q.question),
    },
    sources: [
      { label: "Cambridge — Present simple", url: CAM + 'present-simple-i-work' },
      { label: "British Council — Verbs in time clauses and if clauses", url: BC + 'english-grammar-reference/verbs-time-clauses-if-clauses' },
      { label: "Cambridge — Conjunctions: time", url: CAM + 'conjunctions-time' },
    ],
    sections: [
      {
        heading: "Các thì hay gặp và dấu hiệu",
        blocks: [
          {
            kind: "table",
            head: ["Thì", "Công thức", "Dấu hiệu"],
            rows: [
              ["Hiện tại đơn", "V / V-s(es)", "every, usually, always, often; lịch trình cố định"],
              ["Hiện tại tiếp diễn", "am/is/are + V-ing", "now, currently, at the moment, this week"],
              ["Hiện tại hoàn thành", "have/has + V3", "since, for + khoảng thời gian, already, recently, so far, over the past …"],
              ["Quá khứ đơn", "V-ed / V2", "yesterday, last …, … ago, in 2023"],
              ["Quá khứ hoàn thành", "had + V3", "by the time + quá khứ, before + quá khứ"],
              ["Tương lai đơn", "will + V", "tomorrow, next …, soon, upcoming"],
              ["Tương lai hoàn thành", "will have + V3", "by + mốc tương lai, by the time + hiện tại đơn"],
            ],
          },
        ],
      },
      {
        heading: "Quy tắc cần nhớ",
        blocks: [
          {
            kind: "list",
            items: [
              "Mệnh đề thời gian / điều kiện (**when, before, after, as soon as, once, until, if**) nói về tương lai dùng **hiện tại đơn** (hoặc hiện tại hoàn thành), không dùng will: *We will call you* **when** *the parts* **arrive**. *will* vẫn ở mệnh đề chính.",
              "**since + mốc thời gian** → hiện tại hoàn thành ở mệnh đề chính: *has worked here* **since** *2019*.",
              "**for the past / over the last + khoảng thời gian** → hiện tại hoàn thành.",
              "Bốn phương án thường khác cả thì lẫn chủ động/bị động: loại trước theo **chủ động/bị động** (xem bài Câu bị động), rồi mới chọn thì.",
            ],
          },
          { kind: "trap", text: "Chủ ngữ số ít ở hiện tại đơn cần **-s/-es**: *The manager* **reviews** *every report.* Phương án thiếu -s thường là bẫy." },
        ],
      },
      {
        heading: "Ví dụ",
        blocks: [
          {
            kind: "examples",
            items: [
              { en: "The company **has opened** three branches since last spring.", vi: "Công ty đã mở ba chi nhánh kể từ mùa xuân năm ngoái." },
              { en: "By the time the guests arrived, the staff **had set up** the hall.", vi: "Khi khách đến, nhân viên đã chuẩn bị xong hội trường." },
              { en: "Please wait until the technician **finishes** the inspection.", vi: "Vui lòng đợi đến khi kỹ thuật viên kiểm tra xong." },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "bi-dong",
    group: "Động từ",
    title: "Câu bị động",
    summary: "Chủ ngữ là người làm hay vật bị tác động? Có tân ngữ sau chỗ trống không?",
    practice: "verb",
    examples: { tags: ["verb"], match: (q) => BE.test(ans(q)) },
    sources: [
      { label: "Cambridge — Passive: forms", url: CAM + 'passive-forms' },
      { label: "Cambridge — Verb patterns: with and without objects", url: CAM + 'verb-patterns-with-and-without-objects' },
    ],
    sections: [
      {
        heading: "Công thức",
        blocks: [
          { kind: "p", text: "**be + V3 (quá khứ phân từ)**. Phần *be* chia theo thì; phần V3 giữ nguyên." },
          {
            kind: "table",
            head: ["Thì", "Bị động"],
            rows: [
              ["Hiện tại đơn", "am/is/are + V3"],
              ["Hiện tại tiếp diễn", "am/is/are **being** + V3"],
              ["Hiện tại hoàn thành", "have/has **been** + V3"],
              ["Quá khứ đơn", "was/were + V3"],
              ["Tương lai / khuyết thiếu", "will / can / must / should **be** + V3"],
            ],
          },
        ],
      },
      {
        heading: "Cách nhận biết trong đề",
        blocks: [
          {
            kind: "list",
            items: [
              "Động từ cần tân ngữ (send, approve, review…) mà **sau chỗ trống không có tân ngữ** → thường là bị động: *The invoice* ____ *yesterday* → **was sent**.",
              "Sau chỗ trống có **by + người/tổ chức** → bị động.",
              "Chủ ngữ là **vật** không tự làm hành động (report, order, meeting) → nghiêng về bị động.",
              "Sau chỗ trống có **danh từ làm tân ngữ** → chủ động.",
            ],
          },
          {
            kind: "trap",
            text: "Động từ không có tân ngữ (*arrive, occur, happen, rise, remain, expire*) **không có bị động**: *The shipment* **arrived** (không phải *was arrived*).",
          },
          {
            kind: "tip",
            text: "Cụm bị động cố định: *be required to, be expected to, be scheduled to/for, be located in, be pleased with, be interested in, be committed to + V-ing, be dedicated to + V-ing*.",
          },
        ],
      },
      {
        heading: "Ví dụ",
        blocks: [
          {
            kind: "examples",
            items: [
              { en: "All expense reports **must be submitted** by the end of the month.", vi: "Mọi báo cáo chi phí phải được nộp trước cuối tháng." },
              { en: "The conference room **is being renovated** this week.", vi: "Phòng họp đang được sửa sang trong tuần này." },
              { en: "The award **was presented** by the mayor.", vi: "Giải thưởng được trao bởi thị trưởng." },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "hoa-hop",
    group: "Động từ",
    title: "Hòa hợp chủ ngữ – động từ",
    summary: "Tìm đúng chủ ngữ thật để chia động từ số ít hay số nhiều.",
    practice: "verb",
    sources: [
      { label: "Cambridge — Subject–verb agreement", url: CAM_US + 'verb-agreement' },
      { label: "Cambridge — Number", url: CAM + 'number' },
      { label: "Cambridge — Neither, neither … nor", url: CAM + 'neither-neither-nor-and-not-either' },
    ],
    sections: [
      {
        heading: "Nguyên tắc",
        blocks: [
          {
            kind: "p",
            text: "Động từ chia theo **chủ ngữ chính**, không theo danh từ đứng ngay trước nó. Bỏ qua cụm giới từ và mệnh đề chen giữa để tìm chủ ngữ thật.",
          },
          {
            kind: "examples",
            items: [
              { en: "The **list** of new employees **is** posted on the board.", vi: "Danh sách nhân viên mới được dán trên bảng. (chủ ngữ: list, số ít)" },
              { en: "The **packages** that arrived this morning **contain** brochures.", vi: "Các kiện hàng đến sáng nay chứa tờ quảng cáo." },
            ],
          },
        ],
      },
      {
        heading: "Các trường hợp đặc biệt",
        blocks: [
          {
            kind: "table",
            head: ["Chủ ngữ", "Động từ", "Ví dụ"],
            rows: [
              ["each / every / everyone / anyone + …", "số ít", "Every room **has** a view."],
              ["danh từ không đếm được (information, equipment…)", "số ít", "The equipment **is** new."],
              ["A and B", "số nhiều", "The manager and her assistant **are** away."],
              ["either A or B / neither A nor B / not only A but also B", "theo **B** (gần động từ)", "Neither the staff nor the manager **was** informed."],
              ["the number of + N số nhiều", "số ít (quy tắc chuẩn — dùng khi làm bài)", "The number of visitors **has** increased."],
              ["a number of + N số nhiều", "số nhiều", "A number of guests **have** arrived."],
              ["V-ing / to V làm chủ ngữ", "số ít", "Reviewing contracts **takes** time."],
            ],
          },
          { kind: "trap", text: "Mệnh đề quan hệ chia theo danh từ được thay thế: *a client who* **needs** … nhưng *clients who* **need** …" },
        ],
      },
    ],
  },
  {
    slug: "ving-tov",
    group: "Động từ",
    title: "Danh động từ (V-ing) & động từ nguyên mẫu (to V)",
    summary: "Sau động từ nào dùng V-ing, sau động từ nào dùng to V; sau giới từ luôn là V-ing.",
    practice: "verb",
    examples: {
      tags: ["verb", "word-form"],
      match: (q) =>
        /^to \w+$/.test(ans(q)) ||
        (/^\w+ing$/.test(ans(q)) &&
          (PREPS.includes(before(q)) || /^(avoid|consider|recommend|suggest|finish|delay|postpone|enjoy|include|keep|discontinue|mind)/.test(before(q)))),
    },
    sources: [
      { label: "Cambridge — Verb + infinitive or verb + -ing", url: CAM + 'verb-patterns-verb-infinitive-or-verb-ing' },
      { label: "Cambridge — Suggest", url: CAM + 'suggest' },
      { label: "Cambridge — Look forward to", url: CAM_US + 'look-forward-to' },
    ],
    sections: [
      {
        heading: "Động từ + V-ing / to V",
        blocks: [
          {
            kind: "table",
            head: ["Theo sau là", "Động từ"],
            rows: [
              ["**V-ing**", "avoid, consider, recommend, suggest, finish, delay, postpone, mind, enjoy, include, involve, keep, practice, discontinue (*suggest* không bao giờ + to V)"],
              ["**to V**", "plan, decide, agree, hope, expect, intend, aim, offer, promise, refuse, fail, afford, wish, seem, strive"],
              ["**tân ngữ + to V**", "ask, allow, enable, encourage, require, invite, remind, advise, urge, permit, expect, want, recommend"],
              ["**tân ngữ + V nguyên mẫu**", "let, make, have; help (+ to V hoặc V)"],
            ],
          },
        ],
      },
      {
        heading: "Sau giới từ là V-ing",
        blocks: [
          {
            kind: "list",
            items: [
              "Mọi giới từ (for, by, before, after, without, of, in…) + **V-ing**: *before* **leaving**, *by* **using**.",
              "Chữ **to** là giới từ trong: *look forward to, be committed to, be dedicated to, be used to, contribute to, object to, in addition to* → + **V-ing**: *We look forward to* **meeting** *you.*",
              "**in order to / so as to + V**: để làm gì.",
            ],
          },
          { kind: "trap", text: "*stop / remember / forget / try* đổi nghĩa: *stop* **to check** (dừng lại để kiểm tra) ≠ *stop* **checking** (thôi kiểm tra)." },
        ],
      },
      {
        heading: "Ví dụ",
        blocks: [
          {
            kind: "examples",
            items: [
              { en: "The committee decided **to postpone** the vote.", vi: "Ủy ban quyết định hoãn cuộc bỏ phiếu." },
              { en: "We recommend **booking** your tickets early.", vi: "Chúng tôi khuyên bạn nên đặt vé sớm." },
              { en: "The new software enables staff **to track** orders in real time.", vi: "Phần mềm mới cho phép nhân viên theo dõi đơn hàng theo thời gian thực." },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "dieu-kien",
    group: "Động từ",
    title: "Câu điều kiện",
    summary: "Ba loại câu điều kiện, unless, và dạng đảo ngữ Should / Had / Were.",
    practice: "verb",
    examples: { tags: ["verb", "prep-conj"], match: (q) => /\b(if|unless|should|had|were)\b/i.test(q.question) && /\b(if|unless|provided|as long as)\b|^(should|had|were)\b/i.test(`${q.question} ${ans(q)}`) },
    sources: [
      { label: "British Council — Inversion and conditionals", url: BC + 'c1/inversion-conditionals' },
      { label: "Cambridge — Conditionals: unless, should, as long as", url: CAM + 'conditionals-other-expressions-unless-should-as-long-as' },
    ],
    sections: [
      {
        heading: "Ba loại câu điều kiện",
        blocks: [
          {
            kind: "table",
            head: ["Loại", "Mệnh đề If", "Mệnh đề chính", "Dùng khi"],
            rows: [
              ["1", "If + hiện tại đơn", "will / can / may + V; hoặc câu mệnh lệnh", "có thể xảy ra ở hiện tại/tương lai"],
              ["2", "If + quá khứ đơn (be → were)", "would / could + V", "không có thật ở hiện tại"],
              ["3", "If + had + V3", "would / could have + V3", "không có thật ở quá khứ"],
            ],
          },
          { kind: "tip", text: "Thư từ, thông báo trong TOEIC rất hay dùng: *If you have any questions, please* **contact** *us.* (loại 1 + câu mệnh lệnh)" },
        ],
      },
      {
        heading: "unless, provided that & đảo ngữ",
        blocks: [
          {
            kind: "list",
            items: [
              "**unless** = if … not: *Unless you renew it, your membership will expire.*",
              "**provided (that) / as long as / on condition that** = miễn là.",
              "Đảo ngữ bỏ *if* (văn phong trang trọng): **Should** + S + V (= If S should…) · **Were** + S + to V · **Had** + S + V3. Ví dụ: *Should you need assistance, call the front desk.* Phủ định: *Should you* **not** *receive…*",
            ],
          },
          { kind: "trap", text: "Câu bắt đầu bằng ____ + chủ ngữ + V nguyên mẫu và có dấu phẩy ở giữa câu → thường là **Should** (đảo ngữ điều kiện loại 1)." },
        ],
      },
    ],
  },
  {
    slug: "gia-dinh",
    group: "Động từ",
    title: "Câu giả định với that",
    summary: "recommend / request / require / it is essential that + S + V nguyên mẫu.",
    practice: "verb",
    sources: [
      { label: "British Council — Patterns with reporting verbs", url: 'https://learnenglish.britishcouncil.org/grammar/c1-grammar/patterns-reporting-verbs' },
    ],
    sections: [
      {
        heading: "Công thức",
        blocks: [
          {
            kind: "p",
            text: "Sau các động từ/tính từ chỉ yêu cầu, đề nghị, mệnh đề *that* dùng **động từ nguyên mẫu không chia** (không thêm -s, không đổi thì), kể cả khi chủ ngữ số ít.",
          },
          {
            kind: "table",
            head: ["Cấu trúc", "Ví dụ"],
            rows: [
              ["recommend / suggest / request / require / insist / ask / propose + that + S + **V**", "We request that each guest **present** a photo ID."],
              ["It is essential / important / necessary / imperative / vital + that + S + **V**", "It is essential that the report **be** accurate."],
            ],
          },
          { kind: "trap", text: "Bị động trong câu giả định là **be + V3** (không phải *is/are*): *The manager requested that the files* **be sent** *today.*" },
          { kind: "tip", text: "Phủ định: **not + V nguyên mẫu**: *We recommend that guests* **not leave** *valuables in the car.* Trong văn nói, người bản xứ đôi khi chia động từ bình thường, nhưng đề TOEIC kiểm tra dạng nguyên mẫu." },
        ],
      },
    ],
  },
  {
    slug: "phan-tu",
    group: "Động từ",
    title: "Phân từ V-ing / V-ed & rút gọn mệnh đề",
    summary: "exciting hay excited, the attached file hay the attaching file, rút gọn mệnh đề trạng ngữ.",
    practice: "word-form",
    examples: {
      tags: ["word-form", "verb"],
      match: (q) =>
        /^\w+(ing|ed)$/.test(ans(q)) &&
        (DETS.includes(before(q)) || ["after", "before", "when", "while", "once", "if", "unless", "upon", "until"].includes(before(q))),
    },
    sources: [
      { label: "British Council — Participle clauses", url: BC + 'c1/participle-clauses' },
      { label: "British Council — Noun phrases", url: BC + 'english-grammar-reference/noun-phrases' },
    ],
    sections: [
      {
        heading: "Phân từ làm tính từ",
        blocks: [
          {
            kind: "table",
            head: ["Dạng", "Nghĩa", "Ví dụ"],
            rows: [
              ["V-ing", "chủ động / gây ra cảm xúc", "an **exciting** offer · a **growing** company · **rising** costs"],
              ["V-ed (V3)", "bị động / bị tác động, mang cảm xúc", "**excited** customers · the **attached** file · a **revised** schedule"],
            ],
          },
          { kind: "tip", text: "Cụm hay gặp: *attached / enclosed / updated / revised / detailed / qualified / experienced / limited / preferred* + danh từ; *existing / remaining / leading / outstanding / upcoming / missing* + danh từ." },
        ],
      },
      {
        heading: "Rút gọn mệnh đề",
        blocks: [
          {
            kind: "list",
            items: [
              "Mệnh đề quan hệ chủ động → **V-ing**: *employees* ~~who work~~ **working** *overtime*.",
              "Mệnh đề quan hệ bị động → **V3**: *the products* ~~that were ordered~~ **ordered** *last week*.",
              "Mệnh đề trạng ngữ cùng chủ ngữ: **When/Before/After/While + V-ing**, hoặc **Once/If/Unless/As + V3**: *Before* **submitting** *the form, check every field.* · *Once* **approved**, *the plan will take effect.*",
            ],
          },
          { kind: "trap", text: "Xét chủ ngữ của mệnh đề chính: *When* **completed**, *the form should be sent to HR* (form được điền → V3)." },
          { kind: "tip", text: "Hành động xảy ra **trước** hành động chính dùng **Having + V3**: **Having reviewed** *the proposal, the board approved it.*" },
        ],
      },
    ],
  },

  // ================= MỆNH ĐỀ & LIÊN KẾT =================
  {
    slug: "menh-de-quan-he",
    group: "Mệnh đề & liên kết",
    title: "Mệnh đề quan hệ",
    summary: "who / whom / whose / which / that / where / when — chọn theo danh từ đứng trước và vai trò trong mệnh đề.",
    practice: "relative",
    examples: { tags: ["relative", "prep-conj", "pronoun"], match: (q) => inSet(["who", "whom", "whose", "which"])(q) || (ans(q) === "that" && !PREPS.includes(before(q))) },
    sources: [
      { label: "Cambridge — Relative pronouns", url: CAM + 'relative-pronouns' },
      { label: "Cambridge — Defining and non-defining relative clauses", url: CAM + 'relative-clauses-defining-and-non-defining' },
      { label: "British Council — Non-defining relative clauses", url: BC + 'b1-b2/relative-clauses-non-defining-relative-clauses' },
    ],
    sections: [
      {
        heading: "Đại từ & trạng từ quan hệ",
        blocks: [
          {
            kind: "table",
            head: ["Từ", "Thay cho", "Theo sau", "Ví dụ"],
            rows: [
              ["who", "người (chủ ngữ)", "động từ", "the clerk **who** handles orders"],
              ["whom", "người (tân ngữ)", "chủ ngữ + động từ", "the client **whom** we met"],
              ["whose", "sở hữu (người; vật — văn trang trọng)", "**danh từ**", "the firm **whose** offices were renovated"],
              ["which", "vật", "động từ hoặc S + V", "the report **which** was published"],
              ["that", "người/vật (mệnh đề xác định)", "như who/which", "the items **that** sold out"],
              ["where / when", "nơi chốn / thời gian", "câu đầy đủ", "the hotel **where** we stayed"],
            ],
          },
        ],
      },
      {
        heading: "Mẹo chọn nhanh",
        blocks: [
          {
            kind: "list",
            items: [
              "Sau chỗ trống là **danh từ không có mạo từ** → **whose**: *a supplier* ____ *products are eco-friendly* → whose.",
              "Sau chỗ trống là **động từ** → who (người) / which (vật).",
              "Sau dấu phẩy hoặc sau giới từ **không dùng that**: *, which …* · *in which* · *to whom*.",
              "**what** = the thing(s) that, không có danh từ đứng trước: *This is* **what** *we need.*",
            ],
          },
          { kind: "trap", text: "**whoever / whichever** = bất kỳ ai/cái nào: *Whoever finishes first may leave early.* Không dùng khi đã có danh từ đứng trước." },
        ],
      },
    ],
  },
  {
    slug: "lien-tu-gioi-tu",
    group: "Mệnh đề & liên kết",
    title: "Liên từ hay giới từ?",
    summary: "because hay because of, although hay despite: sau chỗ trống là mệnh đề hay cụm danh từ?",
    practice: "prep-conj",
    examples: {
      tags: ["prep-conj"],
      match: inSet(["because", "because of", "due to", "owing to", "since", "although", "though", "even though", "despite", "in spite of", "while", "whereas", "during", "unless", "once", "until", "as soon as", "so that", "in order to", "now that", "as long as", "provided that"]),
    },
    sources: [
      { label: "Cambridge — Because, because of", url: CAM + 'because-because-of-and-cos-cos-of' },
      { label: "Cambridge — Although or though", url: CAM + 'although-or-though' },
      { label: "Cambridge — Conjunctions: contrasting", url: CAM_US + 'conjunctions-contrasting' },
    ],
    sections: [
      {
        heading: "Quy tắc vàng",
        blocks: [
          {
            kind: "p",
            text: "**Liên từ** + mệnh đề (có chủ ngữ và động từ chia). **Giới từ** + danh từ / cụm danh từ / V-ing. Nhìn phần sau chỗ trống trước, rồi mới xét nghĩa.",
          },
          {
            kind: "table",
            head: ["Nghĩa", "Liên từ (+ S + V)", "Giới từ (+ N / V-ing)"],
            rows: [
              ["Vì, do", "because, since, as, now that", "because of, due to, owing to, on account of"],
              ["Mặc dù", "although, though, even though, while", "despite, in spite of, notwithstanding"],
              ["Trong khi", "while, whereas (tương phản)", "during"],
              ["Nếu / trừ khi", "if, unless, provided (that), as long as", "in case of, in the event of, without"],
              ["Để", "so that, in order that", "in order to / so as to + V; for + N"],
              ["Ngay khi / sau khi", "once, as soon as, after, before, until", "after, before, until, upon + N/V-ing"],
            ],
          },
          { kind: "tip", text: "*after, before, until, since* vừa là liên từ vừa là giới từ — lúc này phải dựa vào **nghĩa**." },
        ],
      },
      {
        heading: "Ví dụ",
        blocks: [
          {
            kind: "examples",
            items: [
              { en: "**Although** the train was late, the meeting started on time.", vi: "Mặc dù tàu đến trễ, cuộc họp vẫn bắt đầu đúng giờ." },
              { en: "**Despite** the delay, the meeting started on time.", vi: "Bất chấp sự chậm trễ, cuộc họp vẫn bắt đầu đúng giờ." },
              { en: "The event was moved indoors **due to** heavy rain.", vi: "Sự kiện được chuyển vào trong nhà do mưa lớn." },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "lien-tu-tuong-quan",
    group: "Mệnh đề & liên kết",
    title: "Liên từ tương quan",
    summary: "both … and, either … or, neither … nor, not only … but also, whether … or.",
    practice: "prep-conj",
    examples: { tags: ["prep-conj"], match: (q) => /\b(both|either|neither|not only|whether|nor|but also)\b/i.test(`${q.question} ${ans(q)}`) && inSet(["and", "or", "nor", "both", "either", "neither", "but also", "whether", "not only"])(q) },
    sources: [
      { label: "Cambridge — Either … or", url: CAM_US + 'either-or' },
      { label: "Cambridge — Neither … nor", url: CAM + 'neither-neither-nor-and-not-either' },
      { label: "Cambridge — Both", url: CAM_US + 'both' },
    ],
    sections: [
      {
        heading: "Các cặp cố định",
        blocks: [
          {
            kind: "table",
            head: ["Cặp", "Nghĩa", "Ví dụ"],
            rows: [
              ["both A **and** B", "cả A và B", "both **online and** in stores"],
              ["either A **or** B", "hoặc A hoặc B", "either **by phone or** by e-mail"],
              ["neither A **nor** B", "không A cũng không B", "neither **cash nor** checks"],
              ["not only A **but (also)** B", "không chỉ A mà còn B", "not only **fast but also** reliable"],
              ["whether A **or** B / or not", "liệu A hay B", "whether **to renew or** cancel"],
            ],
          },
          { kind: "trap", text: "Thấy một nửa của cặp ở trong câu thì chỗ trống là **nửa còn lại**: *Neither the manager ____ the assistant* → **nor** (không phải *or*)." },
          { kind: "tip", text: "A và B phải **cùng loại** (cùng danh từ, cùng tính từ, cùng cụm giới từ…)." },
        ],
      },
    ],
  },
  {
    slug: "gioi-tu",
    group: "Mệnh đề & liên kết",
    title: "Giới từ thời gian, nơi chốn & cụm cố định",
    summary: "in / on / at, by / until, within / during, và các cụm giới từ hay gặp trong TOEIC.",
    practice: "prep-conj",
    examples: { tags: ["prep-conj"], match: inSet(["in", "on", "at", "by", "until", "within", "during", "throughout", "for", "since", "from", "between", "among", "across", "along", "beyond", "toward", "towards", "without", "upon", "prior to", "ahead of", "as of", "regarding", "concerning", "according to", "instead of"]) },
    sources: [
      { label: "British Council — Prepositions of time: at, in, on", url: BC + 'a1-a2-grammar/prepositions-of-time-at-in-on' },
      { label: "Cambridge — Until", url: CAM + 'until' },
      { label: "Cambridge — During", url: CAM + 'during' },
      { label: "Cambridge — Within", url: CAM_US + 'within' },
    ],
    sections: [
      {
        heading: "Thời gian",
        blocks: [
          {
            kind: "table",
            head: ["Giới từ", "Dùng với", "Ví dụ"],
            rows: [
              ["at", "giờ, thời điểm", "at 9 A.M., at noon, at the end of"],
              ["on", "ngày, thứ, ngày tháng", "on Monday, on May 5"],
              ["in", "tháng, năm, mùa, buổi; sau một khoảng thời gian", "in June, in 2025, in two weeks"],
              ["by", "hạn chót (không trễ hơn)", "submit **by** Friday"],
              ["until", "kéo dài đến lúc", "open **until** 8 P.M."],
              ["within", "trong vòng (khoảng thời gian)", "**within** 30 days"],
              ["during / throughout", "trong suốt (sự kiện/khoảng)", "**during** the conference"],
              ["as of / effective", "kể từ (mốc áp dụng)", "**as of** July 1"],
            ],
          },
          { kind: "trap", text: "**by** đi với hành động hoàn tất một lần (submit, finish, return); **until** đi với trạng thái kéo dài (stay, remain, be open)." },
          { kind: "trap", text: "**during** + sự kiện/khoảng thời gian có tên (during the meeting), không đi với độ dài thời gian: *for three days*, không phải *during three days*." },
        ],
      },
      {
        heading: "Nơi chốn & cụm cố định",
        blocks: [
          {
            kind: "list",
            items: [
              "**at** địa điểm cụ thể (at the front desk) · **in** không gian/thành phố (in the lobby, in Seoul) · **on** bề mặt/tầng/đường (on the third floor, on Main Street).",
              "**between** hai đối tượng · **among** từ ba trở lên · **across** băng qua, khắp · **throughout** khắp cả.",
              "Cụm hay gặp: *in charge of, in addition to, in accordance with, on behalf of, on time / in time, at no cost, prior to, ahead of schedule, regardless of, in response to, with regard to*.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "trang-tu-lien-ket",
    group: "Mệnh đề & liên kết",
    title: "Trạng từ liên kết",
    summary: "however, therefore, otherwise, in addition… — nối hai câu, rất hay gặp ở Part 6.",
    practice: "prep-conj",
    examples: { tags: ["prep-conj", "vocabulary"], match: inSet(["however", "therefore", "otherwise", "moreover", "furthermore", "in addition", "consequently", "nevertheless", "instead", "meanwhile", "thus", "as a result", "for example", "in fact", "similarly", "likewise", "accordingly", "nonetheless"]) },
    sources: [
      { label: "Cambridge — Adverbs: linking adverbs", url: CAM + 'adverbs-linking-adverbs' },
      { label: "Cambridge — Conjunctions", url: CAM + 'conjunctions' },
    ],
    sections: [
      {
        heading: "Nhóm theo ý nghĩa",
        blocks: [
          {
            kind: "table",
            head: ["Ý", "Trạng từ liên kết"],
            rows: [
              ["Thêm ý", "in addition, moreover, furthermore, also, besides"],
              ["Đối lập", "however, nevertheless, nonetheless, on the other hand, instead"],
              ["Kết quả", "therefore, thus, consequently, as a result, accordingly"],
              ["Nếu không thì", "otherwise"],
              ["Ví dụ / nhấn mạnh", "for example, for instance, in fact, indeed"],
              ["Trình tự / đồng thời", "then, afterward, meanwhile, in the meantime, finally"],
            ],
          },
        ],
      },
      {
        heading: "Cách dùng",
        blocks: [
          {
            kind: "list",
            items: [
              "Trạng từ liên kết **không nối hai mệnh đề bằng dấu phẩy**: dùng dấu chấm hoặc chấm phẩy: *The venue is small;* **however**, *it is very central.*",
              "Ở Part 6, đọc câu **trước** chỗ trống để biết quan hệ (thêm ý, đối lập hay kết quả), rồi mới chọn.",
            ],
          },
          { kind: "trap", text: "*however* (trạng từ) ≠ *although* (liên từ): *Although sales rose, profits fell.* — *Sales rose.* **However**, *profits fell.*" },
        ],
      },
      {
        heading: "Ví dụ",
        blocks: [
          {
            kind: "examples",
            items: [
              { en: "The printer is out of toner. **Therefore**, please use the one on the second floor.", vi: "Máy in hết mực. Vì vậy, vui lòng dùng máy ở tầng hai." },
              { en: "Submit the form by Friday; **otherwise**, your request will not be processed.", vi: "Hãy nộp biểu mẫu trước thứ Sáu; nếu không, yêu cầu của bạn sẽ không được xử lý." },
            ],
          },
        ],
      },
    ],
  },
];

export const topicBySlug = (slug: string) => TOPICS.find((t) => t.slug === slug);
