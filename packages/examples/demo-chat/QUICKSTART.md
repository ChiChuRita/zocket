# Quick Start Guide

Get the Zocket Chat Demo up and running in just 3 steps!

## 1. Install Dependencies

```bash
bun install
```

## 2. Start the Application

### Quick Start (One Command)

```bash
bun run dev:all
```

This starts both the server and client in one terminal! You should see:

- `[server]` 🚀 Chat server running on ws://localhost:3001
- `[client]` Application running at http://localhost:5173

### Alternative: Separate Terminals

If you prefer to run them separately:

**Terminal 1 - Server:**

```bash
bun run dev:server
```

**Terminal 2 - Client:**

```bash
bun run dev
```

## 3. Test It Out

1. Open the URL in your browser
2. Enter a username (e.g., "Alice")
3. Click "Join Chat"
4. Open another browser tab/window
5. Join with a different username (e.g., "Bob")
6. Start chatting in real-time!

## Features to Try

### Chat Rooms

- Click on "general", "random", or "tech" to join a room
- Click the "+" button to create your own room
- Send messages and see them appear instantly

### Direct Messages

- Look at the "Online Users" panel on the right
- Click on any user to start a private conversation
- Send DMs that only that user can see

### Typing Indicators

- Start typing a message
- See "... is typing" appear for other users
- Works in both rooms and DMs

### Multiple Rooms

- Join multiple rooms by clicking them
- Unread badges show new messages
- Switch between conversations seamlessly

## Troubleshooting

**Server won't start:**

- Make sure port 3001 is available
- Check that you have Bun installed: `bun --version`

**Client won't connect:**

- Ensure the server is running first
- Check the console for WebSocket connection errors
- Verify the URL in `App.tsx` matches your server port

**TypeScript errors:**

- Run `bun run build` to check for compilation errors
- Make sure all dependencies are installed

## Next Steps

- Read the [README.md](./README.md) for detailed documentation
- Explore the code in `src/components/` to understand the architecture
- Check out `server.ts` to see how Zocket handles real-time messaging
- Modify and extend the app with your own features!

## Tips

- Use **Enter** to send messages, **Shift+Enter** for new lines
- Usernames are unique per connection (simple demo authentication)
- Messages are stored in memory (lost on server restart)
- Open the browser console to see debug logs from Zocket

Happy chatting! 🚀
