"use client";
import { useEffect } from "react";
import { createAuth0Client } from "@auth0/auth0-spa-js";
import { api, config, setSession as setApiSession } from "@/lib/api-client";
import { useAuthStore } from "@/store/authStore";

const ONBOARDING_TIMEOUT_MS = 12_000;
function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ONBOARDING_TIMEOUT_MS))]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let active = true;
    const start = async () => {
      const settings = config(), redirectUri = location.origin, store = useAuthStore.getState();
      if (!settings.auth0Domain || !settings.auth0ClientId) {
        store.setError("Sign-in is not configured for this deployment."); store.setReady(true); return;
      }
      const client = await createAuth0Client({ domain: settings.auth0Domain, clientId: settings.auth0ClientId, authorizationParams: { audience: settings.auth0Audience, redirect_uri: redirectUri } });
      const login = () => client.loginWithRedirect({ authorizationParams: { audience: settings.auth0Audience, redirect_uri: redirectUri } });
      const signup = () => client.loginWithRedirect({ authorizationParams: { audience: settings.auth0Audience, redirect_uri: redirectUri, screen_hint: "signup" } });
      const logout = async () => { useAuthStore.getState().clear(); setApiSession(() => "", () => ""); await client.logout({ logoutParams: { returnTo: location.origin } }); };
      store.setActions(login, signup, logout);
      const hasCallback = location.search.includes("code=") && location.search.includes("state=");
      if (hasCallback) await client.handleRedirectCallback();
      if (!(await client.isAuthenticated())) { if (active) useAuthStore.getState().setReady(true); return; }
      const token = await client.getTokenSilently();
      let organizationId = localStorage.getItem("datalyst.organizationId") || "";
      setApiSession(() => token, () => organizationId);
      if (!organizationId) {
        const workspace = await withTimeout(api<{ organization: { id: string } }>("/api/onboarding", { method: "POST", body: "{}" }), "The workspace service took too long to respond.");
        organizationId = workspace.organization.id; localStorage.setItem("datalyst.organizationId", organizationId);
        setApiSession(() => token, () => organizationId);
      }
      if (!active) return;
      useAuthStore.getState().setSession(token, organizationId);
      useAuthStore.getState().setReady(true);
      if (hasCallback) location.assign("/dashboard");
    };
    start().catch((error) => {
      if (!active) return;
      useAuthStore.getState().setError(error instanceof Error ? "We could not finish setting up your workspace: " + error.message : "We could not finish setting up your workspace.");
      useAuthStore.getState().setReady(true);
    });
    return () => { active = false; };
  }, []);
  return <>{children}</>;
}
