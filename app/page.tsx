"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

type EventItem = {
  eventId: number;
  title: string;
  description: string | null;
  startsAt: string;
  venue: string;
  city: string;
  totalSeats: number;
  availableSeats: number;
  minPrice: number | null;
};

type User = {
  userId: number;
  name: string;
  email: string;
  role: string;
};

const eventStyles = [
  {
    gradient: "from-purple-600 via-fuchsia-500 to-pink-500",
    emoji: "ðŸŽµ",
    category: "MUSIC",
  },
  {
    gradient: "from-blue-600 via-sky-500 to-cyan-400",
    emoji: "ðŸ’»",
    category: "TECHNOLOGY",
  },
  {
    gradient: "from-orange-500 via-red-500 to-rose-500",
    emoji: "ðŸŽ­",
    category: "ENTERTAINMENT",
  },
  {
    gradient: "from-emerald-600 via-teal-500 to-cyan-400",
    emoji: "ðŸŽŸï¸",
    category: "EXPERIENCE",
  },
  {
    gradient: "from-violet-600 via-purple-500 to-indigo-500",
    emoji: "ðŸ†",
    category: "SPORTS",
  },
  {
    gradient: "from-pink-600 via-rose-500 to-orange-400",
    emoji: "âœ¨",
    category: "SPECIAL EVENT",
  },
];

function getEventStyle(title: string, index: number) {
  const name = title.toLowerCase();

  if (/music|concert|festival|dj|band/.test(name)) {
    return eventStyles[0];
  }
  if (/tech|summit|coding|developer|conference/.test(name)) {
    return eventStyles[1];
  }
  if (/comedy|standup|funny/.test(name)) {
    return eventStyles[2];
  }
  if (/theatre|theater|drama|dance/.test(name)) {
    return eventStyles[3];
  }
  if (/sport|cricket|football|race|tournament/.test(name)) {
    return eventStyles[4];
  }

  return eventStyles[index % eventStyles.length];
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Home() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const fetchEvents = useCallback(
    async (query: string, selectedCity: string) => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams();

        if (query.trim()) params.set("q", query.trim());
        if (selectedCity.trim()) params.set("city", selectedCity.trim());

        const response = await fetch(`/api/events?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load events.");
        }

        setEvents(data.events || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchEvents("", "");

    async function fetchUser() {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();

        if (response.ok) setUser(data.user);
      } catch {
        setUser(null);
      }
    }

    fetchUser();
  }, [fetchEvents]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await fetchEvents(search, city);
  }

  async function handleLogout() {
    setLoggingOut(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      window.location.href = "/";
    } catch {
      setLoggingOut(false);
      setError("Unable to log out. Please try again.");
    }
  }

  return (
    <main className="min-h-screen bg-[#08080f] text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-30 border-b border-white/10 bg-[#08080f]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-xl font-bold">
              T
            </span>
            <span className="text-xl font-bold tracking-tight">
              Ticket<span className="text-blue-400">Engine</span>
            </span>
          </Link>

          <div className="flex items-center gap-4 sm:gap-7">
            <Link
              href="/resale"
              className="text-sm font-medium text-slate-300 transition hover:text-white"
            >
              Resale Marketplace
            </Link>

            {user ? (
              <>

                <span className="hidden text-sm text-slate-300 sm:block">
                  Hello, {user.name}
                </span>

                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm transition hover:bg-white/10 disabled:opacity-50"
                >
                  {loggingOut ? "Logging out..." : "Logout"}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-slate-300 transition hover:text-white"
                >
                  Login
                </Link>

                <Link
                  href="/register"
                  className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-500 px-5 py-2.5 text-sm font-semibold transition hover:brightness-110"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="pointer-events-none absolute left-1/4 top-0 h-80 w-80 rounded-full bg-purple-600/15 blur-[120px]" />
        <div className="pointer-events-none absolute right-1/4 top-10 h-80 w-80 rounded-full bg-pink-600/10 blur-[120px]" />

        <div className="relative mx-auto flex max-w-7xl flex-col items-center px-5 pb-20 pt-24 text-center sm:pb-24 sm:pt-28">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-purple-400/25 bg-purple-500/10 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-purple-300">
            <span className="h-2 w-2 rounded-full bg-purple-400" />
            Discover your next experience
          </div>

          <h1 className="max-w-4xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
            Find your next
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              unforgettable event.
            </span>
          </h1>

          <p className="mt-7 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
            From live concerts to exciting experiences, discover events,
            choose your seats and book your next unforgettable experience.
          </p>

          {/* Search */}
          <form
            onSubmit={handleSearch}
            className="mt-12 grid w-full max-w-4xl gap-3 rounded-2xl border border-white/10 bg-[#141421] p-3 shadow-2xl sm:grid-cols-[1fr_1fr_auto] sm:p-4"
          >
            <div className="flex items-center gap-3 px-3">
              <span className="text-xl text-purple-400">âŒ•</span>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search events..."
                className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
            </div>

            <div className="flex items-center gap-3 border-t border-white/10 px-3 sm:border-l sm:border-t-0">
              <span className="text-lg text-pink-400">âŒ–</span>
              <input
                type="text"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Enter city..."
                className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 px-7 py-3 font-semibold transition hover:brightness-110 disabled:opacity-60"
            >
              Search Events
            </button>
          </form>

          <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs text-slate-500">
            <span>Discover events</span>
            <span>â€¢</span>
            <span>Choose your seats</span>
            <span>â€¢</span>
            <span>Book securely</span>
          </div>
        </div>
      </section>

      {/* Event Discovery */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="mb-9 text-center">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-purple-400">
            Discover
          </p>

          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Upcoming Events
          </h2>

          <p className="mt-3 text-sm text-slate-400 sm:text-base">
            Find your next unforgettable experience.
          </p>
        </div>

        <div className="mb-8 flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Explore what's happening
          </p>

          <span className="rounded-full border border-white/10 bg-[#141421] px-4 py-2 text-sm text-slate-400">
            {events.length} {events.length === 1 ? "event" : "events"}
          </span>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-300">
            {error}
            <button
              onClick={() => fetchEvents(search, city)}
              className="ml-3 font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-96 animate-pulse rounded-2xl border border-white/10 bg-[#141421]"
              />
            ))}
          </div>
        ) : !error && events.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#141421] px-6 py-16 text-center">
            <div className="mb-4 text-4xl">â€”</div>
            <h3 className="text-xl font-semibold">No events found</h3>
            <p className="mt-2 text-sm text-slate-400">
              Try another event name or city.
            </p>
            <button
              onClick={() => {
                setSearch("");
                setCity("");
                fetchEvents("", "");
              }}
              className="mt-6 rounded-lg bg-gradient-to-r from-purple-600 to-pink-500 px-5 py-2.5 text-sm font-semibold hover:brightness-110"
            >
              View all events
            </button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event, index) => {
              const style = getEventStyle(event.title, index);

              return (
                <article
                  key={event.eventId}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141421] transition duration-300 hover:-translate-y-1 hover:border-purple-400/40 hover:shadow-2xl hover:shadow-purple-950/20"
                >
                  {/* Colourful event banner */}
                  <div
                    className={`relative flex h-44 items-center justify-center overflow-hidden bg-gradient-to-br ${style.gradient}`}
                  >
                    <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
                    <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-black/10 blur-2xl" />

                    <span className="relative text-7xl drop-shadow-lg transition duration-300 group-hover:scale-110">
                      {style.emoji}
                    </span>
                  </div>

                  {/* Event details */}
                  <div className="flex flex-1 flex-col p-6">
                    <p className="mb-3 text-xs font-bold tracking-widest text-purple-400">
                      {style.category}
                    </p>

                    <h3 className="line-clamp-1 text-xl font-bold transition group-hover:text-purple-300">
                      {event.title}
                    </h3>

                    <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-400">
                      {event.description ||
                        "Join us for an unforgettable experience."}
                    </p>

                    <div className="mt-5 space-y-3 border-b border-white/10 pb-5">
                      <div className="flex items-center gap-3 text-sm text-slate-300">
                        <span>ðŸ“…</span>
                        <span>{formatDate(event.startsAt)}</span>
                      </div>

                      <div className="flex items-center gap-3 text-sm text-slate-300">
                        <span>ðŸ“</span>
                        <span className="truncate">
                          {event.venue}, {event.city}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-sm text-slate-300">
                        <span>ðŸ•’</span>
                        <span>{formatTime(event.startsAt)}</span>
                      </div>
                    </div>

                    <div className="mt-5 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs text-slate-500">
                          Starting from
                        </p>

                        <p className="mt-1 text-xl font-extrabold">
                          {event.minPrice === null
                            ? "Unavailable"
                            : `â‚¹${event.minPrice.toLocaleString("en-IN")}`}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-semibold text-emerald-400">
                          {event.availableSeats}
                        </p>
                        <p className="text-xs text-slate-500">
                          Seats available
                        </p>
                      </div>
                    </div>

                    <Link
                      href={`/events/${event.eventId}`}
                      className="mt-6 block rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 py-3 text-center text-sm font-bold transition hover:brightness-110"
                    >
                      Book Tickets â†’
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Platform Features */}
      <section
        id="platform-features"
        className="border-y border-white/5 bg-[#0d0d18] px-5 py-16 sm:px-8 sm:py-20"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 text-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-purple-400">
              Built for fair access
            </p>

            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              A safer way to experience events
            </h2>

            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              Discover events, book securely and access a controlled resale
              marketplace through one platform.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <article className="rounded-2xl border border-white/10 bg-[#141421] p-7">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/15 text-2xl">
                ðŸ›¡ï¸
              </div>

              <h3 className="text-lg font-bold text-white">
                Anti-Scalping
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                Purchase limits and abuse monitoring help discourage bulk
                buying and suspicious ticket activity.
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-[#141421] p-7">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/15 text-2xl">
                ðŸ”’
              </div>

              <h3 className="text-lg font-bold text-white">
                Secure Booking
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                Database-backed seat availability and booking operations help
                keep ticket reservations consistent.
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-[#141421] p-7">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-pink-500/15 text-2xl">
                ðŸŽŸï¸
              </div>

              <h3 className="text-lg font-bold text-white">
                Fair Resale
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                A controlled resale and ticket-transfer flow gives users a
                platform to list and discover eligible tickets.
              </p>

              <Link
                href="/resale"
                className="mt-5 inline-flex text-sm font-semibold text-pink-300 transition hover:text-pink-200"
              >
                Explore resale marketplace â†’
              </Link>
            </article>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#06060c]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-8 text-center sm:flex-row">
          <p className="text-lg font-bold">
            Ticket<span className="text-blue-400">Engine</span>
          </p>

          <p className="text-xs text-slate-500">
            Discover events. Book seats. Make memories.
          </p>

          <p className="text-xs text-slate-600">
            Â© 2026 TicketEngine
          </p>
        </div>
      </footer>
    </main>
  );
}
