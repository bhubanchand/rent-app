-- MIGRATION: PHONE NUMBER SUPPORT & OPTIONAL EMAIL
-- Run this in your Supabase SQL Editor

-- 1. Ensure all existing customers have a non-null phone value before setting NOT NULL
UPDATE public.customers 
SET phone = '+910000000000' 
WHERE phone IS NULL;

-- 2. Rename the phone column to phone_number
ALTER TABLE public.customers 
RENAME COLUMN phone TO phone_number;

-- 3. Set phone_number to NOT NULL (required)
ALTER TABLE public.customers 
ALTER COLUMN phone_number SET NOT NULL;

-- 4. Set email to nullable (optional)
ALTER TABLE public.customers 
ALTER COLUMN email DROP NOT NULL;
