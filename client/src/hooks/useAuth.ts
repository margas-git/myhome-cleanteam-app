import { useState, useEffect } from "react";
import { buildApiUrl } from "../config/api";

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch(buildApiUrl("/api/auth/me"), {
        credentials: "include"
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch(buildApiUrl("/api/auth/logout"), {
        method: "POST",
        credentials: "include"
      });
      setUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return { user, loading, logout, checkAuth };
} 