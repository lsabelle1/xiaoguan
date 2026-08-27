import { useCallback, useEffect, useState } from "react";
import type { Role, SiteConfig } from "../shared/types";
import { api, clearSession, getRole, getToken, setSession } from "./api";
import { ChefPage } from "./pages/ChefPage";
import { EnterPage } from "./pages/EnterPage";
import { GuestPage } from "./pages/GuestPage";

export default function App() {
  const [token, setToken] = useState<string | null>(() => getToken());
  const [role, setRole] = useState<Role | null>(() => getRole());
  const [config, setConfig] = useState<SiteConfig | null>(null);

  useEffect(() => {
    void api.info().then(setConfig).catch(() => {});
  }, []);

  useEffect(() => {
    document.title = config?.name ?? "两个人的小馆";
  }, [config]);

  const leave = useCallback(() => {
    clearSession();
    setToken(null);
    setRole(null);
    setConfig(null);
  }, []);

  const switchRole = useCallback(() => {
    if (!token || !role) return;
    const next = role === "guest" ? "chef" : "guest";
    setSession(token, next);
    setRole(next);
  }, [role, token]);

  if (!token || !role) {
    return (
      <EnterPage
        onEnter={(nextToken, nextRole, nextConfig) => {
          setSession(nextToken, nextRole);
          setToken(nextToken);
          setRole(nextRole);
          setConfig(nextConfig);
        }}
      />
    );
  }

  if (role === "chef") {
    return (
      <ChefPage
        config={config}
        onSwitchRole={switchRole}
        onLeave={leave}
        onUnauthorized={leave}
      />
    );
  }

  return (
    <GuestPage
      config={config}
      onSwitchRole={switchRole}
      onLeave={leave}
      onUnauthorized={leave}
    />
  );
}
