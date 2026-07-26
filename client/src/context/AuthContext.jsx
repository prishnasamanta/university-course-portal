import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

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
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, [refreshProfile]);

  const login = async (email, password) => {
    const { token } = await api.login(email, password);
    localStorage.setItem('token', token);
    const me = await refreshProfile();
    return me.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setProfile(null);
  };

  const needsProfileSetup = () => {
    if (!user || !profile) return false;
    if (user.role === 'student') return !profile.profile_completed;
    if (user.role === 'instructor') return !profile.profile_completed;
    return false;
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, refreshProfile, needsProfileSetup }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
