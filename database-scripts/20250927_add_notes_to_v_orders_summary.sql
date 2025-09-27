-- =========================================================
-- Migration: Add notes field to v_orders_summary view
-- Run this script in Supabase SQL editor or via CI pipeline.
-- Author: Cascade AI
-- Date: 2025-09-27
-- =========================================================

/*
  This migration adds the 'notes' field from the orders table to the 
  v_orders_summary view. This ensures that order notes are available
  in all places that use this view, including:
  - Orders page listing
  - Order form modal (edit mode)
  - Order details modal
  - Copy order details functionality
  
  The notes field was missing from the view, causing it to not appear
  in the frontend even though it was properly stored in the database.
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
    customer_extra_phone,
    notes
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
    c.extra_phone                AS customer_extra_phone,
    o.notes                      AS notes
FROM orders o
LEFT JOIN customers c ON c.id = o.customer_id
LEFT JOIN teams     t ON t.id = o.team_id;

-- ---------------------------------------------------------
-- Permissions (ensure anon & authenticated can still SELECT)
GRANT SELECT ON v_orders_summary TO authenticated, anon;

-- ---------------------------------------------------------
-- Comments for documentation
COMMENT ON VIEW v_orders_summary IS 'Optimized view for order listing with customer and team details, including order notes';
