import React, { useState } from 'react';
import { BookOpen, Loader2, AlertCircle, User, Lock, Mail } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000';

const LoginPage = ({ onLogin, onSwitchToSignup, notification, showNotification }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username.trim() || !password) {
      showNotification('Please fill in all fields', 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important for sessions
        body: JSON.stringify({
          username: username.trim(),
          password: password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        showNotification('Login successful!', 'success');
        onLogin(data.user);
      } else {
        showNotification(data.message || 'Login failed', 'error');
      }
    } catch (err) {
      showNotification('Failed to connect to server', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logoSection}>
          <BookOpen size={48} color="#3498DB" strokeWidth={2.5} />
          <h1 style={styles.title}>UPSC News Hub</h1>
          <p style={styles.subtitle}>Login to access your personalized news feed</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>
              <User size={18} color="#6b7280" />
              <span>Username or Email</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username or email"
              style={styles.input}
              disabled={loading}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>
              <Lock size={18} color="#6b7280" />
              <span>Password</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={styles.input}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.submitBtn,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? (
              <>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Logging in...</span>
              </>
            ) : (
              <>
                <Lock size={18} />
                <span>Login</span>
              </>
            )}
          </button>
        </form>

        <div style={styles.switchSection}>
          <p style={styles.switchText}>Don't have an account?</p>
          <button onClick={onSwitchToSignup} style={styles.switchBtn}>
            Sign Up
          </button>
        </div>
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: '#4A90E2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  card: {
    background: '#fff',
    borderRadius: '24px',
    padding: '3rem',
    maxWidth: '450px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },
  logoSection: {
    textAlign: 'center',
    marginBottom: '2.5rem',
  },
  title: {
    fontSize: '2rem',
    fontWeight: '700',
    color: '#1f2937',
    marginTop: '1rem',
    marginBottom: '0.5rem',
  },
  subtitle: {
    fontSize: '0.95rem',
    color: '#6b7280',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    padding: '0.875rem 1rem',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    fontSize: '1rem',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'all 0.2s ease',
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '1rem',
    borderRadius: '12px',
    border: 'none',
    background: '#3498DB',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    marginTop: '0.5rem',
  },
  switchSection: {
    marginTop: '2rem',
    textAlign: 'center',
    paddingTop: '2rem',
    borderTop: '1px solid #e5e7eb',
  },
  switchText: {
    fontSize: '0.95rem',
    color: '#6b7280',
    marginBottom: '0.75rem',
  },
  switchBtn: {
    background: 'none',
    border: 'none',
    color: '#3498DB',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
};

export default LoginPage;

