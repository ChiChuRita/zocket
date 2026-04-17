import { startTransition, useMemo, useState } from "react";
import type { EventPayload } from "@zocket/core";
import type { app } from "../../actors";
import { client, wsUrl, zocket } from "./zocket";

type CounterActor = (typeof app)["actors"]["counter"];
type CounterChanged = EventPayload<CounterActor, "changed">;
type CounterPresence = EventPayload<CounterActor, "presence">;

type FeedItem = {
  id: string;
  tone: "default" | "presence";
  text: string;
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatConnectionId(connectionId: string | null) {
  return connectionId ? `${connectionId.slice(0, 12)}...` : "nobody yet";
}

function formatTimestamp(timestamp: number | null | undefined) {
  return timestamp
    ? new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "waiting for first update";
}

function resolveCounterId() {
  return window.location.pathname.replace(/^\/+|\/+$/g, "") || "main";
}

export default function App() {
  return (
    <zocket.ZocketProvider client={client}>
      <CounterScreen />
    </zocket.ZocketProvider>
  );
}

function CounterScreen() {
  const counterId = useMemo(resolveCounterId, []);

  return (
    <div className="page-shell">
      <Header counterId={counterId} />
      <main className="dashboard">
        <CounterCard counterId={counterId} />
        <EventFeed counterId={counterId} />
      </main>
    </div>
  );
}

function Header({ counterId }: { counterId: string }) {
  const status = zocket.useConnectionStatus();

  return (
    <header className="panel hero">
      <div className="hero-row">
        <span className={`status-pill ${status}`}>{status}</span>
        <span className="mono-label">actor id /{counterId}</span>
      </div>
      <h1>Counter, but actually Zocket.</h1>
      <p className="hero-copy">
        This version uses the React integration instead of manual subscriptions: one shared actor, typed hooks,
        selector-based state reads, lifecycle-managed events, and automatic handle cleanup.
      </p>
      <div className="hero-grid">
        <MetricCard label="Transport" value={wsUrl.replace(/^wss?:\/\//, "")} />
        <MetricCard label="Actor" value='useActor("counter", id)' />
        <MetricCard label="State" value="useActorState(...)" />
        <MetricCard label="Events" value='useEvent(..., "changed")' />
      </div>
    </header>
  );
}

function CounterCard({ counterId }: { counterId: string }) {
  const counter = zocket.useActor("counter", counterId);
  const count = zocket.useActorState(counter, (state) => state.count) ?? 0;
  const viewers = zocket.useActorState(counter, (state) => state.viewers) ?? 0;
  const lastUpdatedBy = zocket.useActorState(counter, (state) => state.lastUpdatedBy) ?? null;
  const updatedAt = zocket.useActorState(counter, (state) => state.updatedAt) ?? null;
  const [draft, setDraft] = useState("42");
  const [lastRpc, setLastRpc] = useState("Waiting for a method call.");

  async function run(label: string, action: () => Promise<number>) {
    try {
      const result = await action();
      setLastRpc(`${label} -> ${result}`);
    } catch (error) {
      setLastRpc(`${label} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function setCount() {
    const value = Number(draft);
    if (Number.isNaN(value)) {
      setLastRpc("set failed: enter a valid number");
      return;
    }
    await run(`set(${value})`, () => counter.set({ value }));
  }

  return (
    <section className="panel counter-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Shared Actor State</p>
          <h2>Multiple components, one live counter handle.</h2>
        </div>
        <div className="presence-chip">{viewers} live viewer{viewers === 1 ? "" : "s"}</div>
      </div>

      <div className="count-readout">{count}</div>

      <div className="button-row">
        <button onClick={() => void run("increment", () => counter.increment())}>Increase</button>
        <button onClick={() => void run("decrement", () => counter.decrement())}>Decrease</button>
        <button onClick={() => void run("reset", () => counter.reset())}>Reset</button>
      </div>

      <div className="input-row">
        <label className="input-label" htmlFor="counter-set-value">
          Typed method input
        </label>
        <div className="inline-form">
          <input
            id="counter-set-value"
            inputMode="numeric"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="0"
          />
          <button className="secondary" onClick={() => void setCount()}>
            Jump to value
          </button>
        </div>
      </div>

      <dl className="detail-grid">
        <Detail label="Last RPC" value={lastRpc} />
        <Detail label="Last writer" value={formatConnectionId(lastUpdatedBy)} />
        <Detail label="Updated at" value={formatTimestamp(updatedAt)} />
        <Detail label="Handle meta" value={`${counter.meta.name}:${counter.meta.id}`} />
      </dl>
    </section>
  );
}

function EventFeed({ counterId }: { counterId: string }) {
  const counter = zocket.useActor("counter", counterId);
  const [items, setItems] = useState<FeedItem[]>([]);

  function pushItem(item: FeedItem) {
    startTransition(() => {
      setItems((current) => [item, ...current].slice(0, 8));
    });
  }

  zocket.useEvent(counter, "changed", (event: CounterChanged) => {
    const delta = event.delta >= 0 ? `+${event.delta}` : `${event.delta}`;
    pushItem({
      id: createId(),
      tone: "default",
      text: `${event.action} -> ${event.count} (${delta}) by ${formatConnectionId(event.changedBy)}`,
    });
  });

  zocket.useEvent(counter, "presence", (event: CounterPresence) => {
    pushItem({
      id: createId(),
      tone: "presence",
      text: `presence -> ${event.viewers} viewer${event.viewers === 1 ? "" : "s"}`,
    });
  });

  return (
    <section className="panel feed-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Lifecycle Managed Events</p>
          <h2>Event feed powered by useEvent.</h2>
        </div>
      </div>

      <p className="panel-copy">
        Open this page in two tabs. The feed below should update from actor events while the counter value updates from
        state snapshots and patches.
      </p>

      <ul className="feed-list">
        {items.length === 0 ? (
          <li className="feed-empty">Waiting for the first event. Increment, reset, or open another tab.</li>
        ) : (
          items.map((item) => (
            <li key={item.id} className={`feed-item ${item.tone}`}>
              {item.text}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-item">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
