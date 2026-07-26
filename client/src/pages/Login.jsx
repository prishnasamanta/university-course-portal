import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DEMO_ACCOUNTS = [
  {
    email: 'alice@student.uni.edu',
    password: 'student123',
    role: 'student',
    label: 'Student',
    name: 'Alice Johnson',
    avatar: '🧑‍🎓',
    bio: '4th year B.Tech Computer Science student, enrolled in AI & Algorithms'
  },
  {
    email: 'dr.smith@uni.edu',
    password: 'prof1234',
    role: 'instructor',
    label: 'Instructor',
    name: 'Prof. John Smith',
    avatar: '👨‍🏫',
    bio: 'Professor of Algorithms & Data Structures, Dept. of Computer Science'
  },
  {
    email: 'staff@uni.edu',
    password: 'staff123',
    role: 'academic_staff',
    label: 'Academic Staff',
    name: 'Sarah Williams',
    avatar: '🗂️',
    bio: 'Manages course registration, exam scheduling & grade workflows'
  },
  {
    email: 'head@uni.edu',
    password: 'head123',
    role: 'dept_head',
    label: 'Dept. Head (HOD)',
    name: 'Dr. Anita Sharma',
    avatar: '🏛️',
    bio: 'Head of Computer Science Department — approves & publishes final results'
  },
  {
    email: 'admin@uni.edu',
    password: 'admin123',
    role: 'admin',
    label: 'Administrator',
    name: 'System Admin',
    avatar: '🔑',
    bio: 'Full system access — manages all users, programs, courses & settings'
  },
];

export default function Login() {
  const [tab, setTab] = useState('signin');

  // Sign in state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signinError, setSigninError] = useState('');
  const [signinLoading, setSigninLoading] = useState(false);

  // Create account state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('student');
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSignin = async (e) => {
    e.preventDefault();
    setSigninError('');
    setSigninLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        setSigninError('Server is waking up (cold start). Please wait ~20 seconds and try again!');
      } else {
        setSigninError(err.message || 'Login failed. Check your credentials.');
      }
    } finally {
      setSigninLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError('');
    if (regPassword.length < 6) {
      setRegError('Password must be at least 6 characters');
      return;
    }
    setRegLoading(true);
    try {
      await register(regName, regEmail, regPassword, regRole);
      navigate('/');
    } catch (err) {
      setRegError(err.message || 'Registration failed. Please try again.');
    } finally {
      setRegLoading(false);
    }
  };

  const quickLogin = (acc) => {
    setTab('signin');
    setEmail(acc.email);
    setPassword(acc.password);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <span className="brand-icon large">🎓</span>
          <h1>University Portal</h1>
          <p>Course Registration &amp; Result Publication System</p>
        </div>

        {/* Tab switcher */}
        <div className="login-tabs">
          <button
            type="button"
            className={`login-tab ${tab === 'signin' ? 'active' : ''}`}
            onClick={() => setTab('signin')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`login-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => setTab('register')}
          >
            Create Account
          </button>
        </div>

        {/* Sign In form */}
        {tab === 'signin' && (
          <form onSubmit={handleSignin} className="login-form">
            {signinError && <div className="alert alert-error">{signinError}</div>}
            <label>
              Email
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="your@email.com" />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
            </label>
            <button type="submit" className="btn btn-primary btn-block" disabled={signinLoading}>
              {signinLoading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        )}

        {/* Register form */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="login-form">
            {regError && <div className="alert alert-error">{regError}</div>}
            <label>
              Full Name
              <input value={regName} onChange={e => setRegName(e.target.value)} required placeholder="Your full name" />
            </label>
            <label>
              Email
              <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required placeholder="your@email.com" />
            </label>
            <label>
              Password
              <input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} required placeholder="Min. 6 characters" />
            </label>
            <label>
              I am a…
              <select value={regRole} onChange={e => setRegRole(e.target.value)}>
                <option value="student">Student</option>
                <option value="instructor">Instructor / Faculty</option>
              </select>
            </label>
            <button type="submit" className="btn btn-primary btn-block" disabled={regLoading}>
              {regLoading ? 'Creating account…' : 'Create Account'}
            </button>
            <p className="login-switch-hint">Already have an account? <button type="button" className="link-btn" onClick={() => setTab('signin')}>Sign in</button></p>
          </form>
        )}

        {/* Demo accounts — single line small profile circles */}
        <div className="demo-accounts">
          <h3>Quick Fill Demo Accounts</h3>
          <div className="demo-circle-row">
            {DEMO_ACCOUNTS.map(acc => (
              <button
                key={acc.email}
                type="button"
                className="demo-circle-btn"
                onClick={() => quickLogin(acc)}
                title={`${acc.name} — ${acc.bio}`}
              >
                <span className="demo-circle-avatar">{acc.avatar}</span>
                <span className="demo-circle-label">{acc.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
