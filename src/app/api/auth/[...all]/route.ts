import { getAuth } from "@/lib/auth";

// Mọi endpoint của better-auth: /api/auth/sign-in/social, /api/auth/get-session, /api/auth/sign-out…
export async function GET(req: Request) {
  return (await getAuth()).handler(req);
}

export async function POST(req: Request) {
  return (await getAuth()).handler(req);
}
