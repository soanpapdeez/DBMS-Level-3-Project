CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- SECTION A: Sujay
CREATE TABLE roles (
  role_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(20) NOT NULL UNIQUE CHECK (name IN ('CUSTOMER', 'ADMIN', 'STAFF'))
);

CREATE TABLE users (
  user_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_id INT NOT NULL REFERENCES roles(role_id),
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash TEXT NOT NULL,
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE venues (
  venue_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  city VARCHAR(80) NOT NULL,
  address TEXT NOT NULL,
  UNIQUE (name, city)
);

CREATE TABLE events (
  event_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  venue_id INT NOT NULL REFERENCES venues(venue_id),
  organizer_id INT NOT NULL REFERENCES users(user_id),
  title VARCHAR(150) NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE seat_categories (
  category_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id INT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  UNIQUE (event_id, name),
  UNIQUE (category_id, event_id)
);

CREATE TABLE seats (
  seat_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id INT NOT NULL,
  category_id INT NOT NULL,
  row_label VARCHAR(5) NOT NULL,
  seat_number INT NOT NULL CHECK (seat_number > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'
    CHECK (status IN ('AVAILABLE', 'HELD', 'BOOKED')),
  held_by INT REFERENCES users(user_id),
  hold_expires_at TIMESTAMPTZ,
  UNIQUE (event_id, row_label, seat_number),
  FOREIGN KEY (category_id, event_id)
    REFERENCES seat_categories(category_id, event_id) ON DELETE CASCADE,
  CHECK ((status = 'HELD') = (held_by IS NOT NULL AND hold_expires_at IS NOT NULL))
);

CREATE TABLE bookings (
  booking_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(user_id),
  event_id INT NOT NULL REFERENCES events(event_id),
  status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED'
    CHECK (status IN ('CONFIRMED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tickets (
  ticket_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id INT NOT NULL REFERENCES bookings(booking_id),
  seat_id INT NOT NULL REFERENCES seats(seat_id),
  owner_id INT NOT NULL REFERENCES users(user_id),
  face_value NUMERIC(10, 2) NOT NULL CHECK (face_value >= 0),
  ticket_code UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status VARCHAR(20) NOT NULL DEFAULT 'VALID'
    CHECK (status IN ('VALID', 'USED', 'CANCELLED')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SECTION B: Sohan
CREATE TABLE purchase_limits (
  limit_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id INT NOT NULL UNIQUE REFERENCES events(event_id) ON DELETE CASCADE,
  max_tickets_per_user INT NOT NULL DEFAULT 4 CHECK (max_tickets_per_user > 0),
  max_transfers_per_ticket INT NOT NULL DEFAULT 2 CHECK (max_transfers_per_ticket >= 0),
  resale_cap_percent NUMERIC(5, 2) NOT NULL DEFAULT 110 CHECK (resale_cap_percent >= 100),
  resale_cutoff_hours INT NOT NULL DEFAULT 24 CHECK (resale_cutoff_hours >= 0)
);

CREATE TABLE resale_listings (
  listing_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id INT NOT NULL REFERENCES tickets(ticket_id),
  seller_id INT NOT NULL REFERENCES users(user_id),
  ask_price NUMERIC(10, 2) NOT NULL CHECK (ask_price > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'SOLD', 'CANCELLED')),
  listed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  CHECK ((status = 'ACTIVE') = (closed_at IS NULL))
);

CREATE TABLE ticket_transfers (
  transfer_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id INT NOT NULL REFERENCES tickets(ticket_id),
  from_user_id INT NOT NULL REFERENCES users(user_id),
  to_user_id INT NOT NULL REFERENCES users(user_id),
  listing_id INT UNIQUE REFERENCES resale_listings(listing_id),
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_user_id <> to_user_id)
);

-- SECTION C: shared
CREATE TABLE payments (
  payment_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id INT UNIQUE REFERENCES bookings(booking_id),
  listing_id INT UNIQUE REFERENCES resale_listings(listing_id),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  method VARCHAR(20) NOT NULL CHECK (method IN ('UPI', 'CARD', 'NETBANKING')),
  status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS'
    CHECK (status IN ('SUCCESS', 'REFUNDED')),
  transaction_ref VARCHAR(80) NOT NULL UNIQUE,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(booking_id, listing_id) = 1)
);

-- SECTION D: Sohan
CREATE TABLE violations (
  violation_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(user_id),
  event_id INT REFERENCES events(event_id),
  violation_type VARCHAR(30) NOT NULL
    CHECK (violation_type IN ('TICKET_LIMIT', 'RESALE_PRICE', 'TRANSFER_RULE', 'BOT_ACTIVITY')),
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE flagged_accounts (
  flag_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(user_id),
  reason TEXT NOT NULL,
  risk_score INT CHECK (risk_score BETWEEN 0 AND 100),
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'CLEARED', 'BANNED')),
  flagged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by INT REFERENCES users(user_id),
  reviewed_at TIMESTAMPTZ,
  CHECK ((status = 'OPEN') = (reviewed_by IS NULL)),
  CHECK ((status = 'OPEN') = (reviewed_at IS NULL))
);

CREATE TABLE waitlist (
  waitlist_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id INT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(user_id),
  status VARCHAR(20) NOT NULL DEFAULT 'WAITING'
    CHECK (status IN ('WAITING', 'NOTIFIED', 'BOOKED', 'EXPIRED')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- INDEXES
CREATE INDEX idx_seats_event_status ON seats (event_id, status);
CREATE INDEX idx_events_starts_at ON events (starts_at);
CREATE INDEX idx_events_title_fts ON events USING GIN (to_tsvector('english', title));
CREATE INDEX idx_bookings_user ON bookings (user_id);
CREATE INDEX idx_tickets_owner ON tickets (owner_id);
CREATE INDEX idx_tickets_booking ON tickets (booking_id);
CREATE INDEX idx_resale_status ON resale_listings (status);
CREATE INDEX idx_transfers_ticket ON ticket_transfers (ticket_id);
CREATE INDEX idx_violations_user ON violations (user_id);

CREATE UNIQUE INDEX uq_valid_ticket_per_seat
  ON tickets (seat_id) WHERE status = 'VALID';
CREATE UNIQUE INDEX uq_active_listing_per_ticket
  ON resale_listings (ticket_id) WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX uq_open_flag_per_user
  ON flagged_accounts (user_id) WHERE status = 'OPEN';

-- VIEWS
CREATE VIEW v_event_availability AS
SELECT e.event_id, e.title, e.description, e.starts_at, e.status,
       v.name AS venue, v.city,
       COUNT(s.seat_id) AS total_seats,
       COUNT(s.seat_id) FILTER (
         WHERE s.status = 'AVAILABLE'
            OR (s.status = 'HELD' AND s.hold_expires_at <= now())
       ) AS available_seats,
       MIN(c.price) AS min_price
FROM events e
JOIN venues v ON v.venue_id = e.venue_id
LEFT JOIN seats s ON s.event_id = e.event_id
LEFT JOIN seat_categories c ON c.category_id = s.category_id
GROUP BY e.event_id, v.venue_id;

CREATE VIEW v_flagged_users AS
SELECT f.flag_id, u.user_id, u.full_name, u.email, u.is_banned,
       f.reason, f.risk_score, f.status, f.flagged_at,
       (SELECT COUNT(*) FROM violations x WHERE x.user_id = u.user_id) AS violation_count
FROM flagged_accounts f
JOIN users u ON u.user_id = f.user_id;

CREATE VIEW v_resale_report AS
SELECT l.listing_id, e.event_id, e.title, t.ticket_id, t.face_value, l.ask_price,
       ROUND((l.ask_price / NULLIF(t.face_value, 0) - 1) * 100, 2) AS markup_percent,
       l.status, u.full_name AS seller, l.listed_at
FROM resale_listings l
JOIN tickets t ON t.ticket_id = l.ticket_id
JOIN bookings b ON b.booking_id = t.booking_id
JOIN events e ON e.event_id = b.event_id
JOIN users u ON u.user_id = l.seller_id;