import { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { handlePoolErrors } from "../index";

// Postgres ngắt kết nối đang rảnh (Aiven OOM / khởi động lại) → pool phát "error".
// Không có listener: Node ném lỗi (làm sập server). Có handlePoolErrors: chỉ ghi log.
describe("handlePoolErrors", () => {
  it("không có listener thì lỗi của kết nối rảnh bị ném ra", () => {
    const pool = new Pool();
    expect(() => pool.emit("error", new Error("terminating connection due to administrator command"))).toThrow();
    void pool.end();
  });

  it("có listener thì chỉ ghi log, không ném lỗi", () => {
    const pool = new Pool();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    handlePoolErrors(pool);
    expect(() => pool.emit("error", new Error("terminating connection due to administrator command"))).not.toThrow();
    expect(log).toHaveBeenCalledOnce();
    expect(String(log.mock.calls[0][1])).toContain("administrator command");
    log.mockRestore();
    void pool.end();
  });
});
