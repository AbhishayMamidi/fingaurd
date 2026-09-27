import React, { useState } from 'react';
import { api, tokenStorage } from '../api/client';

export function AuthModal({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        if (!fullName || fullName.trim().length < 2) {
          throw new Error('Full name is required.');
        }
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters long.');
        }
        const data = await api.register({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
        });
        tokenStorage.setToken(data.token);
        tokenStorage.setUser(data.user);
        onLoginSuccess(data.user);
      } else {
        const data = await api.login({
          email: email.trim(),
          password,
        });
        tokenStorage.setToken(data.token);
        tokenStorage.setUser(data.user);
        onLoginSuccess(data.user);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>🛡️</span>
            <h3 className="modal-title">{isRegister ? 'Create FinGuard Account' : 'Sign in to FinGuard'}</h3>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--danger)',
                border: '1px solid var(--danger)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem'
              }}>
                {error}
              </div>
            )}

            {isRegister && (
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                required
                minLength={8}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                {isRegister ? 'Must be at least 8 characters long.' : ''}
              </span>
            </div>

            <div style={{ textAlign: 'center', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                {isRegister
                  ? 'Already have an account? Sign In'
                  : "Don't have an account yet? Register"}
              </button>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? 'Processing...' : isRegister ? 'Register & Continue' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
