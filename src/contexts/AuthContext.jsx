import { createContext, useContext, useEffect, useState } from 'react';
import { getUserProfile, onAuthStateChange, signIn, signOut } from '../services/supabaseAuth';

const AuthContext = createContext({
  user: null,
  role: null,
  loading: true,
  login: async () => {},
  logout: async () => {}
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial fetch
    getUserProfile().then(profile => {
      if (profile) {
        setUser(profile);
        setRole(profile.role);
      }
      setLoading(false);
    });

    // Listen for changes
    const unsubscribe = onAuthStateChange((event, profile) => {
      if (profile) {
        setUser(profile);
        setRole(profile.role);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    return await signIn(email, password);
  };

  const logout = async () => {
    await signOut();
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
