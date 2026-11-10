-- ============================================================
-- DIGITAL EVENT TICKET RESERVATION & ANTI-SCALPING ENGINE
-- db/queries.sql
-- Booking and Inventory read queries
-- ============================================================


-- 1. SEARCH PUBLISHED EVENTS
-- $1 = search text (nullable)
-- $2 = city (nullable)

SELECT
    event_id,
    title,
    description,
    starts_at,
    venue,
    city,
    total_seats,
    available_seats,
    min_price
FROM v_event_availability
WHERE status = 'PUBLISHED'
  AND (
      $1::TEXT IS NULL
      OR title ILIKE '%' || $1 || '%'
      OR description ILIKE '%' || $1 || '%'
  )
  AND (
      $2::TEXT IS NULL
      OR city ILIKE '%' || $2 || '%'
  )
ORDER BY starts_at ASC;


-- 2. GET EVENT DETAILS
-- $1 = event ID

SELECT
    event_id,
    title,
    description,
    starts_at,
    venue,
    city,
    total_seats,
    available_seats,
    min_price
FROM v_event_availability
WHERE event_id = $1
  AND status = 'PUBLISHED';


-- 3. GET EVENT SEAT MAP
-- $1 = event ID
-- Expired holds are displayed as AVAILABLE.

SELECT
    s.seat_id,
    s.event_id,
    s.row_label,
    s.seat_number,
    s.category_id,
    c.name AS category_name,
    c.price,
    CASE
        WHEN s.status = 'HELD'
             AND s.hold_expires_at <= NOW()
            THEN 'AVAILABLE'
        ELSE s.status
    END AS display_status
FROM seats s
JOIN seat_categories c
    ON c.category_id = s.category_id
   AND c.event_id = s.event_id
WHERE s.event_id = $1
ORDER BY s.row_label, s.seat_number;


-- 4. GET USER'S TICKETS
-- $1 = authenticated user's ID

SELECT
    t.ticket_id,
    t.ticket_code,
    t.status AS ticket_status,
    t.face_value,
    t.issued_at,
    b.booking_id,
    b.status AS booking_status,
    e.event_id,
    e.title AS event_title,
    e.starts_at,
    v.name AS venue,
    v.city,
    s.row_label,
    s.seat_number,
    c.name AS category_name
FROM tickets t
JOIN bookings b
    ON b.booking_id = t.booking_id
JOIN events e
    ON e.event_id = b.event_id
JOIN venues v
    ON v.venue_id = e.venue_id
JOIN seats s
    ON s.seat_id = t.seat_id
JOIN seat_categories c
    ON c.category_id = s.category_id
   AND c.event_id = s.event_id
WHERE t.owner_id = $1
ORDER BY t.issued_at DESC;


-- 5. GET A SPECIFIC BOOKING
-- $1 = authenticated user's ID
-- $2 = booking ID

SELECT
    b.booking_id,
    b.user_id,
    b.event_id,
    b.status AS booking_status,
    b.created_at,
    e.title AS event_title,
    e.starts_at,
    v.name AS venue,
    v.city,
    p.amount AS amount_paid,
    p.method AS payment_method,
    p.status AS payment_status,
    p.transaction_ref
FROM bookings b
JOIN events e
    ON e.event_id = b.event_id
JOIN venues v
    ON v.venue_id = e.venue_id
LEFT JOIN payments p
    ON p.booking_id = b.booking_id
WHERE b.user_id = $1
  AND b.booking_id = $2;


-- 6. GET ALL TICKETS IN A BOOKING
-- $1 = authenticated user's ID
-- $2 = booking ID

SELECT
    t.ticket_id,
    t.ticket_code,
    t.status AS ticket_status,
    t.face_value,
    s.seat_id,
    s.row_label,
    s.seat_number,
    c.name AS category_name
FROM tickets t
JOIN bookings b
    ON b.booking_id = t.booking_id
JOIN seats s
    ON s.seat_id = t.seat_id
JOIN seat_categories c
    ON c.category_id = s.category_id
   AND c.event_id = s.event_id
WHERE b.user_id = $1
  AND b.booking_id = $2
ORDER BY s.row_label, s.seat_number;