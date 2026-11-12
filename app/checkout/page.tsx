
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type EventItem = {
  eventId: number;
  title: string;
  startsAt: string;
  venue: string;
  city: string;
};

type Seat = {
  seatId: number;
  rowLabel: string;
  seatNumber: number;
  categoryName: string;
  price: number;
  status: string;
};

type PaymentMethod = "UPI" | "CARD" | "NETBANKING";

type BookingResult = {
  bookingId?: number;
  total?: number;
  bookingPending?: boolean;
  riskScore?: number;
  action?: string;
};

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const eventId = Number(searchParams.get("eventId"));
  const seatIds = (searchParams.get("seatIds") || "")
    .split(",")
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);

  const expiresAt = searchParams.get("expiresAt");

  const [event, setEvent] = useState<EventItem | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("UPI");
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState<BookingResult | null>(null);

  useEffect(() => {
    async function loadCheckout() {
      if (!Number.isInteger(eventId) || eventId <= 0 || seatIds.length === 0) {
        setError("Invalid checkout details. Please select your seats again.");
        setLoading(false);
        return;
      }

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

        const selected = (seatsData.seats as Seat[]).filter((seat) =>
          seatIds.includes(seat.seatId)
        );

        if (selected.length !== seatIds.length) {
          throw new Error("Some selected seats could not be found.");
        }

        setSeats(selected);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load checkout."
        );
      } finally {
        setLoading(false);
      }
    }

    loadCheckout();
  }, [eventId, seatIds.join(",")]);

  const total = seats.reduce((sum, seat) => sum + seat.price, 0);

  async function handlePayment() {
    setSubmitting(true);
    setError("");

    try {
      let fingerprint = localStorage.getItem("ticketengine_device");

      if (!fingerprint) {
        fingerprint = window.crypto.randomUUID();
        localStorage.setItem("ticketengine_device", fingerprint);
      }

      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId,
          seatIds,
          method,
          simulateFailure,
          deviceFingerprint: fingerprint,
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Payment or booking failed.");
      }

      // HTTP 202 means the booking is awaiting admin review.
      // HTTP 201 means the booking was successfully completed.
      setBooking({
        bookingId: data.bookingId,
        total: data.total,
        bookingPending: data.bookingPending === true || response.status === 202,
        riskScore: data.riskScore,
        action: data.action,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08080f] text-white">
        <p className="animate-pulse text-slate-400">Preparing checkout...</p>
      </main>
    );
  }

  if (booking) {
    const isPendingReview = booking.bookingPending === true;

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08080f] px-5 py-12 text-white">
        <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#141421] p-8 text-center shadow-2xl">
          <div
            className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full text-4xl ${
              isPendingReview
                ? "bg-amber-500/15 text-amber-400"
                : "bg-emerald-500/15 text-emerald-400"
            }`}
          >
            {isPendingReview ? "⌛" : "✓"}
          </div>

          <p
            className={`mb-3 text-sm font-bold uppercase tracking-widest ${
              isPendingReview ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            {isPendingReview ? "Booking under review" : "Booking confirmed"}
          </p>

          <h1 className="text-3xl font-extrabold">
            {isPendingReview
              ? "Your request is being reviewed"
              : "You're going to the event!"}
          </h1>

          <p className="mt-3 text-slate-400">
            {isPendingReview
              ? "Your booking request has been submitted and is awaiting admin approval. Your seats have not been permanently booked."
              : "Your payment was successful and your seats have been booked."}
          </p>

          <div className="my-8 rounded-2xl border border-white/10 bg-[#0d0d18] p-5 text-left">
            {!isPendingReview && booking.bookingId !== undefined && (
              <div className="flex justify-between gap-4">
                <span className="text-sm text-slate-400">Booking ID</span>
                <span className="font-bold">#{booking.bookingId}</span>
              </div>
            )}

            <div className="mt-4 flex justify-between gap-4">
              <span className="text-sm text-slate-400">Event</span>
              <span className="text-right font-semibold">
                {event?.title}
              </span>
            </div>

            <div className="mt-4 flex justify-between gap-4">
              <span className="text-sm text-slate-400">Seats</span>
              <span className="font-semibold">
                {seats
                  .map((seat) => `${seat.rowLabel}${seat.seatNumber}`)
                  .join(", ")}
              </span>
            </div>

            {isPendingReview ? (
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="font-bold text-amber-400">
                  Pending Admin Approval
                </p>
                {booking.riskScore !== undefined && (
                  <p className="mt-2 text-sm text-slate-400">
                    Risk Score: {booking.riskScore}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-4 flex justify-between gap-4 border-t border-white/10 pt-4">
                <span className="text-sm text-slate-400">Amount paid</span>
                <span className="text-xl font-extrabold text-emerald-400">
                  ₹{Number(booking.total ?? 0).toLocaleString("en-IN")}
                </span>
              </div>
            )}
          </div>

          <Link
            href="/"
            className="block w-full rounded-xl bg-blue-600 py-3.5 font-bold transition hover:bg-blue-500"
          >
            Back to Home
          </Link>
        </section>
      </main>
    );
  }

  if (error && !event) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#08080f] px-5 text-white">
        <h1 className="text-2xl font-bold">Checkout unavailable</h1>
        <p className="text-center text-slate-400">{error}</p>
        <Link
          href="/"
          className="text-purple-400 hover:text-purple-300"
        >
          Back to events
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08080f] text-white">
      <nav className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-xl font-bold">
            Ticket<span className="text-blue-400">Engine</span>
          </Link>

          <Link
            href={`/events/${eventId}`}
            className="text-sm text-slate-400 hover:text-white"
          >
            ← Back to seats
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <div className="mb-10">
          <p className="mb-3 text-sm font-bold uppercase tracking-widest text-purple-400">
            Secure checkout
          </p>
          <h1 className="text-3xl font-extrabold sm:text-4xl">
            Complete your booking
          </h1>
          <p className="mt-3 text-slate-400">
            Review your seats and choose a payment method.
          </p>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[1fr_380px]">
          <section className="rounded-2xl border border-white/10 bg-[#141421] p-6 sm:p-8">
            <h2 className="text-xl font-bold">Payment method</h2>
            <p className="mt-2 text-sm text-slate-400">
              Select how you would like to pay.
            </p>

            <div className="mt-7 space-y-3">
              {([
                {
                  value: "UPI",
                  title: "UPI",
                  description: "Pay using UPI",
                  symbol: "₹",
                },
                {
                  value: "CARD",
                  title: "Credit / Debit Card",
                  description: "Pay using your bank card",
                  symbol: "▣",
                },
                {
                  value: "NETBANKING",
                  title: "Net Banking",
                  description: "Pay through your bank",
                  symbol: "⌂",
                },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMethod(option.value)}
                  className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition ${
                    method === option.value
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-white/10 bg-[#0d0d18] hover:border-white/20"
                  }`}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/5 text-xl">
                    {option.symbol}
                  </span>

                  <span className="flex-1">
                    <span className="block font-semibold">
                      {option.title}
                    </span>
                    <span className="mt-1 block text-xs text-slate-400">
                      {option.description}
                    </span>
                  </span>

                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                      method === option.value
                        ? "border-purple-400 bg-purple-500"
                        : "border-slate-600"
                    }`}
                  >
                    {method === option.value && (
                      <span className="h-2 w-2 rounded-full bg-white" />
                    )}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-8 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={simulateFailure}
                  onChange={(e) => setSimulateFailure(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-amber-500"
                />
                <span>
                  <span className="block text-sm font-semibold text-amber-300">
                    Simulate payment failure
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">
                    Testing option: intentionally make the mock payment fail.
                    Your seat hold will remain until its original expiry.
                  </span>
                </span>
              </label>
            </div>
          </section>

          <aside className="rounded-2xl border border-white/10 bg-[#141421] p-6">
            <h2 className="text-xl font-bold">Order summary</h2>

            {event && (
              <>
                <h3 className="mt-5 text-lg font-semibold">{event.title}</h3>
                <p className="mt-2 text-sm text-slate-400">
                  📍 {event.venue}, {event.city}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  🗓️{" "}
                  {new Date(event.startsAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </>
            )}

            <div className="my-6 border-t border-white/10" />

            <div className="space-y-4">
              {seats.map((seat) => (
                <div
                  key={seat.seatId}
                  className="flex justify-between gap-4 text-sm"
                >
                  <span className="text-slate-300">
                    {seat.rowLabel}{seat.seatNumber} · {seat.categoryName}
                  </span>
                  <span className="font-semibold">
                    ₹{seat.price.toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>

            <div className="my-6 border-t border-white/10" />

            <div className="flex justify-between text-sm text-slate-400">
              <span>Tickets</span>
              <span>{seats.length}</span>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="font-semibold">Total amount</span>
              <span className="text-2xl font-extrabold">
                ₹{total.toLocaleString("en-IN")}
              </span>
            </div>

            {expiresAt && (
              <p className="mt-4 text-xs leading-5 text-amber-400">
                Seat hold expires:{" "}
                {new Date(expiresAt).toLocaleTimeString("en-IN", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300"
              >
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handlePayment}
              disabled={
                submitting ||
                seats.length !== seatIds.length ||
                seats.length === 0
              }
              className="mt-7 w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 py-3.5 font-bold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "Processing..."
                : `Pay ₹${total.toLocaleString("en-IN")}`}
            </button>

            <p className="mt-4 text-center text-xs leading-5 text-slate-500">
              This project uses a simulated payment flow. No real money will be charged.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#08080f] text-white">
          Loading checkout...
        </main>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
