-- Enable RLS on the pictures table if not already enabled
ALTER TABLE public.pictures ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow authenticated users to insert into pictures.
CREATE POLICY "Allow authenticated inserts on pictures" 
  ON public.pictures
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
