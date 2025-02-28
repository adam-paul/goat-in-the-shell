-- Enable Row Level Security on the email-subscribe table
ALTER TABLE "email-subscribe" ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows anonymous users to insert their email
CREATE POLICY "Allow anonymous insert" ON "email-subscribe"
FOR INSERT
TO anon
WITH CHECK (true);

-- Create a policy that allows only authenticated users to select data
CREATE POLICY "Allow authenticated select" ON "email-subscribe"
FOR SELECT
TO authenticated
USING (true);

-- Optional: Create a policy that allows service role to do everything
CREATE POLICY "Allow service role full access" ON "email-subscribe"
FOR ALL
TO service_role
USING (true)
WITH CHECK (true); 