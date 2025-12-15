"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/app/utils/supabase";

interface UserMetadata {
  [key: string]: any;
}

interface UserContextType {
  userMetadata: UserMetadata | null;
  loading: boolean;
  error: string | null;
  fetchUserMetadata: () => Promise<void>;
  clearUserMetadata: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

/**
 * Hook to access user metadata (raw_user_meta_data from auth.users table)
 * 
 * Usage:
 * ```tsx
 * const { userMetadata, loading, error, fetchUserMetadata, clearUserMetadata } = useUserMetadata();
 * 
 * // Access metadata properties
 * const consultantType = userMetadata?.consultant_type;
 * const entityType = userMetadata?.entity_type;
 * ```
 */
export const useUserMetadata = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUserMetadata must be used within a UserProvider");
  }
  return context;
};

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [userMetadata, setUserMetadata] = useState<UserMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user metadata from localStorage on mount, or from Supabase auth session
  useEffect(() => {
    const loadMetadata = async () => {
      // First, try localStorage
      const storedMetadata = localStorage.getItem("userMetadata");
      if (storedMetadata) {
        try {
          const parsed = JSON.parse(storedMetadata);
          if (parsed && Object.keys(parsed).length > 0) {
            setUserMetadata(parsed);
            return;
          }
          localStorage.removeItem("userMetadata");
        } catch (err) {
          localStorage.removeItem("userMetadata");
        }
      }
      
      // If not in localStorage, try to get from Supabase auth session
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.user_metadata && Object.keys(user.user_metadata).length > 0) {
          setUserMetadata(user.user_metadata);
          localStorage.setItem("userMetadata", JSON.stringify(user.user_metadata));
        }
      } catch (err) {
        // Silently fail - metadata will be fetched when needed
      }
    };
    
    loadMetadata();
  }, []);

  const fetchUserMetadata = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get current user session
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError("No authenticated user found");
        setLoading(false);
        return;
      }

      // Get metadata from Supabase auth user_metadata (primary source)
      if (user.user_metadata && typeof user.user_metadata === 'object' && Object.keys(user.user_metadata).length > 0) {
        setUserMetadata(user.user_metadata);
        localStorage.setItem("userMetadata", JSON.stringify(user.user_metadata));
        setLoading(false);
        return;
      }

      // Fallback: Try to get from session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.user_metadata && Object.keys(session.user.user_metadata).length > 0) {
        setUserMetadata(session.user.user_metadata);
        localStorage.setItem("userMetadata", JSON.stringify(session.user.user_metadata));
        setLoading(false);
        return;
      }

      setError("No metadata found for user");
    } catch (err: any) {
      setError(err.message || "Failed to fetch user metadata");
    } finally {
      setLoading(false);
    }
  };

  const clearUserMetadata = () => {
    setUserMetadata(null);
    setError(null);
    localStorage.removeItem("userMetadata");
  };

  return (
    <UserContext.Provider
      value={{
        userMetadata,
        loading,
        error,
        fetchUserMetadata,
        clearUserMetadata,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

