-- Add 'staff_of' value to the association_type enum
ALTER TYPE association_type ADD VALUE IF NOT EXISTS 'staff_of';
