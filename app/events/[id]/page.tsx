
"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

type Seat = {
  seatId: number;
  eventId: number;
  rowLabel: string;
  seatNumber: number;
  categoryId: number;
  categoryName: string;
  price: number;
  status: "AVAILABLE" | "HELD" | "BOOKED";
};

function EventDetailsContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = params.id;

  const [event, setEvent] = useState<EventItem | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [holding, setHolding] = useState(false);
  const [error, setError] = useState("");

  const loadEvent = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [eventResponse, seatsResponse] = await Promise.all([
        fetch(`/api/events/${eventId}`),
        fetch(`/api/events/${eventId}/seats`),
      ]);

      const eventData = await eventResponse.json();
      const seatsData = await seatsResponse.json();

      if (!eventResponse.ok) {
        throw new Error(eventData.error || "Unable to load event.");
      }

      if (!seatsResponse.ok) {
        throw new Error(seatsData.error || "Unable to load seats.");
      }

      setEvent(eventData.event);
      setSeats(seatsData.seats || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  const selectedSeatDetails = useMemo(
    () => seats.filter((seat) => selectedSeats.includes(seat.seatId)),
    [seats, selectedSeats]
  );

  const totalPrice = selectedSeatDetails.reduce(
    (total, seat) => total + seat.price,
    0
  );

  const categories = useMemo(() => {
    const unique = new Map<number, { name: string; price: number }>();

    seats.forEach((seat) => {
      unique.set(seat.categoryId, {
        name: seat.categoryName,
        price: seat.price,
      });
    });

    return Array.from(unique.entries()).map(([id, category]) => ({
      id,
      ...category,
    }));
  }, [seats]);

  const rows = useMemo(() => {
    const grouped = new Map<string, Seat[]>();

    seats.forEach((seat) => {
      const row = grouped.get(seat.rowLabel) || [];
      row.push(seat);
      grouped.set(seat.rowLabel, row);
    });

    return Array.from(grouped.entries()).map(([label, rowSeats]) => ({
      label,
      seats: rowSeats.sort((a, b) => a.seatNumber - b.seatNumber),
    }));
  }, [seats]);

  function toggleSeat(seat: Seat) {
    if (seat.status !== "AVAILABLE" || holding) return;

    setSelectedSeats((current) =>
      current.includes(seat.seatId)
        ? current.filter((id) => id !== seat.seatId)
        : [...current, seat.seatId]
    );
  }

  function getSeatColor(seat: Seat) {
    if (selectedSeats.includes(seat.seatId)) {
      return "border-purple-400 bg-purple-600 text-white shadow-lg shadow-purple-500/30";
    }

    if (seat.status === "BOOKED") {
      return "cursor-not-allowed border-slate-700 bg-slate-800 text-slate-600";
    }

    if (seat.status === "HELD") {
      return "cursor-not-allowed border-amber-500/30 bg-amber-500/15 text-amber-500";
    }

    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:border-emerald-400 hover:bg-emerald-500/25";
  }

  async function handleContinue() {
    if (selectedSeats.length === 0) return;

    setHolding(true);
    setError("");

    try {
      if (!eventId || !Number.isInteger(Number(eventId))) {
        throw new Error("Invalid event.");
      }

      let fingerprint = localStorage.getItem("ticketengine_device");

      if (!fingerprint) {
        fingerprint = window.crypto.randomUUID();
        localStorage.setItem("ticketengine_device", fingerprint);
      }

      const response = await fetch(`/api/events/${eventId}/hold`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          seatIds: selectedSeats,
          deviceFingerprint: fingerprint,
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Unable to hold selected seats.");
      }

      const query = new URLSearchParams({
        eventId,
        seatIds: selectedSeats.join(","),
        expiresAt: data.expiresAt,
      });

      router.push(`/checkout?${query.toString()}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to continue."
      );
      await loadEvent();
    } finally {
      setHolding(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08080f] text-white">
        <p className="animate-pulse text-slate-400">Loading event...</p>
      </main>
    );
  }

  if (error && !event) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#08080f] px-5 text-white">
        <h1 className="text-2xl font-bold">Unable to load event</h1>
        <p className="text-center text-slate-400">{error}</p>
        <Link href="/" className="text-purple-400 hover:text-purple-300">
          Back to events
        </Link>
      </main>
    );
  }

  if (!event) return null;

  return (
    <main className="min-h-screen bg-[#08080f] text-white">
      {/* Navigation */}
      <nav className="border-b border-white/10 bg-[#08080f]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold">
            Ticket<span className="text-blue-400">Engine</span>
          </Link>

          <Link
            href="/"
            className="text-sm text-slate-400 transition hover:text-white"
          >
            ← Back to events
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        {/* Event heading */}
        <div className="mb-10">
          <p className="mb-3 text-sm font-bold uppercase tracking-widest text-purple-400">
            Event details
          </p>

          <h1 className="text-3xl font-extrabold sm:text-4xl">
            {event.title}
          </h1>

          <div className="mt-5 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-400">
            <span>🗓️ {new Date(event.startsAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}</span>

            <span>🕒 {new Date(event.startsAt).toLocaleTimeString("en-IN", {
              hour: "numeric",
              minute: "2-digit",
            })}</span>

            <span>📍 {event.venue}, {event.city}</span>
          </div>

          {event.description && (
            <p className="mt-5 max-w-3xl leading-7 text-slate-400">
              {event.description}
            </p>
          )}
        </div>

        {/* Seat selection */}
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_340px]">
          <section className="rounded-2xl border border-white/10 bg-[#141421] p-5 sm:p-8">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Select your seats</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Choose your preferred seats below.
                </p>
              </div>

              <button
                onClick={loadEvent}
                disabled={loading || holding}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50"
              >
                ↻ Refresh seats
              </button>
            </div>

            {/* Screen */}
            <div className="mb-12">
              <div className="mx-auto h-2 max-w-md rounded-full bg-gradient-to-r from-purple-500 via-pink-400 to-purple-500 shadow-lg shadow-purple-500/30" />
              <p className="mt-3 text-center text-xs font-semibold tracking-[0.3em] text-slate-500">
                STAGE / SCREEN
              </p>
            </div>

            {/* Seat legend */}
            <div className="mb-8 flex flex-wrap justify-center gap-x-6 gap-y-3 text-xs text-slate-400">
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded border border-emerald-500 bg-emerald-500/20" />
                Available
              </span>

              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded border border-purple-400 bg-purple-600" />
                Selected
              </span>

              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded border border-amber-500/40 bg-amber-500/20" />
                Held
              </span>

              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded border border-slate-700 bg-slate-800" />
                Booked
              </span>
            </div>

            {/* Seat rows */}
            <div className="space-y-5 overflow-x-auto pb-4">
              {rows.map((row) => (
                <div
                  key={row.label}
                  className="flex min-w-max items-center justify-center gap-3"
                >
                  <span className="w-6 text-sm font-bold text-slate-500">
                    {row.label}
                  </span>

                  <div className="flex gap-2">
                    {row.seats.map((seat) => (
                      <button
                        key={seat.seatId}
                        type="button"
                        title={`${row.label}${seat.seatNumber} - ${seat.categoryName} - ₹${seat.price} - ${seat.status}`}
                        aria-label={`Row ${row.label}, seat ${seat.seatNumber}, ${seat.status}`}
                        aria-pressed={selectedSeats.includes(seat.seatId)}
                        disabled={seat.status !== "AVAILABLE" || holding}
                        onClick={() => toggleSeat(seat)}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-semibold transition ${getSeatColor(seat)}`}
                      >
                        {seat.seatNumber}
                      </button>
                    ))}
                  </div>

                  <span className="w-6 text-sm font-bold text-slate-500">
                    {row.label}
                  </span>
                </div>
              ))}
            </div>

            {seats.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">
                No seats are configured for this event.
              </p>
            )}

            {/* Category prices */}
            <div className="mt-8 border-t border-white/10 pt-6">
              <h3 className="mb-4 text-sm font-semibold text-slate-300">
                Ticket categories
              </h3>

              <div className="flex flex-wrap gap-3">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="rounded-xl border border-white/10 bg-[#0d0d18] px-4 py-3"
                  >
                    <p className="text-sm font-medium">
                      {category.name}
                    </p>
                    <p className="mt-1 text-sm font-bold text-purple-400">
                      ₹{category.price.toLocaleString("en-IN")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Booking summary */}
          <aside className="sticky top-6 rounded-2xl border border-white/10 bg-[#141421] p-6">
            <h2 className="text-xl font-bold">Booking Summary</h2>

            <p className="mt-2 line-clamp-2 text-sm text-slate-400">
              {event.title}
            </p>

            <div className="my-6 border-t border-white/10" />

            <div className="flex justify-between text-sm text-slate-400">
              <span>Selected seats</span>
              <span className="font-semibold text-white">
                {selectedSeats.length}
              </span>
            </div>

            <div className="my-5 space-y-3">
              {selectedSeatDetails.map((seat) => (
                <div
                  key={seat.seatId}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-300">
                    {seat.rowLabel}{seat.seatNumber} · {seat.categoryName}
                  </span>

                  <span className="font-medium">
                    ₹{seat.price.toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>

            {selectedSeats.length === 0 && (
              <p className="py-5 text-center text-sm text-slate-500">
                Select seats to see your booking summary.
              </p>
            )}

            <div className="border-t border-white/10 pt-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Total amount</span>
                <span className="text-2xl font-extrabold">
                  ₹{totalPrice.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {error && (
              <p role="alert" className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              onClick={handleContinue}
              disabled={selectedSeats.length === 0 || holding}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 py-3.5 font-bold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {holding ? "Holding seats..." : "Continue to Checkout →"}
            </button>

            <p className="mt-4 text-center text-xs leading-5 text-slate-500">
              Selected seats are held for 5 minutes when you continue.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function EventDetailsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#08080f] text-white">
          Loading event...
        </main>
      }
    >
      <EventDetailsContent />
    </Suspense>
  );
}