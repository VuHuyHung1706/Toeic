// Ảnh đại diện: chữ cái đầu của tên trên nền màu người dùng chọn ở trang cá nhân.
// Màu lưu trong trường user.image dạng "color:<khoá>" (không có kho ảnh để tải ảnh lên); image là URL thì hiện ảnh.

export const AVATAR_COLORS = {
  blue: "from-blue-500 to-indigo-600",
  violet: "from-violet-500 to-fuchsia-600",
  rose: "from-rose-500 to-pink-600",
  orange: "from-orange-400 to-red-500",
  amber: "from-amber-400 to-orange-500",
  emerald: "from-emerald-400 to-teal-600",
  sky: "from-sky-400 to-cyan-600",
  slate: "from-slate-500 to-slate-700",
} as const;

export type AvatarColor = keyof typeof AVATAR_COLORS;

export const AVATAR_COLOR_NAMES: Record<AvatarColor, string> = {
  blue: "xanh dương",
  violet: "tím",
  rose: "hồng",
  orange: "cam",
  amber: "vàng",
  emerald: "xanh lá",
  sky: "xanh trời",
  slate: "xám",
};

export const avatarColorOf = (image: string | null | undefined): AvatarColor | null => {
  const key = image?.startsWith("color:") ? image.slice(6) : null;
  return key && key in AVATAR_COLORS ? (key as AvatarColor) : null;
};

export default function Avatar({
  name,
  image,
  className = "size-8 text-sm",
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  const color = avatarColorOf(image);
  if (image && !color && /^(https?:|data:image\/)/.test(image)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- ảnh đại diện từ URL, không cần tối ưu
      <img src={image} alt="" referrerPolicy="no-referrer" className={`shrink-0 rounded-full object-cover ${className}`} />
    );
  }
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-bold select-none ${
        color ? `bg-linear-to-br text-white ${AVATAR_COLORS[color]}` : "bg-primary-soft text-primary"
      } ${className}`}
    >
      {initial}
    </span>
  );
}
