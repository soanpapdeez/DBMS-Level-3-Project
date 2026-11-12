BEGIN;

INSERT INTO seat_categories (event_id, name, price)
SELECT 1, c.name, c.price
FROM (VALUES
    ('REGULAR', 500::numeric),
    ('PREMIUM', 1000::numeric),
    ('VIP', 2000::numeric)
) AS c(name, price)
WHERE NOT EXISTS (
    SELECT 1 FROM seat_categories sc
    WHERE sc.event_id = 1 AND sc.name = c.name
);

INSERT INTO seats (event_id, category_id, row_label, seat_number, status)
SELECT
    sc.event_id,
    sc.category_id,
    CASE sc.name
        WHEN 'REGULAR' THEN 'R'
        WHEN 'PREMIUM' THEN 'P'
        WHEN 'VIP' THEN 'V'
    END,
    n,
    'AVAILABLE'
FROM seat_categories sc
CROSS JOIN generate_series(1, 10) AS n
WHERE sc.event_id = 1
AND sc.name IN ('REGULAR', 'PREMIUM', 'VIP')
AND NOT EXISTS (
    SELECT 1 FROM seats s
    WHERE s.event_id = sc.event_id
      AND s.row_label = CASE sc.name
          WHEN 'REGULAR' THEN 'R'
          WHEN 'PREMIUM' THEN 'P'
          WHEN 'VIP' THEN 'V'
      END
      AND s.seat_number = n
);

COMMIT;

SELECT * FROM v_event_availability;
