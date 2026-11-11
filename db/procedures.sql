
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
