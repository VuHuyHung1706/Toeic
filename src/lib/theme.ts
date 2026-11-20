// Giao diện sáng/tối do người dùng chọn (ThemeToggle). File thường (không "use client")
// để layout phía server đọc được THEME_SCRIPT.
export const THEME_KEY = "toeic:theme";
export const THEME_EVENT = "toeic-theme";

/** Chạy trong <head> trước khi vẽ trang: áp giao diện đã chọn để không nháy sáng/tối */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;
