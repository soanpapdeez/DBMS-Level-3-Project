
CREATE TABLE IF NOT EXISTS booking_reviews (
    review_id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    event_id INTEGER NOT NULL REFERENCES events(event_id),
    seat_ids INTEGER[] NOT NULL,
    payment_method VARCHAR(20) NOT NULL
        CHECK (payment_method IN ('UPI', 'CARD', 'NETBANKING')),
    simulate_failure BOOLEAN NOT NULL DEFAULT FALSE,
    device_fingerprint TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    risk_score INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN (
            'PENDING', 'APPROVED', 'REJECTED',
            'PAYMENT_FAILED', 'EXPIRED'
        )),
    reviewed_by INTEGER REFERENCES users(user_id),
    reviewed_at TIMESTAMPTZ,
    booking_id INTEGER UNIQUE REFERENCES bookings(booking_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_reviews_status
    ON booking_reviews(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_booking_reviews_user
    ON booking_reviews(user_id, created_at DESC);
