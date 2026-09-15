ALTER TABLE penyelesaian 
ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN DEFAULT false;

SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'penyelesaian' 
AND column_name = 'is_confidential';
