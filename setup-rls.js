import { createClient } from '@supabase/supabase-js'

// Use the service role key for admin operations
const supabaseUrl = 'https://vjyfzwsvdzdbavkgjypa.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqeWZ6d3N2ZHpkYmF2a2dqeXBhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDc3NTE5NiwiZXhwIjoyMDU2MzUxMTk2fQ.RUvbfOZCozAUAMmJMJrlOZ2q-LsBh0cuWiawpDQqAdE'

const supabase = createClient(supabaseUrl, supabaseKey)

async function setupRLS() {
  try {
    console.log('Setting up RLS policies for email-subscribe table...')
    
    // First, enable RLS on the table
    const { error: enableRLSError } = await supabase.rpc('execute_sql', {
      sql_query: `
        ALTER TABLE "email-subscribe" ENABLE ROW LEVEL SECURITY;
      `
    })
    
    if (enableRLSError) {
      console.error('Error enabling RLS:', enableRLSError)
      return
    }
    
    console.log('RLS enabled on email-subscribe table')
    
    // Create a policy that allows anonymous users to insert their email
    const { error: insertPolicyError } = await supabase.rpc('execute_sql', {
      sql_query: `
        CREATE POLICY "Allow anonymous insert" ON "email-subscribe"
        FOR INSERT
        TO anon
        WITH CHECK (true);
      `
    })
    
    if (insertPolicyError) {
      console.error('Error creating insert policy:', insertPolicyError)
      return
    }
    
    console.log('Insert policy created successfully')
    
    // Create a policy that allows only authenticated users to select data
    const { error: selectPolicyError } = await supabase.rpc('execute_sql', {
      sql_query: `
        CREATE POLICY "Allow authenticated select" ON "email-subscribe"
        FOR SELECT
        TO authenticated
        USING (true);
      `
    })
    
    if (selectPolicyError) {
      console.error('Error creating select policy:', selectPolicyError)
      return
    }
    
    console.log('Select policy created successfully')
    
    console.log('RLS setup completed successfully!')
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

setupRLS() 