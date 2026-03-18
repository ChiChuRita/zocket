import { CodeBlock } from "./code-block";

const code = `// Subscribe to full actor state
const room = client.chat("general");
room.state.subscribe((state) => {
  console.log(state.messages);
});

// React: selector-based subscriptions
const messages = useActorState(room, (s) => s.messages);
const online = useActorState(room, (s) => s.online);

// Multiple actor instances — each with independent state
const lobby = client.game("lobby");
const room1 = client.game("room-1");
const room2 = client.game("room-2");

// Clean up when done
room.$dispose();`;

export function StateExample() {
  return <CodeBlock title="state.ts" code={code} />;
}
