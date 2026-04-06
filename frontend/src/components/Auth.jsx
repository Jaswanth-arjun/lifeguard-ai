import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('patient');
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [familyPhone, setFamilyPhone] = useState('');
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (isSignUp) {
        // 1. Sign up user with metadata
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
               name: name,
               role: role,
            }
          }
        });

        if (authError) throw authError;

        if (role === 'patient' && familyPhone) {
          try {
            localStorage.setItem('lifeguard_family_phone', familyPhone);
          } catch (e) {
            console.error("Local storage error:", e);
          }
        }

        alert('Verification email sent! Please check your inbox and click the link to confirm your account before logging in.');

        navigate(`/${role}`);
      } else {
        // Sign In
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        
        // Fetch profile to know where to route
        const { data: profileData, error: profError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();
          
        if (profError) throw profError;
        
        navigate(`/${profileData.role}`);
      }
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hero-section" style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'left' }}>
      <h1 className="hub-title" style={{ fontSize: '2rem', marginBottom: '0.5rem', textAlign: 'center' }}>
        Lifeguard AI
      </h1>
      <p className="hub-subtitle" style={{ textAlign: 'center', marginBottom: '2rem' }}>
        {isSignUp ? 'Create a secure account' : 'Sign in to your dashboard'}
      </p>

      {errorMsg && (
        <div style={{ background: 'rgba(255,50,50,0.1)', color: 'var(--warn)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid rgba(255,50,50,0.2)' }}>
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {isSignUp && (
          <>
            <div>
              <label style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', marginTop: '0.25rem' }}
              />
            </div>
            <div>
              <label style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>I am a...</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', marginTop: '0.25rem' }}
              >
                <option value="patient" style={{ color: 'black' }}>Patient</option>
                <option value="family" style={{ color: 'black' }}>Family Member</option>
                <option value="doctor" style={{ color: 'black' }}>Doctor</option>
              </select>
            </div>
            {role === 'patient' && (
              <div>
                <label style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Emergency Contact Phone (WhatsApp)</label>
                <input
                  type="tel"
                  placeholder="e.g. 919876543210"
                  value={familyPhone}
                  onChange={(e) => setFamilyPhone(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', marginTop: '0.25rem' }}
                />
              </div>
            )}
          </>
        )}

        <div>
          <label style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Email Address</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', marginTop: '0.25rem' }}
          />
        </div>
        
        <div>
          <label style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', marginTop: '0.25rem' }}
          />
        </div>

        <button type="submit" disabled={loading} style={{ background: 'var(--neon-cyan)', color: 'black', padding: '1rem', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer', marginTop: '1rem' }}>
          {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
        {isSignUp ? 'Already have an account?' : "Don't have an account?"}
        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          style={{ background: 'none', border: 'none', color: 'var(--neon-cyan)', cursor: 'pointer', fontWeight: 'bold', marginLeft: '0.5rem' }}
        >
          {isSignUp ? 'Sign In' : 'Sign Up'}
        </button>
      </p>
    </div>
  );
}
