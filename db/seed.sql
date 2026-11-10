
-- ============================================================
-- Digital Event Ticket Reservation & Anti-Scalping Engine
-- Local development seed data
-- Owner: Sujay
--
-- Run after schema.sql
-- Safe to execute more than once.
-- ============================================================

BEGIN;

-- 1. ROLES
INSERT INTO roles (name)
VALUES
    ('CUSTOMER'),
    ('ADMIN'),
    ('STAFF')
ON CONFLICT (name) DO NOTHING;


-- 2. VENUE
INSERT INTO venues (name, city, address)
SELECT
    'Test Arena',
    'Bengaluru',
    'Test Address, Bengaluru'
WHERE NOT EXISTS (
    SELECT 1
    FROM venues
    WHERE name = 'Test Arena'
      AND city = 'Bengaluru'
);


-- 3. TEST USERS
-- Password hashes are placeholders for database testing.
-- These accounts are not intended for real authentication.

INSERT INTO users (
    role_id,
    full_name,
    email,
    password_hash
)
SELECT
    r.role_id,
    'Test Customer',
    'customer@test.local',
    'TEST_ONLY_NOT_A_REAL_PASSWORD_HASH'
FROM roles r
WHERE r.name = 'CUSTOMER'
AND NOT EXISTS (
    SELECT 1 FROM users
    WHERE email = 'customer@test.local'
);

INSERT INTO users (
    role_id,
    full_name,
    email,
    password_hash
)
SELECT
    r.role_id,
    'Test Admin',
    'admin@test.local',
    'TEST_ONLY_NOT_A_REAL_PASSWORD_HASH'
FROM roles r
WHERE r.name = 'ADMIN'
AND NOT EXISTS (
    SELECT 1 FROM users
    WHERE email = 'admin@test.local'
);


-- 4. PUBLISHED TEST EVENT
INSERT INTO events (
    venue_id,
    organizer_id,
    title,
    description,
    starts_at,
    status
)
SELECT
    v.venue_id,
    u.user_id,
    'Test Concert',
    'Local test event for booking and seat reservation.',
    NOW() + INTERVAL '30 days',
    'PUBLISHED'
FROM venues v
CROSS JOIN users u
WHERE v.name = 'Test Arena'
  AND v.city = 'Bengaluru'
  AND u.email = 'admin@test.local'
  AND NOT EXISTS (
      SELECT 1
      FROM events e
      WHERE e.title = 'Test Concert'
        AND e.venue_id = v.venue_id
  );


-- 5. SEAT CATEGORIES
INSERT INTO seat_categories (
    event_id,
    name,
    price
)
SELECT
    e.event_id,
    category.name,
    category.price
FROM events e
CROSS JOIN (
    VALUES
        ('REGULAR', 500.00::NUMERIC(10,2)),
        ('PREMIUM', 1000.00::NUMERIC(10,2))
) AS category(name, price)
WHERE e.title = 'Test Concert'
  AND NOT EXISTS (
      SELECT 1
      FROM seat_categories sc
      WHERE sc.event_id = e.event_id
        AND sc.name = category.name
  );


-- 6. TEST SEATS
-- Rows A and B: 10 seats each.
-- Row A: REGULAR
-- Row B: PREMIUM

INSERT INTO seats (
    event_id,
    category_id,
    row_label,
    seat_number
)
SELECT
    e.event_id,
    sc.category_id,
    seat_row.row_label,
    seat_number.number
FROM events e
JOIN seat_categories sc
    ON sc.event_id = e.event_id
CROSS JOIN (
    VALUES
        ('A', 'REGULAR'),
        ('B', 'PREMIUM')
) AS seat_row(row_label, category_name)
CROSS JOIN generate_series(1, 10) AS seat_number(number)
WHERE e.title = 'Test Concert'
  AND sc.name = seat_row.category_name
  AND NOT EXISTS (
      SELECT 1
      FROM seats s
      WHERE s.event_id = e.event_id
        AND s.row_label = seat_row.row_label
        AND s.seat_number = seat_number.number
  );

COMMIT;


-- ============================================================
-- VERIFY SEEDED DATA
-- ============================================================

SELECT user_id, full_name, email
FROM users
WHERE email IN ('customer@test.local', 'admin@test.local')
ORDER BY user_id;

SELECT event_id, title, status, starts_at
FROM events
WHERE title = 'Test Concert';

SELECT
    s.seat_id,
    s.row_label,
    s.seat_number,
    sc.name AS category,
    sc.price,
    s.status
FROM seats s
JOIN seat_categories sc
    ON sc.category_id = s.category_id
   AND sc.event_id = s.event_id
JOIN events e
    ON e.event_id = s.event_id
WHERE e.title = 'Test Concert'
ORDER BY s.row_label, s.seat_number;
