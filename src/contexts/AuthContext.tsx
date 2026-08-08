import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";

type MembershipRole = "admin" | "customer";
export type AuthLandingRoute = "/admin" | "/app";

interface Membership {
  id: string;
  user_id: string;
  tenant_id: string;
  role: MembershipRole;
}

interface AuthorizationSnapshot {
  membership: Membership | null;
  isAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  membership: Membership | null;
  isAdmin: boolean;
  isLoading: boolean;
  backendConfigured: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: Error | null; destination: AuthLandingRoute | null }>;
  signOut: () => Promise<void>;
  refreshMembership: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function getAuthLandingRoute(isAdmin: boolean): AuthLandingRoute {
  return isAdmin ? "/admin" : "/app";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  const clearAuthorization = () => {
    setMembership(null);
    setIsAdmin(false);
  };

  const applyAuthorization = (snapshot: AuthorizationSnapshot) => {
    setMembership(snapshot.membership);
    setIsAdmin(snapshot.isAdmin);
  };

  const loadAuthorization = async (userId: string): Promise<AuthorizationSnapshot> => {
    if (!isSupabaseConfigured) return { membership: null, isAdmin: false };

    try {
      const [membershipResult, platformAdminResult] = await Promise.all([
        supabase
          .from("memberships")
          .select("id,user_id,tenant_id,role")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase.rpc("is_platform_admin", {
          _user_id: userId,
        }),
      ]);

      const nextMembership = membershipResult.error
        ? null
        : ((membershipResult.data as Membership | null) ?? null);
      const nextIsAdmin = !platformAdminResult.error && platformAdminResult.data === true;

      if (membershipResult.error) console.error("Unable to load tenant membership");
      if (platformAdminResult.error) console.error("Unable to verify platform administrator role");

      return { membership: nextMembership, isAdmin: nextIsAdmin };
    } catch {
      return { membership: null, isAdmin: false };
    }
  };

  const fetchUserData = async (userId: string) => {
    const snapshot = await loadAuthorization(userId);
    applyAuthorization(snapshot);
    return snapshot;
  };

  const refreshMembership = async () => {
    if (isSupabaseConfigured && user) await fetchUserData(user.id);
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSession(null);
      setUser(null);
      clearAuthorization();
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const hydrateSession = async (nextSession: Session | null) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        const snapshot = await loadAuthorization(nextSession.user.id);
        if (mounted) applyAuthorization(snapshot);
      } else if (mounted) {
        clearAuthorization();
      }

      if (mounted) setIsLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setIsLoading(true);
      window.setTimeout(() => {
        void hydrateSession(nextSession);
      }, 0);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Unable to restore authentication session");
        void hydrateSession(null);
        return;
      }
      void hydrateSession(data.session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return {
        error: new Error("Accesso non disponibile: il backend della preview non è configurato."),
        destination: null,
      };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return {
        error: error ?? new Error("Accesso non riuscito"),
        destination: null,
      };
    }

    const snapshot = await fetchUserData(data.user.id);
    setUser(data.user);
    setSession(data.session);

    return {
      error: null,
      destination: getAuthLandingRoute(snapshot.isAdmin),
    };
  };

  const signOut = async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    clearAuthorization();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        membership,
        isAdmin,
        isLoading,
        backendConfigured: isSupabaseConfigured,
        signIn,
        signOut,
        refreshMembership,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
