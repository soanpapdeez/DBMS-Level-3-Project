
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login failed. Please try again.");
        return;
      }

      window.location.href = "/";
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080d19] px-5 py-12 text-white">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#101a2d] shadow-2xl md:grid-cols-2">
        <section className="hidden flex-col justify-between bg-gradient-to-br from-blue-600 via-indigo-700 to-violet-800 p-12 md:flex">
          <div>
            <div className="mb-16 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-2xl">
                ♢
              </div>
              <span className="text-2xl font-bold tracking-tight">
                TicketEngine
              </span>
            </div>

            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-blue-100">
              Your next experience starts here
            </p>

            <h1 className="text-5xl font-bold leading-tight">
              Every event.
              <br />
              Every seat.
              <br />
              One platform.
            </h1>

            <p className="mt-6 max-w-sm leading-7 text-blue-100">
              Discover events, choose your seats and book your next
              unforgettable experience.
            </p>
          </div>

          <p className="text-sm text-blue-100/70">
            Secure booking. Real-time seat availability.
          </p>
        </section>

        <section className="flex flex-col justify-center p-7 sm:p-12">
          <div className="mb-10 md:hidden">
            <p className="text-2xl font-bold">TicketEngine</p>
            <p className="mt-2 text-sm text-slate-400">
              Your next experience starts here.
            </p>
          </div>

          <div className="mb-8">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-400">
              Welcome back
            </p>
            <h2 className="text-3xl font-bold">Sign in</h2>
            <p className="mt-2 text-sm text-slate-400">
              Enter your details to access your account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-700 bg-[#0b1424] px-4 py-3.5 text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-slate-700 bg-[#0b1424] px-4 py-3.5 text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 py-3.5 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-400">
            Don't have an account?{" "}
            <Link
              href="/register"
              className="font-semibold text-blue-400 hover:text-blue-300"
            >
              Create account
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
