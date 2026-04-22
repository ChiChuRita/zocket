// Shared feature data for the four feature-section design variants.
// All variants render the same content; only layout differs.

export type FeatureIcon =
  | "memory"
  | "stream"
  | "websocket"
  | "workflow"
  | "durable"
  | "scale";

export type Feature = {
  title: string;
  blurb: string;
  icon: FeatureIcon;
};

export const features: Feature[] = [
  {
    title: "State next to compute",
    blurb:
      "State lives in memory where your code runs. Reads and writes take microseconds, not network round-trips.",
    icon: "memory",
  },
  {
    title: "Live state on the client",
    blurb:
      "Clients always see the latest state. Skip the fetch-cache-revalidate dance entirely.",
    icon: "stream",
  },
  {
    title: "WebSockets out of the box",
    blurb:
      "Push-based and bidirectional. The right transport for anything that actually changes.",
    icon: "websocket",
  },
  {
    title: "Workflows, queues, scheduling",
    blurb:
      "Long-running jobs, durable queues, and timers. One runtime instead of three services.",
    icon: "workflow",
  },
  {
    title: "No lost requests",
    blurb:
      "Calls survive disconnects. Clients reconnect and the answer is waiting for them.",
    icon: "durable",
  },
  {
    title: "Scales to zero, scales to anything",
    blurb:
      "Idle actors cost nothing. Traffic spikes get absorbed. No capacity planning, no idle servers.",
    icon: "scale",
  },
];
