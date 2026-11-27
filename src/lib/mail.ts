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

/** Email "Đặt lại mật khẩu" */
export function resetPasswordMail(to: string, name: string, url: string, minutes: number): Mail {
  const hi = name ? `Chào ${name},` : "Chào bạn,";
  return {
    to,
    subject: "Đặt lại mật khẩu ĐMToeic",
    text: `${hi}\n\nCó yêu cầu đặt lại mật khẩu cho tài khoản ĐMToeic của bạn. Mở link sau để đặt mật khẩu mới (hết hạn sau ${minutes} phút):\n${url}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu hiện tại vẫn giữ nguyên.`,
    html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1d2433">
  <h2 style="margin:0 0 16px;font-size:20px">Đặt lại mật khẩu</h2>
  <p>${esc(hi)}</p>
  <p>Có yêu cầu đặt lại mật khẩu cho tài khoản ĐMToeic của bạn. Bấm nút dưới đây để đặt mật khẩu mới — link hết hạn sau ${minutes} phút.</p>
  <p style="margin:24px 0"><a href="${esc(url)}" style="background:#3355e0;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600;display:inline-block">Đặt mật khẩu mới</a></p>
  <p style="font-size:13px;color:#5d6475">Nút không bấm được? Dán link này vào trình duyệt:<br><a href="${esc(url)}" style="color:#3355e0;word-break:break-all">${esc(url)}</a></p>
  <p style="font-size:13px;color:#5d6475">Nếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu hiện tại vẫn giữ nguyên.</p>
</div>`,
  };
}
