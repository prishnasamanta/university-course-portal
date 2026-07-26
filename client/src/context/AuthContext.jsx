import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showProfileSetup, setShowProfileSetup] = useState(false);

  const refreshProfile = useCallback(async () => {
    const me = await api.me();
    setUser(me.user);
    setProfile(me.profile);
    return me;
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    refreshProfile()
      .then((me) => {
        // Only show setup popup if profile is explicitly incomplete
        const role = me.user?.role;
        const completed = me.profile?.profile_completed;
        if ((role === 'student' || role === 'instructor') && completed === 0) {
          setShowProfileSetup(true);
        }
      })
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, [refreshProfile]);

  const login = async (email, password) => {
    const { token } = await api.login(email, password);
    localStorage.setItem('token', token);
    const me = await refreshProfile();
    const role = me.user?.role;
    const profileDone = me.profile?.profile_completed;
    // Only show setup for roles that need it AND haven't completed profile yet
    if ((role === 'student' || role === 'instructor') && !profileDone) {
      localStorage.setItem('needs_profile_setup', 'true');
      setShowProfileSetup(true);
    }
    return me.user;
  };

  const register = async (name, email, password, role) => {
    const { token } = await api.register(name, email, password, role);
    localStorage.setItem('token', token);
    await refreshProfile();
    // New accounts always need profile setup
    if (role === 'student' || role === 'instructor') {
      localStorage.setItem('needs_profile_setup', 'true');
      setShowProfileSetup(true);
    }
    return { name, email, role };
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setProfile(null);
    setShowProfileSetup(false);
  };

  const completeProfileSetup = async () => {
    setShowProfileSetup(false);
    await refreshProfile();
  };

  const needsProfileSetup = () => showProfileSetup;

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      login, logout, register,
      refreshProfile, needsProfileSetup,
      completeProfileSetup, showProfileSetup
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
