"use client";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, error } = useAuthStore();
  if (!ready) return <p className="p-8 text-text-secondary">Checking your sign-in…</p>;
  if (authenticated) return <>{children}</>;
  return <main className="grid min-h-screen place-items-center p-6 text-center"><div><h1 className="text-2xl font-bold">{error ? "Workspace setup needs attention" : "Sign in required"}</h1><p className="my-3 text-text-secondary">{error || "Sign in to upload data and use the workspace."}</p>{error ? <button className="rounded bg-primary px-4 py-2" onClick={() => location.reload()}>Try again</button> : <Link href="/login" className="rounded bg-primary px-4 py-2">Go to sign in</Link>}</div></main>;
}
