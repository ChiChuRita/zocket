import { createClient } from "@zocket/client";
import type { registry } from "../../actors";

// ---------------------------------------------------------------------------
// Connect to the gateway
// ---------------------------------------------------------------------------

const client = createClient<typeof registry>({
  url: "ws://localhost:3001",
  reconnect: true,
});

// ---------------------------------------------------------------------------
// UI elements
// ---------------------------------------------------------------------------

const statusEl = document.getElementById("status")!;
const countEl = document.getElementById("count")!;
const infoEl = document.getElementById("info")!;
const incBtn = document.getElementById("inc")!;
const decBtn = document.getElementById("dec")!;
const resetBtn = document.getElementById("reset")!;

// ---------------------------------------------------------------------------
// Connection status
// ---------------------------------------------------------------------------

client.on("status", (s) => {
  statusEl.textContent = s;
  statusEl.className = s === "connected" ? "connected" : "disconnected";
});

// ---------------------------------------------------------------------------
// Actor handle — derive counter ID from the URL path
// e.g. /foo → counter "foo", / → counter "main"
// ---------------------------------------------------------------------------

const slug = location.pathname.replace(/^\/+|\/+$/g, "") || "main";
document.title = `Counter: ${slug}`;
document.getElementById("slug")!.textContent = `/${slug}`;

const counter = client.counter(slug);

// Subscribe to state — get snapshot + live patches
counter.state.subscribe((state) => {
  countEl.textContent = String(state.count);
  infoEl.textContent = state.lastUpdatedBy
    ? `last updated by ${state.lastUpdatedBy.slice(0, 8)}...`
    : "";
});

// ---------------------------------------------------------------------------
// Button handlers
// ---------------------------------------------------------------------------

incBtn.addEventListener("click", () => counter.increment());
decBtn.addEventListener("click", () => counter.decrement());
resetBtn.addEventListener("click", () => counter.set({ value: 0 }));
