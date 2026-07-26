import { useAuth } from '../context/AuthContext';

const ROLE_LABELS = {
  student: 'Student',
  instructor: 'Instructor',
  academic_staff: 'Academic Staff',
  dept_head: 'Department Head',
  admin: 'Administrator'
};

const ROLE_AVATARS = {
  student: '🧑‍🎓',
  instructor: '👨‍🏫',
  academic_staff: '🗂️',
  dept_head: '🏛️',
  admin: '🔑'
};

const ROLE_COLORS = {
  student: '#4f46e5',
  instructor: '#0891b2',
  academic_staff: '#059669',
  dept_head: '#7c3aed',
  admin: '#dc2626'
};

export default function ProfilePanel({ onClose, onEditProfile }) {
  const { user, profile, logout } = useAuth();
  if (!user) return null;

  const roleColor = ROLE_COLORS[user.role] || '#4f46e5';
  const avatar = ROLE_AVATARS[user.role] || '👤';
  const roleLabel = ROLE_LABELS[user.role] || user.role;

  const handleLogout = () => {
    logout();
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="profile-panel-backdrop" onClick={onClose} />

      {/* Panel */}
      <div className="profile-panel">
        <button className="profile-panel-close" onClick={onClose} aria-label="Close">✕</button>

        {/* Avatar & name */}
        <div className="profile-panel-hero" style={{ background: `linear-gradient(135deg, ${roleColor}22, ${roleColor}08)` }}>
          <div className="profile-panel-avatar" style={{ background: `${roleColor}20`, color: roleColor }}>
            {avatar}
          </div>
          <h2 className="profile-panel-name">{user.name}</h2>
          <span className="profile-panel-role-badge" style={{ background: `${roleColor}20`, color: roleColor }}>
            {roleLabel}
          </span>
          <p className="profile-panel-email">{user.email}</p>
        </div>

        {/* Profile details */}
        <div className="profile-panel-body">
          {user.role === 'student' && profile && (
            <div className="profile-detail-grid">
              {profile.roll_number && (
                <ProfileDetailItem label="Roll Number" value={profile.roll_number} />
              )}
              {profile.program_name && (
                <ProfileDetailItem label="Program" value={profile.program_name} />
              )}
              {profile.program_code && (
                <ProfileDetailItem label="Program Code" value={profile.program_code} />
              )}
              {profile.department && (
                <ProfileDetailItem label="Department" value={profile.department?.toUpperCase()} />
              )}
              {profile.current_semester_name && (
                <ProfileDetailItem
                  label="Current Semester"
                  value={`${profile.current_semester_name} ${profile.current_semester_year || ''}`}
                />
              )}
              {profile.previous_degree && (
                <ProfileDetailItem label="Previous Degree" value={profile.previous_degree} />
              )}
              {profile.previous_grade && (
                <ProfileDetailItem label="Grade in Prev. Degree" value={profile.previous_grade} />
              )}
              <ProfileDetailItem
                label="Profile Status"
                value={profile.profile_completed ? '✅ Complete' : '⚠️ Incomplete'}
              />
            </div>
          )}

          {user.role === 'instructor' && (
            <div className="profile-detail-grid">
              {profile?.department && (
                <ProfileDetailItem label="Department" value={profile.department?.toUpperCase()} />
              )}
              <ProfileDetailItem label="Employee ID" value={`INS-${String(user.id).slice(-4).toUpperCase()}`} />
              <ProfileDetailItem
                label="Profile Status"
                value={profile?.profile_completed ? '✅ Complete' : '⚠️ Incomplete'}
              />
            </div>
          )}

          {(user.role === 'academic_staff' || user.role === 'admin' || user.role === 'dept_head') && (
            <div className="profile-detail-grid">
              <ProfileDetailItem label="Staff ID" value={`STF-${String(user.id).slice(-4).toUpperCase()}`} />
              <ProfileDetailItem label="Access Level" value={roleLabel} />
            </div>
          )}

          {/* Actions */}
          <div className="profile-panel-actions">
            {(user.role === 'student' || user.role === 'instructor') && onEditProfile && (
              <button
                type="button"
                className="btn btn-outline btn-block"
                onClick={() => { onEditProfile(); onClose(); }}
              >
                ✏️ Edit Profile
              </button>
            )}
            <button type="button" className="btn btn-danger btn-block" onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ProfileDetailItem({ label, value }) {
  return (
    <div className="profile-detail-item">
      <span className="profile-detail-label">{label}</span>
      <span className="profile-detail-value">{value}</span>
    </div>
  );
}
