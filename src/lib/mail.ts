// Gửi email qua SMTP (chỉ dùng phía server) — hiện dùng cho "Quên mật khẩu".
// Cấu hình bằng biến môi trường (Gmail mật khẩu ứng dụng, Brevo, Resend… đều có SMTP):
//   SMTP_HOST, SMTP_PORT (465 = SSL, 587 = STARTTLS), SMTP_USER, SMTP_PASS, MAIL_FROM (vd "ĐMToeic <noreply@…>")
// Chưa cấu hình: bản dev in nội dung ra log server (để thử trên máy); bản production báo lỗi.
import nodemailer from "nodemailer";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export const mailConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transport;
}

export async function sendMail(mail: Mail): Promise<void> {
  if (!mailConfigured()) {
    if (process.env.NODE_ENV === "production")
      throw new Error("Chưa cấu hình SMTP (SMTP_HOST / SMTP_USER / SMTP_PASS)");
    console.info(
      `[mail] (chưa cấu hình SMTP — chỉ in ra log)\nTới: ${mail.to}\nTiêu đề: ${mail.subject}\n${mail.text}`,
    );
    return;
  }
  await getTransport().sendMail({
    from: process.env.MAIL_FROM || `ĐMToeic <${process.env.SMTP_USER}>`,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// ---- mẫu email (HTML kiểu email: bảng + style inline; Gmail/Outlook bỏ CSS ngoài và không hiện ảnh SVG) ----
const C = {
  bg: "#f6f7fb",
  card: "#ffffff",
  line: "#e3e6ee",
  text: "#171a23",
  muted: "#5d6475",
  primary: "#2453d6",
  navy: "#0b2447",
  orange: "#f7941d",
  soft: "#e8eefc",
  warnBg: "#fff6e5",
  warnText: "#8a5300",
};
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

/** Logo dựng bằng HTML (ô vuông xanh chữ "Đm" + gạch cam, chữ ĐMToeic) — hiện được mọi nơi, kể cả khi chặn ảnh */
function logoHtml(site: string) {
  return `<a href="${esc(site)}" style="text-decoration:none;color:${C.text}">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
    <td style="width:40px;height:40px;border-radius:10px;background:${C.primary};background-image:linear-gradient(135deg,#2f62e8,${C.navy});text-align:center;vertical-align:middle">
      <div style="font:800 17px/1 ${FONT};color:#ffffff;letter-spacing:-0.5px;padding-top:2px">Đm</div>
      <div style="width:24px;height:3px;border-radius:2px;background:${C.orange};margin:4px auto 0"></div>
    </td>
    <td style="padding-left:10px;font:800 22px/1 ${FONT};color:${C.text};letter-spacing:-0.4px">ĐM<span style="color:${C.primary}">Toeic</span></td>
  </tr></table></a>`;
}

/** Khung chung: nền xám nhạt, logo, thẻ trắng có dải màu phía trên, chân trang */
function layout({ preheader, body, site }: { preheader: string; body: string; site: string }) {
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>ĐMToeic</title></head>
<body style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg}">
<tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
    <tr><td align="center" style="padding-bottom:24px">${logoHtml(site)}</td></tr>
    <tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:16px;overflow:hidden">
      <div style="height:4px;background:${C.primary};background-image:linear-gradient(90deg,${C.primary},${C.navy})"></div>
      <div style="padding:36px 36px 32px;font:15px/1.65 ${FONT};color:${C.text}">${body}</div>
    </td></tr>
    <tr><td align="center" style="padding:24px 12px 0;font:12px/1.6 ${FONT};color:${C.muted}">
      <a href="${esc(site)}" style="color:${C.muted};font-weight:600;text-decoration:none">ĐMToeic</a> · Luyện thi TOEIC Listening &amp; Reading<br>
      Email tự động — vui lòng không trả lời email này.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

/** Nút bấm dạng bảng (hiện đúng cả trên Outlook) */
function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto">
  <tr><td align="center" bgcolor="${C.primary}" style="border-radius:12px;background:${C.primary}">
    <a href="${esc(href)}" target="_blank" style="display:inline-block;padding:14px 32px;font:700 15px/1 ${FONT};color:#ffffff;text-decoration:none;border-radius:12px">${esc(label)}</a>
  </td></tr></table>`;
}

/** Email "Đặt lại mật khẩu" */
export function resetPasswordMail(
  to: string,
  name: string,
  url: string,
  minutes: number,
  requestedAt = new Date(),
): Mail {
  const site = new URL(url).origin;
  const who = name.trim() || "bạn";
  const when = requestedAt.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const body = `
  <div style="text-align:center">
    <div style="display:inline-block;width:56px;height:56px;border-radius:28px;background:${C.soft};font-size:26px;line-height:56px">🔐</div>
    <h1 style="margin:16px 0 4px;font:800 24px/1.3 ${FONT};color:${C.text}">Đặt lại mật khẩu</h1>
    <p style="margin:0;color:${C.muted};font-size:14px">cho tài khoản <b style="color:${C.text}">${esc(to)}</b></p>
  </div>
  <p style="margin:28px 0 0">Chào ${esc(who)},</p>
  <p style="margin:12px 0 0">Chúng tôi vừa nhận được yêu cầu đặt lại mật khẩu cho tài khoản ĐMToeic của bạn. Bấm nút bên dưới để chọn mật khẩu mới.</p>
  ${button(url, "Đặt mật khẩu mới")}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};border-radius:12px">
    <tr><td style="padding:14px 18px;font:13px/1.7 ${FONT};color:${C.muted}">
      ⏱&nbsp; Link hết hạn sau <b style="color:${C.text}">${minutes} phút</b> và chỉ dùng được <b style="color:${C.text}">một lần</b>.<br>
      🕘&nbsp; Yêu cầu lúc <b style="color:${C.text}">${esc(when)}</b> (giờ Việt Nam).<br>
      🔒&nbsp; Sau khi đổi, mọi thiết bị đang đăng nhập sẽ được đăng xuất.
    </td></tr>
  </table>
  <p style="margin:24px 0 0;font-size:13px;color:${C.muted}">Nút không bấm được? Sao chép link sau và dán vào trình duyệt:</p>
  <p style="margin:6px 0 0;font-size:12px;line-height:1.5;word-break:break-all"><a href="${esc(url)}" style="color:${C.primary}">${esc(url)}</a></p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;background:${C.warnBg};border-radius:12px">
    <tr><td style="padding:14px 18px;font:13px/1.6 ${FONT};color:${C.warnText}">
      <b>Không phải bạn yêu cầu?</b> Cứ bỏ qua email này — mật khẩu hiện tại vẫn giữ nguyên. Đừng chuyển tiếp email này cho ai khác.
    </td></tr>
  </table>`;
  return {
    to,
    subject: "Đặt lại mật khẩu ĐMToeic",
    text: [
      `Chào ${who},`,
      "",
      "Chúng tôi vừa nhận được yêu cầu đặt lại mật khẩu cho tài khoản ĐMToeic của bạn.",
      "Mở link sau để chọn mật khẩu mới:",
      url,
      "",
      `• Link hết hạn sau ${minutes} phút và chỉ dùng được một lần.`,
      `• Yêu cầu lúc ${when} (giờ Việt Nam).`,
      "• Sau khi đổi, mọi thiết bị đang đăng nhập sẽ được đăng xuất.",
      "",
      "Không phải bạn yêu cầu? Cứ bỏ qua email này — mật khẩu hiện tại vẫn giữ nguyên.",
      "",
      `ĐMToeic · ${site}`,
    ].join("\n"),
    html: layout({ preheader: `Link đặt lại mật khẩu, hết hạn sau ${minutes} phút.`, body, site }),
  };
}
