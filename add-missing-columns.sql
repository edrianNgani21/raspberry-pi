-- Migration Script: Add Missing Columns to Match Existing Database Structure
-- Run this in your Supabase SQL Editor to update your existing database

-- Add missing columns to vehicle_information table
ALTER TABLE vehicle_information 
ADD COLUMN IF NOT EXISTS drivers_license BYTEA,
ADD COLUMN IF NOT EXISTS school_id BYTEA,
ADD COLUMN IF NOT EXISTS enrollment_form BYTEA,
ADD COLUMN IF NOT EXISTS authorization_letter BYTEA;

-- Update registration table to match new schema if needed
ALTER TABLE registration 
ALTER COLUMN mobile DROP NOT NULL IF EXISTS,
ALTER COLUMN receipt DROP NOT NULL IF EXISTS,
ALTER COLUMN agreement_form DROP NOT NULL IF EXISTS;

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'vehicle_information' 
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'department' 
ORDER BY ordinal_position;