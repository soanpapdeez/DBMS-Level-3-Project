
"use client";

import { useMemo, useState } from "react";

interface Listing {
  id: number;
  event: string;
  category: string;
  venue: string;
  date: string;
  seller: string;
  price: number;
  faceValue: number;
  icon: string;
}

const initialListings: Listing[] = [
  {
    id: 1,
    event: "Sunburn Festival 2026",
    category: "Music",
    venue: "Goa",
    date: "December 20, 2026",
    seller: "Rahul",
    price: 2600,
    faceValue: 2499,
    icon: "🎵",
  },
  {
    id: 2,
    event: "Tech Summit Bengaluru",
    category: "Technology",
    venue: "Bengaluru",
    date: "December 12, 2026",
    seller: "Arjun",
    price: 1050,
    faceValue: 999,
    icon: "💻",
  },
  {
    id: 3,
    event: "Comedy Night Live",
    category: "Comedy",
    venue: "Bengaluru",
    date: "December 15, 2026",
    seller: "Karan",
    price: 500,
    faceValue: 499,
    icon: "🎤",
  },
];

export default function ResalePage() {
  const [listings, setListings] = useState(initialListings);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [maxPrice, setMaxPrice] = useState("");
  const [message, setMessage] = useState("");

  const filteredListings = useMemo(() => {
    return listings.filter((listing) => {
      const matchesSearch =
        listing.event.toLowerCase().includes(search.toLowerCase()) ||
        listing.venue.toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        category === "All" || listing.category === category;

      const matchesPrice =
        maxPrice === "" || listing.price <= Number(maxPrice);

      return matchesSearch && matchesCategory && matchesPrice;
    });
  }, [listings, search, category, maxPrice]);

  function handlePurchase(listing: Listing) {
    setMessage(
      `You selected ${listing.event}. Actual resale checkout will be connected to PostgreSQL next.`
    );
  }

  return (
    <main className="min-h-screen bg-[#080b14] text-white">
      <nav className="flex items-center justify-between border-b border-white/10 px-6 py-5 md:px-16">
        <a href="/" className="text-2xl font-bold">
          Ticket<span className="text-violet-400">Guard.</span>
        </a>
        <div className="flex items-center gap-5 text-sm text-gray-300">
          <a href="/" className="hover:text-white">Home</a>
          <a href="/resale" className="text-violet-400">Resale</a>
        </div>
      </nav>

      <section className="px-6 py-16 text-center md:py-20">
        <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-4 py-2 text-sm text-violet-300">
          Fair and Protected Ticket Resale
        </span>

        <h1 className="mt-7 text-4xl font-extrabold md:text-6xl">
          Tickets deserve a
          <br />
          <span className="text-violet-400">second chance.</span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-gray-400">
          Find tickets from other fans at controlled prices.
          Our anti-scalping system helps protect fair resale.
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20 md:px-12">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
              Marketplace
            </p>
            <h2 className="mt-2 text-3xl font-bold">Available Tickets</h2>
            <p className="mt-2 text-sm text-gray-400">
              {filteredListings.length} listings found
            </p>
          </div>

          <a
            href="#sell"
            className="rounded-xl bg-violet-600 px-6 py-3 text-center font-semibold hover:bg-violet-500"
          >
            + List Your Ticket
          </a>
        </div>

        <div className="mb-8 grid gap-3 rounded-2xl border border-white/10 bg-[#111827] p-4 md:grid-cols-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search event or city..."
            className="rounded-lg border border-white/10 bg-[#080b14] px-4 py-3 outline-none focus:border-violet-500"
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#080b14] px-4 py-3 outline-none"
          >
            <option>All</option>
            <option>Music</option>
            <option>Technology</option>
            <option>Comedy</option>
          </select>

          <input
            type="number"
            min="0"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Maximum price (₹)"
            className="rounded-lg border border-white/10 bg-[#080b14] px-4 py-3 outline-none focus:border-violet-500"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredListings.map((listing) => {
            const markup = (
              ((listing.price - listing.faceValue) / listing.faceValue) *
              100
            ).toFixed(1);

            return (
              <article
                key={listing.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-[#111827] transition hover:-translate-y-1 hover:border-violet-500/50"
              >
                <div className="flex h-36 items-center justify-center bg-gradient-to-br from-violet-700 to-indigo-900">
                  <span className="text-6xl">{listing.icon}</span>
                </div>

                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs text-violet-300">
                      {listing.category}
                    </span>
                    <span className="text-xs text-green-400">
                      ● Active listing
                    </span>
                  </div>

                  <h3 className="mt-4 text-xl font-bold">{listing.event}</h3>

                  <p className="mt-3 text-sm text-gray-400">
                    📍 {listing.venue}
                  </p>
                  <p className="mt-2 text-sm text-gray-400">
                    📅 {listing.date}
                  </p>

                  <div className="mt-5 rounded-xl bg-[#080b14] p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Original price</span>
                      <span>₹{listing.faceValue}</span>
                    </div>
                    <div className="mt-2 flex justify-between text-sm">
                      <span className="text-gray-400">Resale markup</span>
                      <span className="text-green-400">+{markup}%</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                      <span className="text-sm text-gray-400">Asking price</span>
                      <span className="text-2xl font-bold">
                        ₹{listing.price}
                      </span>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-gray-500">
                    Listed by {listing.seller}
                  </p>

                  <button
                    onClick={() => handlePurchase(listing)}
                    className="mt-4 w-full rounded-xl bg-violet-600 py-3 font-semibold hover:bg-violet-500"
                  >
                    View Ticket
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {filteredListings.length === 0 && (
          <div className="rounded-2xl border border-white/10 py-16 text-center">
            <p className="text-lg font-semibold">No tickets found</p>
            <p className="mt-2 text-sm text-gray-400">
              Try changing your search or filters.
            </p>
          </div>
        )}

        {message && (
          <div className="mt-8 rounded-xl border border-violet-500/30 bg-violet-500/10 p-4 text-violet-200">
            {message}
            <button
              onClick={() => setMessage("")}
              className="ml-3 underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </section>

      <section id="sell" className="border-t border-white/10 bg-[#0d1220] px-6 py-16 md:px-16">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Sell responsibly
          </span>
          <h2 className="mt-3 text-3xl font-bold">
            Have an extra ticket?
          </h2>
          <p className="mt-4 text-gray-400">
            List your ticket and let another fan enjoy the event.
            Resale prices are subject to our anti-scalping rules.
          </p>
          <p className="mt-6 text-sm text-gray-500">
            Ticket ownership verification, price validation and listing
            submission will be connected to PostgreSQL.
          </p>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-6 text-center text-sm text-gray-500">
        © 2026 TicketGuard. Fair tickets. Fair experiences.
      </footer>
    </main>
  );
}
