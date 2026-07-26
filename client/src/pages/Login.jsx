import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DEMO_ACCOUNTS = [
  { email: 'alice@student.uni.edu', password: 'student123', role: 'Student' },
  { email: 'dr.smith@uni.edu', password: 'inst123', role: 'Instructor' },
  { email: 'staff@uni.edu', password: 'staff123', role: 'Academic Staff' },
  { email: 'head@uni.edu', password: 'head123', role: 'Dept Head' },
  { email: 'admin@uni.edu', password: 'admin123', role: 'Admin' },
];

export default function Login() {
  const [email, setEmail] = useState('alice@student.uni.edu');
  const [password, setPassword] = useState('student123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (account) => {
    setEmail(account.email);
    setPassword(account.password);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <span className="brand-icon large">🎓</span>
          <h1>University Portal</h1>
          <p>Course Registration & Result Publication System</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="alert alert-error">{error}</div>}
          <label>
            Email
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </label>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="demo-accounts">
          <h3>Demo Accounts</h3>
          <div className="demo-grid">
            {DEMO_ACCOUNTS.map(acc => (
              <button key={acc.email} type="button" className="demo-btn" onClick={() => quickLogin(acc)}>
                <strong>{acc.role}</strong>
                <small>{acc.email}</small>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
