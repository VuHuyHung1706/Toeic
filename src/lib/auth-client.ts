"use client";
import { createAuthClient } from "better-auth/react";

// Cùng origin với trang → không cần baseURL
export const authClient = createAuthClient();
export const { useSession, signIn, signOut, signUp } = authClient;
