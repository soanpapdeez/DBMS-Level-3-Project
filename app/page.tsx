
"use client";

import { useState } from "react";

const events = [
  {
    id: 1,
    name: "Sunburn Festival 2026",
    category: "Music",
    date: "December 20, 2026",
    venue: "Goa",
    price: 2499,
    available: 120,
    color: "from-purple-600 to-pink-500",
    icon: "🎵",
  },
  {
    id: 2,
    name: "Tech Summit Bengaluru",
    category: "Technology",
    date: "December 12, 2026",
    venue: "Bengaluru",
    price: 999,
    available: 85,
    color: "from-blue-600 to-cyan-500",
    icon: "💻",
  },
  {
    id: 3,
    name: "Comedy Night Live",
    category: "Comedy",
    date: "December 15, 2026",
    venue: "Bengaluru",
    price: 499,
    available: 60,
    color: "from-orange-500 to-red-500",
    icon: "🎤",
  },
];

export default function Home() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [message, setMessage] = useState("");

  const filteredEvents = events.filter((event) => {
    const matchesSearch =
      event.name.toLowerCase().includes(search.toLowerCase()) ||
      event.venue.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      category === "All" || event.category === category;

    return matchesSearch && matchesCategory;
  });

  return (
    <main className="min-h-screen bg-[#080b14] text-white">
      <nav className="flex items-center justify-between border-b border-white/10 px-6 py-5 md:px-16">
        <h1 className="text-2xl font-bold tracking-tight">
          Ticket<span className="text-violet-400">Guard.</span>
        </h1>
        <div className="flex items-center gap-6 text-sm text-gray-300">
          <a href="#events" className="hover:text-white">Explore Events</a>
          <a href="#security" className="hover:text-white">Security</a>
          <button className="rounded-lg bg-violet-600 px-5 py-2.5 font-semibold hover:bg-violet-500">
            Sign In
          </button>
        </div>
      </nav>

      <section className="px-6 py-20 text-center md:px-16 md:py-28">
        <div className="mx-auto max-w-3xl">
          <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-4 py-2 text-sm text-violet-300">
            Secure Event Ticketing Platform
          </span>

          <h2 className="mt-8 text-4xl font-extrabold leading-tight md:text-6xl">
            Your Events.
            <br />
            Your Tickets.
            <br />
            <span className="text-violet-400">Your Experience.</span>
          </h2>

          <p className="mx-auto mt-6 max-w-xl text-gray-400">
            Discover and book events with confidence. Smart purchase
            monitoring and anti-scalping protection help keep ticketing fair.
          </p>

          <a
            href="#events"
            className="mt-9 inline-block rounded-xl bg-violet-600 px-8 py-4 font-semibold hover:bg-violet-500"
          >
            Explore Events →
          </a>
        </div>
      </section>

      <section id="events" className="px-6 pb-20 md:px-16">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Discover
          </p>
          <h2 className="mt-2 text-3xl font-bold">Upcoming Events</h2>
          <p className="mt-2 text-gray-400">
            Find your next unforgettable experience.
          </p>
        </div>

        <div className="mb-8 flex flex-col gap-4 md:flex-row">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events or locations..."
            className="w-full rounded-xl border border-white/10 bg-[#111827] px-5 py-4 outline-none focus:border-violet-500"
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#111827] px-5 py-4 outline-none focus:border-violet-500"
          >
            <option>All</option>
            <option>Music</option>
            <option>Technology</option>
            <option>Comedy</option>
          </select>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {filteredEvents.map((event) => (
            <article
              key={event.id}
              className="overflow-hidden rounded-2xl border border-white/10 bg-[#111827] transition hover:-translate-y-1 hover:border-violet-500/50"
            >
              <div className={`flex h-44 items-center justify-center bg-gradient-to-br ${event.color}`}>
                <span className="text-7xl">{event.icon}</span>
              </div>

              <div className="p-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">
                  {event.category}
                </span>
                <h3 className="mt-2 text-xl font-bold">{event.name}</h3>
                <p className="mt-3 text-sm text-gray-400">
                  📅 {event.date}
                </p>
                <p className="mt-2 text-sm text-gray-400">
                  📍 {event.venue}
                </p>

                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-5">
                  <div>
                    <p className="text-xs text-gray-400">Starting from</p>
                    <p className="text-xl font-bold">₹{event.price}</p>
                  </div>
                  <button
                    onClick={() =>
                      setMessage(
                        `${event.name} selected. Booking and seat availability will be connected to the database next.`
                      )
                    }
                    className="rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold hover:bg-violet-500"
                  >
                    Book Tickets
                  </button>
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  {event.available} sample tickets available
                </p>
              </div>
            </article>
          ))}
        </div>

        {filteredEvents.length === 0 && (
          <p className="py-12 text-center text-gray-400">
            No events found. Try another search.
          </p>
        )}

        {message && (
          <div className="mt-8 rounded-xl border border-violet-500/30 bg-violet-500/10 p-4 text-violet-200">
            {message}
            <button
              onClick={() => setMessage("")}
              className="ml-4 underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </section>

      <section id="security" className="border-t border-white/10 bg-[#0d1220] px-6 py-16 md:px-16">
        <div className="mx-auto grid max-w-5xl gap-8 text-center md:grid-cols-3">
          <div>
            <div className="text-3xl">🛡️</div>
            <h3 className="mt-3 font-bold">Anti-Scalping</h3>
            <p className="mt-2 text-sm text-gray-400">
              Detect suspicious purchase patterns and repeated violations.
            </p>
          </div>
          <div>
            <div className="text-3xl">🔒</div>
            <h3 className="mt-3 font-bold">Secure Booking</h3>
            <p className="mt-2 text-sm text-gray-400">
              Database-backed ticket and booking management.
            </p>
          </div>
          <div>
            <div className="text-3xl">⚡</div>
            <h3 className="mt-3 font-bold">Fair Resale</h3>
            <p className="mt-2 text-sm text-gray-400">
              Controlled resale and ticket transfer mechanisms.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-6 text-center text-sm text-gray-500">
        © 2026 TicketGuard. Digital Event Ticket Reservation & Anti-Scalping Engine.
      </footer>
    </main>
  );
}
