import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vjyfzwsvdzdbavkgjypa.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqeWZ6d3N2ZHpkYmF2a2dqeXBhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDc3NTE5NiwiZXhwIjoyMDU2MzUxMTk2fQ.RUvbfOZCozAUAMmJMJrlOZ2q-LsBh0cuWiawpDQqAdE'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkTableSchema() {
  try {
    // First, check if the table exists by trying to select from it
    const { error: tableError } = await supabase
      .from('email-subscribe')
      .select('*')
      .limit(1)
    
    if (tableError) {
      if (tableError.code === '42P01') {
        console.log('Table "email-subscribe" does not exist')
        
        // Suggest a schema for the table
        console.log('\nSuggested schema for email-subscribe table:')
        console.log(`
CREATE TABLE "email-subscribe" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
)`)
      } else {
        console.error('Error checking table:', tableError)
      }
      return
    }
    
    console.log('Table "email-subscribe" exists')
    
    // Use fetch to directly call the Supabase REST API to get table info
    const response = await fetch(
      `${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    if (!response.ok) {
      console.error('Error fetching schema from REST API:', response.statusText)
      return
    }
    
    const definitions = await response.json()
    
    // Find the email-subscribe table definition
    const tableDefinition = definitions.definitions && 
                           definitions.definitions['email-subscribe']
    
    if (tableDefinition) {
      console.log('\nTable schema from REST API:')
      console.log(JSON.stringify(tableDefinition, null, 2))
      
      // Extract and display column information in a more readable format
      if (tableDefinition.properties) {
        console.log('\nColumns:')
        Object.entries(tableDefinition.properties).forEach(([columnName, columnDef]) => {
          console.log(`- ${columnName}: ${columnDef.type || 'unknown type'}${columnDef.format ? ` (${columnDef.format})` : ''}`)
        })
      }
    } else {
      console.log('Could not find table definition in REST API response')
      
      // Try to infer schema by inserting and then selecting
      console.log('\nAttempting to infer schema by querying...')
      
      // Try to select with specific columns to see if they exist
      const { data, error } = await supabase
        .from('email-subscribe')
        .select('id, email, created_at, updated_at')
        .limit(1)
      
      if (error) {
        console.error('Error querying table:', error)
      } else {
        console.log('Table has the following columns:')
        if (data && data.length > 0) {
          Object.keys(data[0]).forEach(column => {
            console.log(`- ${column}: ${typeof data[0][column]}`)
          })
        } else {
          console.log('Table exists but is empty. Columns detected:')
          // If no data, we can only report the column names we tried to select
          console.log('- id (likely UUID)')
          console.log('- email (likely TEXT)')
          console.log('- created_at (likely TIMESTAMP WITH TIME ZONE)')
          console.log('- updated_at (likely TIMESTAMP WITH TIME ZONE)')
        }
      }
    }
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

checkTableSchema() 