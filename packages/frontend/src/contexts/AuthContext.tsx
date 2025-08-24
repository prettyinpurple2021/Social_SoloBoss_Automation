import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types/user';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored auth data on mount
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Failed to parse stored user data:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      }
    }

    setIsLoading(false);
  }, []);

  const login = async (email: string, _password: string): Promise<boolean> => {
    try {
      // Mock login for now - replace with actual API call
      const mockUser: User = {
        id: '1',
        email,
        name: 'Demo User',
        createdAt: new Date(),
        updatedAt: new Date(),
        settings: {
          timezone: 'UTC',
          defaultHashtags: [],
          autoApproveFromSoloBoss: false,
          bloggerIntegrationEnabled: false,
          platformPreferences: {
            facebook: {
              defaultHashtags: [],
              contentFormat: 'full',
              includeLink: true,
              autoPost: false
            },
            instagram: {
              defaultHashtags: [],
              imageRequired: true,
              maxHashtags: 30,
              autoPost: false
            },
            pinterest: {
              defaultBoard: '',
              defaultHashtags: [],
              imageRequired: true,
              autoPost: false
            },
            x: {
              defaultHashtags: [],
              shortenLinks: true,
              threadLongContent: true,
              autoPost: false
            }
          },
          notificationSettings: {
            emailNotifications: true,
            failedPostNotifications: true,
            integrationIssueNotifications: true,
            weeklyReports: true
          }
        }
      };

      const mockToken = 'mock-jwt-token';

      setUser(mockUser);
      setToken(mockToken);

      localStorage.setItem('authToken', mockToken);
      localStorage.setItem('user', JSON.stringify(mockUser));

      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  };

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    login,
    logout,
    updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};