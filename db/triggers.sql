
-- ============================================
-- SOHAN: ANTI-SCALPING TRIGGERS
-- ============================================

-- 1. Enforce per-user ticket purchase limit
CREATE OR REPLACE FUNCTION enforce_purchase_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_event_id INT;
  v_limit INT;
  v_count INT;
BEGIN
  IF NEW.status <> 'VALID' THEN
    RETURN NEW;
  END IF;

  SELECT event_id INTO v_event_id
  FROM bookings
  WHERE booking_id = NEW.booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking does not exist';
  END IF;

  -- Prevent simultaneous purchases bypassing the limit
  PERFORM pg_advisory_xact_lock(NEW.owner_id, v_event_id);

  SELECT COALESCE(max_tickets_per_user, 4)
  INTO v_limit
  FROM purchase_limits
  WHERE event_id = v_event_id;

  IF NOT FOUND THEN
    v_limit := 4;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM tickets t
  JOIN bookings b ON b.booking_id = t.booking_id
  WHERE t.owner_id = NEW.owner_id
    AND b.event_id = v_event_id
    AND t.status = 'VALID'
    AND (TG_OP = 'INSERT' OR t.ticket_id <> NEW.ticket_id);

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Ticket purchase limit exceeded. Maximum allowed: %', v_limit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_purchase_limit
BEFORE INSERT OR UPDATE OF owner_id, booking_id, status
ON tickets
FOR EACH ROW
EXECUTE FUNCTION enforce_purchase_limit();


-- 2. Enforce resale price cap and ownership
CREATE OR REPLACE FUNCTION enforce_resale_rules()
RETURNS TRIGGER AS $$
DECLARE
  v_face_value NUMERIC(10,2);
  v_owner_id INT;
  v_event_id INT;
  v_cap NUMERIC(5,2);
  v_cutoff INT;
  v_start TIMESTAMPTZ;
BEGIN
  IF NEW.status <> 'ACTIVE' THEN
    RETURN NEW;
  END IF;

  SELECT t.face_value, t.owner_id, b.event_id, e.starts_at
  INTO v_face_value, v_owner_id, v_event_id, v_start
  FROM tickets t
  JOIN bookings b ON b.booking_id = t.booking_id
  JOIN events e ON e.event_id = b.event_id
  WHERE t.ticket_id = NEW.ticket_id
    AND t.status = 'VALID';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket is invalid or does not exist';
  END IF;

  IF NEW.seller_id <> v_owner_id THEN
    RAISE EXCEPTION 'Only the current ticket owner can list it';
  END IF;

  SELECT resale_cap_percent, resale_cutoff_hours
  INTO v_cap, v_cutoff
  FROM purchase_limits
  WHERE event_id = v_event_id;

  IF NOT FOUND THEN
    v_cap := 110;
    v_cutoff := 24;
  END IF;

  IF NEW.ask_price > v_face_value * v_cap / 100 THEN
    RAISE EXCEPTION 'Resale price exceeds the permitted cap of % percent', v_cap;
  END IF;

  IF v_start <= now() + make_interval(hours => v_cutoff) THEN
    RAISE EXCEPTION 'Resale is not allowed within % hours of the event', v_cutoff;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_resale_rules
BEFORE INSERT OR UPDATE OF ticket_id, seller_id, ask_price, status
ON resale_listings
FOR EACH ROW
EXECUTE FUNCTION enforce_resale_rules();


-- 3. Enforce ticket transfer rules
CREATE OR REPLACE FUNCTION enforce_transfer_rules()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id INT;
  v_event_id INT;
  v_transfer_count INT;
  v_max_transfers INT;
  v_cutoff INT;
  v_start TIMESTAMPTZ;
BEGIN
  SELECT t.owner_id, b.event_id, e.starts_at
  INTO v_owner_id, v_event_id, v_start
  FROM tickets t
  JOIN bookings b ON b.booking_id = t.booking_id
  JOIN events e ON e.event_id = b.event_id
  WHERE t.ticket_id = NEW.ticket_id
    AND t.status = 'VALID';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket is invalid or does not exist';
  END IF;

  IF NEW.from_user_id <> v_owner_id THEN
    RAISE EXCEPTION 'Transfer sender is not the current ticket owner';
  END IF;

  SELECT max_transfers_per_ticket, resale_cutoff_hours
  INTO v_max_transfers, v_cutoff
  FROM purchase_limits
  WHERE event_id = v_event_id;

  IF NOT FOUND THEN
    v_max_transfers := 2;
    v_cutoff := 24;
  END IF;

  SELECT COUNT(*) INTO v_transfer_count
  FROM ticket_transfers
  WHERE ticket_id = NEW.ticket_id;

  IF v_transfer_count >= v_max_transfers THEN
    RAISE EXCEPTION 'Maximum ticket transfers exceeded';
  END IF;

  IF v_start <= now() + make_interval(hours => v_cutoff) THEN
    RAISE EXCEPTION 'Ticket transfer is not allowed within % hours of the event', v_cutoff;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transfer_rules
BEFORE INSERT ON ticket_transfers
FOR EACH ROW
EXECUTE FUNCTION enforce_transfer_rules();


-- 4. Automatically flag accounts after repeated violations
CREATE OR REPLACE FUNCTION auto_flag_repeated_violations()
RETURNS TRIGGER AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM violations
  WHERE user_id = NEW.user_id
    AND created_at >= now() - INTERVAL '24 hours';

  IF v_count >= 3 THEN
    INSERT INTO flagged_accounts (user_id, reason, risk_score)
    VALUES (
      NEW.user_id,
      'Three or more violations recorded within 24 hours',
      60
    )
    ON CONFLICT (user_id) WHERE status = 'OPEN'
    DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_flag_violations
AFTER INSERT ON violations
FOR EACH ROW
EXECUTE FUNCTION auto_flag_repeated_violations();
