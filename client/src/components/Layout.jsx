import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS = {
  student: 'Student',
  instructor: 'Instructor',
  academic_staff: 'Academic Staff',
  dept_head: 'Department Head',
  admin: 'Administrator'
};

export default function Layout() {
  const { user, profile, logout } = useAuth();

  const studentLinks = [
    { to: '/', label: 'Dashboard' },
    { to: '/register', label: 'Course Registration' },
    { to: '/grades', label: 'Grade Card' },
    { to: '/transcript', label: 'Transcript' },
  ];

  const instructorLinks = [
    { to: '/', label: 'My Sections' },
    { to: '/results', label: 'Results Entry' },
  ];

  const staffLinks = [
    { to: '/', label: 'Course Management' },
    { to: '/grade-workflow', label: 'Grade Workflow' },
    { to: '/revisions', label: 'Revisions' },
  ];

  const hodLinks = [
    { to: '/hod-review', label: 'HOD Review' },
    { to: '/revisions', label: 'Revisions' },
  ];

  let links = studentLinks;
  if (user?.role === 'instructor') links = instructorLinks;
  if (user?.role === 'academic_staff' || user?.role === 'admin') links = staffLinks;
  if (user?.role === 'dept_head') links = hodLinks;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">🎓</span>
          <div>
            <strong>University Portal</strong>
            <small>Course Registration & Results</small>
          </div>
        </div>
        <div className="user-info">
          <div>
            <strong>{user?.name}</strong>
            <small>{ROLE_LABELS[user?.role]} {profile?.roll_number ? `• ${profile.roll_number}` : ''}</small>
          </div>
          <button type="button" className="btn btn-outline" onClick={logout}>Logout</button>
        </div>
      </header>

      <div className="main-layout">
        <nav className="sidebar">
          {links.map(link => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
