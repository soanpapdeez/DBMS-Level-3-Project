-- ============================================================
-- Digital Event Ticket Reservation & Anti-Scalping Engine
-- Owner: Sujay P Nayak
--
-- Run after db/schema.sql and before db/triggers.sql.
--
-- Owned procedures:
--   1. hold_seats()
--   2. book_tickets()
--
-- buy_resale() is owned by Sohan and is intentionally excluded.
-- ============================================================


-- ============================================================
-- 1. hold_seats()
--
-- Holds every requested seat for 5 minutes, or none of them.
--
-- Parameters:
--   p_user_id  - User requesting the hold
--   p_event_id - Event being booked
--   p_seat_ids - Array of requested seat IDs
--
-- Returns:
--   Timestamp at which the hold expires.
--
-- Raises:
--   TK400 - Invalid input
--   TK403 - User banned or event unavailable
--   TK409 - One or more seats cannot be held
-- ============================================================

CREATE OR REPLACE FUNCTION hold_seats(
    p_user_id INT,
    p_event_id INT,
    p_seat_ids INT[]
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_banned BOOLEAN;
    v_event_status VARCHAR(20);
    v_requested_count INT;
    v_valid_count INT;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Validate the requested seat list.
    IF p_seat_ids IS NULL
       OR cardinality(p_seat_ids) = 0
       OR array_position(p_seat_ids, NULL) IS NOT NULL
       OR cardinality(p_seat_ids) <> (
            SELECT COUNT(DISTINCT x)
            FROM unnest(p_seat_ids) AS u(x)
       )
    THEN
        RAISE EXCEPTION 'Invalid or duplicate seat IDs'
            USING ERRCODE = 'TK400';
    END IF;

    -- Validate user.
    SELECT u.is_banned
    INTO v_is_banned
    FROM users u
    WHERE u.user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User does not exist'
            USING ERRCODE = 'TK403';
    END IF;

    IF v_is_banned THEN
        RAISE EXCEPTION 'User is banned'
            USING ERRCODE = 'TK403';
    END IF;

    -- Lock the event while checking its status.
    SELECT e.status
    INTO v_event_status
    FROM events e
    WHERE e.event_id = p_event_id
    FOR UPDATE;

    IF NOT FOUND OR v_event_status <> 'PUBLISHED' THEN
        RAISE EXCEPTION 'Event is not available for booking'
            USING ERRCODE = 'TK403';
    END IF;

    v_requested_count := cardinality(p_seat_ids);

    -- Lock all requested seats in a consistent order.
    -- This prevents concurrent requests from holding the same seats.
    PERFORM s.seat_id
    FROM seats s
    WHERE s.seat_id = ANY(p_seat_ids)
    ORDER BY s.seat_id
    FOR UPDATE;

    -- Every requested seat must belong to this event and be:
    -- AVAILABLE, expired, or already actively held by this user.
    SELECT COUNT(*)
    INTO v_valid_count
    FROM seats s
    WHERE s.seat_id = ANY(p_seat_ids)
      AND s.event_id = p_event_id
      AND (
            s.status = 'AVAILABLE'
            OR (
                s.status = 'HELD'
                AND s.hold_expires_at <= v_now
            )
            OR (
                s.status = 'HELD'
                AND s.held_by = p_user_id
                AND s.hold_expires_at > v_now
            )
      );

    IF v_valid_count <> v_requested_count THEN
        RAISE EXCEPTION 'One or more seats are unavailable'
            USING ERRCODE = 'TK409';
    END IF;

    -- All seats are valid. Hold them together for five minutes.
    v_expires_at := v_now + INTERVAL '5 minutes';

    UPDATE seats s
    SET status = 'HELD',
        held_by = p_user_id,
        hold_expires_at = v_expires_at
    WHERE s.seat_id = ANY(p_seat_ids)
      AND s.event_id = p_event_id;

    RETURN v_expires_at;
END;
$$;


-- ============================================================
-- 2. book_tickets()
--
-- Converts a user's valid seat hold into:
--   - One booking
--   - One successful payment
--   - One ticket per held seat
--
-- Parameters:
--   p_user_id          - User making the booking
--   p_event_id         - Event being booked
--   p_seat_ids         - Seats being purchased
--   p_method           - UPI, CARD or NETBANKING
--   p_simulate_failure - Mock payment failure switch
--
-- INOUT parameters:
--   p_booking_id        - Created booking ID (NULL on failure)
--   p_total             - Total booking amount
--   p_payment_succeeded - Whether mock payment succeeded
--
-- Payment failure behaviour:
--   No booking, payment or tickets are created.
--   Seats remain HELD until their original expiry.
--
-- Raises:
--   TK400 - Invalid input
--   TK403 - User banned or event unavailable
--   TK409 - Hold invalid, expired or unavailable
--   TK421 - Ticket limit violation (from Sohan's trigger)
-- ============================================================

CREATE OR REPLACE PROCEDURE book_tickets(
    IN p_user_id INT,
    IN p_event_id INT,
    IN p_seat_ids INT[],
    IN p_method VARCHAR(20),
    IN p_simulate_failure BOOLEAN,
    INOUT p_booking_id INT,
    INOUT p_total NUMERIC(10, 2),
    INOUT p_payment_succeeded BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_banned BOOLEAN;
    v_event_status VARCHAR(20);
    v_requested_count INT;
    v_valid_count INT;
    v_inserted_count INT;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_total NUMERIC(10, 2);
BEGIN
    -- Initialise output values.
    p_booking_id := NULL;
    p_total := 0;
    p_payment_succeeded := FALSE;

    -- Validate input.
    IF p_seat_ids IS NULL
       OR cardinality(p_seat_ids) = 0
       OR array_position(p_seat_ids, NULL) IS NOT NULL
       OR cardinality(p_seat_ids) <> (
            SELECT COUNT(DISTINCT x)
            FROM unnest(p_seat_ids) AS u(x)
       )
    THEN
        RAISE EXCEPTION 'Invalid or duplicate seat IDs'
            USING ERRCODE = 'TK400';
    END IF;

    IF p_method IS NULL
       OR p_method NOT IN ('UPI', 'CARD', 'NETBANKING')
    THEN
        RAISE EXCEPTION 'Invalid payment method'
            USING ERRCODE = 'TK400';
    END IF;

    -- Validate user.
    SELECT u.is_banned
    INTO v_is_banned
    FROM users u
    WHERE u.user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User does not exist'
            USING ERRCODE = 'TK403';
    END IF;

    IF v_is_banned THEN
        RAISE EXCEPTION 'User is banned'
            USING ERRCODE = 'TK403';
    END IF;

    -- Lock and validate event.
    SELECT e.status
    INTO v_event_status
    FROM events e
    WHERE e.event_id = p_event_id
    FOR UPDATE;

    IF NOT FOUND OR v_event_status <> 'PUBLISHED' THEN
        RAISE EXCEPTION 'Event is not available for booking'
            USING ERRCODE = 'TK403';
    END IF;

    v_requested_count := cardinality(p_seat_ids);

    -- Lock requested seats in a consistent order.
    PERFORM s.seat_id
    FROM seats s
    WHERE s.seat_id = ANY(p_seat_ids)
    ORDER BY s.seat_id
    FOR UPDATE;

    -- Every requested seat must still be held by this user,
    -- for this event, and must not have expired.
    SELECT COUNT(*)
    INTO v_valid_count
    FROM seats s
    WHERE s.seat_id = ANY(p_seat_ids)
      AND s.event_id = p_event_id
      AND s.status = 'HELD'
      AND s.held_by = p_user_id
      AND s.hold_expires_at > v_now;

    IF v_valid_count <> v_requested_count THEN
        RAISE EXCEPTION 'Seat hold is invalid or has expired'
            USING ERRCODE = 'TK409';
    END IF;

    -- Calculate the total using the current category prices.
    SELECT COALESCE(SUM(sc.price), 0)
    INTO v_total
    FROM seats s
    JOIN seat_categories sc
      ON sc.category_id = s.category_id
     AND sc.event_id = s.event_id
    WHERE s.seat_id = ANY(p_seat_ids)
      AND s.event_id = p_event_id;

    p_total := v_total;

    -- Simulate a failed mock payment.
    -- Do not create a booking, payment or tickets.
    -- Do not release or extend the existing seat holds.
    IF COALESCE(p_simulate_failure, FALSE) THEN
        p_payment_succeeded := FALSE;
        RETURN;
    END IF;

    -- Create the booking.
    INSERT INTO bookings (
        user_id,
        event_id,
        status
    )
    VALUES (
        p_user_id,
        p_event_id,
        'CONFIRMED'
    )
    RETURNING booking_id INTO p_booking_id;

    -- Record successful mock payment.
    INSERT INTO payments (
        booking_id,
        listing_id,
        amount,
        method,
        status,
        transaction_ref
    )
    VALUES (
        p_booking_id,
        NULL,
        v_total,
        p_method,
        'SUCCESS',
        'MOCK-' || gen_random_uuid()::TEXT
    );

    -- Create one ticket for every requested seat.
    -- Sohan's ticket-limit trigger will also be enforced here.
    INSERT INTO tickets (
        booking_id,
        seat_id,
        owner_id,
        face_value
    )
    SELECT
        p_booking_id,
        s.seat_id,
        p_user_id,
        sc.price
    FROM seats s
    JOIN seat_categories sc
      ON sc.category_id = s.category_id
     AND sc.event_id = s.event_id
    WHERE s.seat_id = ANY(p_seat_ids)
      AND s.event_id = p_event_id
      AND s.status = 'HELD'
      AND s.held_by = p_user_id
      AND s.hold_expires_at > v_now;

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

    IF v_inserted_count <> v_requested_count THEN
        RAISE EXCEPTION 'Could not create all requested tickets'
            USING ERRCODE = 'TK409';
    END IF;

    -- Mark seats as booked and clear their hold information.
    UPDATE seats s
    SET status = 'BOOKED',
        held_by = NULL,
        hold_expires_at = NULL
    WHERE s.seat_id = ANY(p_seat_ids)
      AND s.event_id = p_event_id
      AND s.status = 'HELD'
      AND s.held_by = p_user_id;

    p_payment_succeeded := TRUE;
END;
$$;


-- ============================================================
-- END OF SUJAY'S PROCEDURES
-- ============================================================

-- =====================================================
-- DIGITAL EVENT TICKET RESERVATION SYSTEM
-- SOHAN: ANTI-SCALPING AND RESALE PROCEDURES
-- =====================================================

-- 1. BUY RESALE TICKET
-- Locks the listing, validates the purchase, transfers
-- ticket ownership, closes listing and records payment.
-- All operations participate in the caller's transaction.

CREATE OR REPLACE FUNCTION buy_resale(
    p_listing_id INT,
    p_buyer_id INT,
    p_payment_method VARCHAR(20),
    p_transaction_ref VARCHAR(80)
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_ticket_id INT;
    v_seller_id INT;
    v_ask_price NUMERIC(10,2);
    v_transfer_id INT;
BEGIN
    -- Validate payment details
    IF p_payment_method NOT IN ('UPI', 'CARD', 'NETBANKING') THEN
        RAISE EXCEPTION 'Invalid payment method';
    END IF;

    IF p_transaction_ref IS NULL OR
       length(trim(p_transaction_ref)) = 0 THEN
        RAISE EXCEPTION 'Transaction reference is required';
    END IF;

    -- Lock active listing to prevent concurrent purchases
    SELECT ticket_id, seller_id, ask_price
    INTO v_ticket_id, v_seller_id, v_ask_price
    FROM resale_listings
    WHERE listing_id = p_listing_id
      AND status = 'ACTIVE'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Resale listing is unavailable';
    END IF;

    -- Prevent self-purchase
    IF p_buyer_id = v_seller_id THEN
        RAISE EXCEPTION 'Seller cannot buy their own ticket';
    END IF;

    -- Verify buyer exists and is not banned
    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE user_id = p_buyer_id
          AND is_banned = FALSE
    ) THEN
        RAISE EXCEPTION 'Buyer does not exist or is banned';
    END IF;

    -- Verify ticket is still valid and belongs to seller
    PERFORM 1
    FROM tickets
    WHERE ticket_id = v_ticket_id
      AND owner_id = v_seller_id
      AND status = 'VALID'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ticket is invalid or ownership has changed';
    END IF;

    -- Record ticket transfer
    INSERT INTO ticket_transfers (
        ticket_id,
        from_user_id,
        to_user_id,
        listing_id
    )
    VALUES (
        v_ticket_id,
        v_seller_id,
        p_buyer_id,
        p_listing_id
    )
    RETURNING transfer_id INTO v_transfer_id;

    -- Update ticket owner
    UPDATE tickets
    SET owner_id = p_buyer_id
    WHERE ticket_id = v_ticket_id;

    -- Mark listing as sold
    UPDATE resale_listings
    SET status = 'SOLD',
        closed_at = NOW()
    WHERE listing_id = p_listing_id;

    -- Record payment
    INSERT INTO payments (
        listing_id,
        amount,
        method,
        status,
        transaction_ref
    )
    VALUES (
        p_listing_id,
        v_ask_price,
        p_payment_method,
        'SUCCESS',
        p_transaction_ref
    );

    RETURN v_transfer_id;
END;
$$;


-- 2. GET RESALE LISTINGS FOR AN EVENT
-- Returns active listings for a particular event.

CREATE OR REPLACE FUNCTION get_event_resale_listings(
    p_event_id INT
)
RETURNS TABLE (
    listing_id INT,
    ticket_id INT,
    seller_id INT,
    ask_price NUMERIC(10,2),
    face_value NUMERIC(10,2),
    listed_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        l.listing_id,
        l.ticket_id,
        l.seller_id,
        l.ask_price,
        t.face_value,
        l.listed_at
    FROM resale_listings l
    JOIN tickets t ON t.ticket_id = l.ticket_id
    JOIN bookings b ON b.booking_id = t.booking_id
    WHERE b.event_id = p_event_id
      AND l.status = 'ACTIVE'
    ORDER BY l.ask_price ASC, l.listed_at ASC;
$$;


-- 3. GET USER'S TRANSFER HISTORY
-- Returns the ownership transfer history of a ticket.

CREATE OR REPLACE FUNCTION get_ticket_transfer_history(
    p_ticket_id INT
)
RETURNS TABLE (
    transfer_id INT,
    from_user_id INT,
    to_user_id INT,
    transferred_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        tt.transfer_id,
        tt.from_user_id,
        tt.to_user_id,
        tt.transferred_at
    FROM ticket_transfers tt
    WHERE tt.ticket_id = p_ticket_id
    ORDER BY tt.transferred_at DESC;
$$;


-- =====================================================
-- END OF SOHAN'S PROCEDURES
-- =====================================================
