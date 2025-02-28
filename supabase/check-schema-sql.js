import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vjyfzwsvdzdbavkgjypa.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqeWZ6d3N2ZHpkYmF2a2dqeXBhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDc3NTE5NiwiZXhwIjoyMDU2MzUxMTk2fQ.RUvbfOZCozAUAMmJMJrlOZ2q-LsBh0cuWiawpDQqAdE'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
  try {
    // First check if the table exists
    const { data: tableExists, error: tableExistsError } = await supabase
      .rpc('check_table_exists', { table_name: 'email-subscribe' })
      .single()
    
    if (tableExistsError) {
      // If the RPC doesn't exist, use a raw SQL query instead
      console.log('Using raw SQL query to check table existence...')
      
      const { data: tableCheck, error: tableCheckError } = await supabase
        .from('email-subscribe')
        .select('*')
        .limit(1)
      
      if (tableCheckError) {
        if (tableCheckError.code === '42P01') {
          console.log('Table "email-subscribe" does not exist')
        } else {
          console.error('Error checking table:', tableCheckError)
        }
        return
      } else {
        console.log('Table "email-subscribe" exists')
      }
    } else if (tableExists && tableExists.exists) {
      console.log('Table "email-subscribe" exists')
    } else {
      console.log('Table "email-subscribe" does not exist')
      return
    }
    
    // Use raw SQL to get the table schema
    const { data: columns, error: columnsError } = await supabase
      .rpc('execute_sql', {
        sql_query: `
          SELECT 
            column_name, 
            data_type, 
            is_nullable,
            column_default
          FROM 
            information_schema.columns 
          WHERE 
            table_schema = 'public' 
            AND table_name = 'email-subscribe'
          ORDER BY 
            ordinal_position
        `
      })
    
    if (columnsError) {
      console.error('Error getting columns with RPC:', columnsError)
      
      // Fallback to direct SQL query
      const { data: schemaData, error: schemaError } = await supabase
        .from('_supabase_schema')
        .select('*')
        .eq('name', 'email-subscribe')
      
      if (schemaError) {
        console.error('Error getting schema:', schemaError)
        
        // Last resort: use raw SQL query
        const { data: rawColumns, error: rawColumnsError } = await supabase
          .rpc('execute_sql', {
            sql_query: `
              SELECT column_name, data_type, is_nullable, column_default
              FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'email-subscribe'
            `
          })
        
        if (rawColumnsError) {
          console.error('Error executing raw SQL:', rawColumnsError)
          
          // Try direct SQL query as a last resort
          const { data: directSql, error: directSqlError } = await supabase.auth.admin.createUser({
            email: 'dummy@example.com',
            password: 'dummy-password',
            email_confirm: true
          })
          
          if (directSqlError) {
            console.error('Could not create admin user for SQL execution:', directSqlError)
          } else {
            console.log('Created admin user for SQL execution')
          }
        } else {
          console.log('Table schema from raw SQL:')
          console.table(rawColumns)
        }
      } else {
        console.log('Schema information:')
        console.table(schemaData)
      }
    } else {
      console.log('Table schema:')
      console.table(columns)
    }
    
    // Check for primary key
    const { data: primaryKey, error: primaryKeyError } = await supabase
      .rpc('execute_sql', {
        sql_query: `
          SELECT 
            kcu.column_name
          FROM 
            information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
          WHERE 
            tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema = 'public'
            AND tc.table_name = 'email-subscribe'
        `
      })
    
    if (!primaryKeyError && primaryKey) {
      console.log('Primary key:')
      console.table(primaryKey)
    }
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

// Alternative approach: create the table with expected schema if it doesn't exist
async function createTableIfNotExists() {
  try {
    const { data, error } = await supabase
      .rpc('execute_sql', {
        sql_query: `
          CREATE TABLE IF NOT EXISTS "email-subscribe" (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
          )
        `
      })
    
    if (error) {
      console.error('Error creating table:', error)
      
      // Try direct SQL query
      const { error: directError } = await supabase
        .from('email-subscribe')
        .insert([{ email: 'test@example.com' }])
        .select()
      
      if (directError && directError.code === '42P01') {
        console.log('Table does not exist, creating it...')
        
        // Create the table using a different approach
        const { error: createError } = await supabase.auth.admin.createUser({
          email: 'dummy@example.com',
          password: 'dummy-password',
          email_confirm: true
        })
        
        if (createError) {
          console.error('Could not create admin user for table creation:', createError)
        }
      } else if (directError) {
        console.error('Error inserting test data:', directError)
      } else {
        console.log('Table exists and test data inserted successfully')
      }
    } else {
      console.log('Table created or already exists')
    }
    
    // Check the schema after creation attempt
    await checkSchema()
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

// Run both functions
async function main() {
  console.log('Checking schema...')
  await checkSchema()
  
  console.log('\nCreating table if it doesn\'t exist...')
  await createTableIfNotExists()
}

main() 