import { useEffect, useState } from "react";
import type { Role, SiteConfig } from "../../shared/types";
import { api } from "../api";

type Props = {
  onEnter: (token: string, role: Role, config: SiteConfig) => void;
};

export function EnterPage({ onEnter }: Props) {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Role | null>(null);

  useEffect(() => {
    void api.info().then(setConfig).catch(() => {
      setConfig({
        name: "两个人的小馆",
        welcome: "隔着屏幕也能坐同一张桌子。今天想吃点什么？",
        tagline: "只招待两个人的座位",
      });
    });
  }, []);

  async function enter(role: Role) {
    setError("");
    setPending(role);
    try {
      const result = await api.login(code);
      onEnter(result.token, role, result.config);
    } catch (err) {
      setError(err instanceof Error ? err.message : "进不去");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="app-shell">
      <main className="enter">
        <div className="stamp" aria-hidden>
          館
        </div>
        <h1>{config?.name ?? "两个人的小馆"}</h1>
        <p className="tagline">{config?.tagline ?? "只招待两个人的座位"}</p>
        <p className="welcome">{config?.welcome}</p>
        <form
          className="enter-form"
          onSubmit={(event) => {
            event.preventDefault();
            void enter("guest");
          }}
        >
          <label htmlFor="code">进店口令</label>
          <input
            id="code"
            type="password"
            autoComplete="off"
            placeholder="你们才知道的那句话"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <div className="roles">
            <button
              type="button"
              className="role-btn"
              disabled={Boolean(pending)}
              onClick={() => void enter("guest")}
            >
              <strong>我来点菜</strong>
              <span>客人席</span>
            </button>
            <button
              type="button"
              className="role-btn"
              disabled={Boolean(pending)}
              onClick={() => void enter("chef")}
            >
              <strong>我来做菜</strong>
              <span>后厨</span>
            </button>
          </div>
          {error ? <p className="error">{error}</p> : null}
          <p className="hint">本地默认口令是 xiaoguan，之后可改成只属于你们的词。</p>
        </form>
      </main>
    </div>
  );
}
