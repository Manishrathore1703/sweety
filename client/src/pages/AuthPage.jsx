import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, ShieldCheck } from 'lucide-react';
import { getApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

const defaultForm = {
  name: '',
  email: '',
  password: '',
  role: 'patient',
  doctor_registration_code: '',
};

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, register, user } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      navigate(user.role === 'doctor' ? '/doctor' : '/patient', { replace: true });
    }
  }, [navigate, user]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const payload = {
        ...form,
        email: form.email.trim(),
      };

      let nextUser;

      if (mode === 'login') {
        nextUser = (await login({ email: payload.email, password: payload.password })).user;
      } else {
        nextUser = (await register(payload)).user;
      }

      navigate(nextUser.role === 'doctor' ? '/doctor' : '/patient', { replace: true });
    } catch (caughtError) {
      setError(getApiError(caughtError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <aside className="auth-panel">
          <div className="brand-mark">
            <Activity size={28} />
            <span>Sweety</span>
          </div>

          <h1>Track blood sugar with confidence.</h1>
          <p>
            Manage readings, stay on top of trends, and share glucose summaries with
            your assigned doctor.
          </p>

          <ul className="feature-list">
            <li>
              <ShieldCheck size={16} />
              Secure patient and doctor access
            </li>
            <li>
              <ShieldCheck size={16} />
              Daily and monthly glucose reporting
            </li>
            <li>
              <ShieldCheck size={16} />
              Backed by role-based connections
            </li>
          </ul>
        </aside>

        <section className="auth-card">
          <div className="auth-toggle" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => setMode('login')}
            >
              Login
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'active' : ''}
              onClick={() => setMode('register')}
            >
              Register
            </button>
          </div>

          <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <label>
                <span>Full name</span>
                <input
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Jane Doe"
                  required
                />
              </label>
            )}

            <label>
              <span>Email</span>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
              />
            </label>

            <label>
              <span>Password</span>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="At least 8 characters"
                required
              />
            </label>

            {mode === 'register' && (
              <label>
                <span>Role</span>
                <select name="role" value={form.role} onChange={handleChange}>
                  <option value="patient">Patient</option>
                  <option value="doctor">Doctor</option>
                </select>
              </label>
            )}

            {mode === 'register' && form.role === 'doctor' && (
              <label>
                <span>Doctor registration code</span>
                <input
                  name="doctor_registration_code"
                  type="password"
                  value={form.doctor_registration_code}
                  onChange={handleChange}
                  placeholder="Enter the shared registration code"
                />
              </label>
            )}

            {error ? <p className="error-banner">{error}</p> : null}

            <button type="submit" className="primary-button" disabled={busy}>
              {busy
                ? mode === 'login'
                  ? 'Signing in…'
                  : 'Creating account…'
                : mode === 'login'
                  ? 'Sign in'
                  : 'Register'}
              <ArrowRight size={16} />
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
