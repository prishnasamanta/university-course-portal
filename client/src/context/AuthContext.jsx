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
    if (!token) {
      setLoading(false);
      return;
    }
    refreshProfile()
      .then((me) => {
        // Show profile setup if flagged from first login
        if (localStorage.getItem('needs_profile_setup') === 'true') {
          const role = me.user?.role;
          if (role === 'student' || role === 'instructor') {
            setShowProfileSetup(true);
          }
        }
      })
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, [refreshProfile]);

  const login = async (email, password) => {
    const { token } = await api.login(email, password);
    localStorage.setItem('token', token);
    localStorage.setItem('needs_profile_setup', 'true');
    const me = await refreshProfile();
    const role = me.user?.role;
    if (role === 'student' || role === 'instructor') {
      setShowProfileSetup(true);
    }
    return me.user;
  };

  const register = async (name, email, password, role) => {
    const { token } = await api.register(name, email, password, role);
    localStorage.setItem('token', token);
    localStorage.setItem('needs_profile_setup', 'true');
    const me = await refreshProfile();
    if (role === 'student' || role === 'instructor') {
      setShowProfileSetup(true);
    }
    return me.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('needs_profile_setup');
    setUser(null);
    setProfile(null);
    setShowProfileSetup(false);
  };

  const completeProfileSetup = async () => {
    localStorage.removeItem('needs_profile_setup');
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
