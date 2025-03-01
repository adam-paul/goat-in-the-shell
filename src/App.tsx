import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import './App.css'

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables. Please check your .env file.')
}

const supabase = createClient(supabaseUrl as string, supabaseKey as string)

function App() {
  const [dots, setDots] = useState('...')
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    // Animate the dots
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '.' : prev + '.')
    }, 500)

    return () => clearInterval(interval)
  }, [])

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    // Reset status when user starts typing again
    if (subscriptionStatus !== 'idle') {
      setSubscriptionStatus('idle')
      setErrorMessage('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic email validation
    if (!email || !email.includes('@') || !email.includes('.')) {
      setSubscriptionStatus('error')
      setErrorMessage('Please enter a valid email address')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // Insert the email into the Supabase table
      const { error } = await supabase
        .from('email-subscribe')
        .insert([{ email }])
      
      if (error) {
        console.error('Error subscribing:', error)
        
        if (error.code === '23505') { // Unique violation
          setSubscriptionStatus('error')
          setErrorMessage('This email is already subscribed')
        } else if (error.code === '42501' || error.message.includes('security policy')) {
          // Row-level security policy violation
          setSubscriptionStatus('error')
          setErrorMessage('Subscription service is temporarily unavailable. Please try again later.')
          console.error('RLS policy error. Please run the SQL commands in supabase-rls-commands.sql')
        } else {
          setSubscriptionStatus('error')
          setErrorMessage('Failed to subscribe. Please try again later.')
        }
      } else {
        setSubscriptionStatus('success')
        setEmail('') // Clear the input on success
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setSubscriptionStatus('error')
      setErrorMessage('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="app-container">
      <div className="content-wrapper">
        <h1 className="game-title">Goat In The Shell</h1>
        <div className="coming-soon-container">
          <div className="message-box">
            <p className="coming-soon-text">
              Your favorite gamer's favorite game<span className="dots-container">{dots}</span>
            </p>
            <p className="coming-soon-label">Coming Soon</p>
          </div>
          <div className="goat-animation">
            <div className="goat">🐐</div>
          </div>
        </div>
        
        <div className="subscribe-container">
          <h2 className="subscribe-title">Stay Updated</h2>
          <p className="subscribe-text">Sign up to receive updates and be the first to know when we launch!</p>
          
          <form onSubmit={handleSubmit} className="subscribe-form">
            <div className="form-group">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={handleEmailChange}
                disabled={isSubmitting}
                className="email-input"
                aria-label="Email address"
              />
              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="subscribe-button"
              >
                {isSubmitting ? 'Subscribing...' : 'Subscribe'}
              </button>
            </div>
            
            {subscriptionStatus === 'success' && (
              <div className="status-message success">
                Thanks for subscribing! We'll keep you updated.
              </div>
            )}
            
            {subscriptionStatus === 'error' && (
              <div className="status-message error">
                {errorMessage}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

export default App
