-- Add lampiran_pdf column to klaim table
-- This stores the URL to the combined PDF of all images

ALTER TABLE klaim ADD COLUMN IF NOT EXISTS lampiran_pdf TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN klaim.lampiran_pdf IS 'URL to combined PDF of all uploaded images';

-- Note: The existing 'lampiran' column will now store JSON array of image URLs
-- Example format: [{"url": "...", "name": "...", "size": 123}]
