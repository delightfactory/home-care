-- =========================================================
-- Migration: Add customer_extra_phone to v_orders_summary
-- Run this script in Supabase SQL editor or via CI pipeline.
-- Author: Cascade AI
-- Date: 2025-08-16
-- =========================================================

/*
  This view powers the order listing/search in the Front-End.  
  We are appending the customer's extra phone (customers.extra_phone) 
  to enable searching & displaying it from the API layer.
*/

CREATE OR REPLACE VIEW v_orders_summary (
    id,
    order_number,
    customer_id,
    customer_name,
    customer_phone,
    team_id,
    team_name,
    scheduled_date,
    scheduled_time,
    status,
    payment_status,
    total_amount,
    transport_cost,
    customer_rating,
    created_at,
    updated_at,
    customer_area,
    customer_feedback,
    customer_extra_phone
) AS
SELECT
    o.id,
    o.order_number,
    o.customer_id,
    c.name                       AS customer_name,
    c.phone                      AS customer_phone,
    o.team_id,
    t.name                       AS team_name,
    o.scheduled_date,
    o.scheduled_time,
    o.status,
    o.payment_status,
    o.total_amount,
    o.transport_cost,
    o.customer_rating,
    o.created_at,
    o.updated_at,
    c.area                       AS customer_area,
    o.customer_feedback          AS customer_feedback,
    c.extra_phone                AS customer_extra_phone
FROM orders o
LEFT JOIN customers c ON c.id = o.customer_id
LEFT JOIN teams     t ON t.id = o.team_id;

-- Optional: create index for faster extra-phone search (depends on workload)
-- CREATE INDEX IF NOT EXISTS idx_v_orders_summary_extra_phone ON v_orders_summary (customer_extra_phone);

-- ---------------------------------------------------------
-- Permissions (ensure anon & authenticated can still SELECT)
GRANT SELECT ON v_orders_summary TO authenticated, anon;
