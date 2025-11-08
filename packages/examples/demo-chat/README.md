# Zocket Chat Demo

A fully-featured real-time chat application built with Zocket, React, TypeScript, and shadcn/ui. This demo showcases all the powerful features of Zocket including rooms, direct messaging, typing indicators, online presence, and more.

## Features

### Core Chat Features

- **Multiple Chat Rooms**: Join or create chat rooms with real-time messaging
- **Direct Messages (DMs)**: Send private messages to any online user
- **Message History**: Automatically loads the last 50 messages when joining a room or conversation
- **Real-time Updates**: Instant message delivery using WebSocket connections

### Rich UI Features

- **Typing Indicators**: See when someone is typing in rooms or DMs
- **Online Presence**: Track user status (online/away) with visual indicators
- **Unread Badges**: Never miss a message with unread count indicators
- **User Avatars**: Auto-generated avatars with initials and colors
- **Responsive Design**: Beautiful UI built with Tailwind CSS and shadcn/ui
- **Auto-scroll**: Messages automatically scroll to the bottom
- **Connection Status**: Visual indicator when connecting to the server

### Technical Features

- **Type-safe**: Full TypeScript with end-to-end type safety
- **Username-based**: Simple username authentication (no passwords for demo)
- **Room Management**: Create rooms on-the-fly
- **Message Timestamps**: All messages include timestamps
- **Clean Architecture**: Separation of concerns with reusable components

## Getting Started

### Prerequisites

- Bun installed on your system
- Node.js 18+ (for compatibility)

### Installation

1. Install dependencies:

```bash
bun install
```

### Running the Application

#### Option 1: Run Everything at Once (Recommended)

```bash
bun run dev:all
```

This starts both the server and client concurrently in a single terminal. The server will run on `ws://localhost:3001` and the client on `http://localhost:5173`.

#### Option 2: Run Separately

If you prefer separate terminals:

1. **Start the server** (in one terminal):

```bash
bun run dev:server
```

The server will start on `ws://localhost:3001`

2. **Start the client** (in another terminal):

```bash
bun run dev
```

The client will start on `http://localhost:5173` (or the next available port)

3. **Open multiple browser tabs** to test the real-time features with multiple users

## Usage Guide

### Joining the Chat

1. Enter your desired username
2. Click "Join Chat"
3. You'll automatically see the default rooms (general, random, tech)

### Using Rooms

- Click any room in the sidebar to join it
- Click the "+" button next to "Rooms" to create a new room
- Send messages using the text area at the bottom
- See who's typing in real-time

### Direct Messages

- Click on any user in the "Online Users" panel (right side)
- Start a private conversation
- Your DM conversations will appear in the sidebar under "Direct Messages"

### Typing Indicators

- Start typing in any chat to let others know you're composing a message
- See when others are typing in the same room or DM

### Keyboard Shortcuts

- **Enter**: Send message
- **Shift + Enter**: New line in message
- **Escape**: Cancel room creation

## Architecture

### Server (`server.ts`)

The server is built using Zocket and includes:

- User management (username → clientId mapping)
- Room management (create, join, leave)
- Direct messaging routing
- Typing indicator tracking with auto-timeout
- Online presence tracking
- Message history storage (in-memory, last 100 messages per room/DM)

### Client (`src/`)

The client is a React application with:

- **Components**: Modular, reusable UI components
  - `ChatLayout`: Main layout coordinator
  - `Sidebar`: Room and DM list
  - `ChatView`: Message display and input
  - `UserList`: Online users panel
  - `Message`: Individual message bubble
  - `MessageInput`: Text input with typing indicators
- **Hooks**: `useZocket` for WebSocket communication
- **Types**: Shared type definitions for type safety
- **Utils**: Helper functions for avatars and styling

### Key Technologies

- **Zocket**: Real-time WebSocket framework with type-safe messaging
- **React 19**: Latest React with hooks
- **TypeScript**: Full type safety
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: High-quality React components
- **Vite**: Fast build tool and dev server
- **Zod**: Schema validation

## Code Structure

```
demo-chat/
├── server.ts              # Zocket server with all message handlers
├── shared.ts              # Shared types between client and server
├── src/
│   ├── App.tsx           # Main app with authentication
│   ├── components/
│   │   ├── ChatLayout.tsx    # Main layout with state management
│   │   ├── Sidebar.tsx       # Room and DM list
│   │   ├── ChatView.tsx      # Message display area
│   │   ├── UserList.tsx      # Online users panel
│   │   ├── Message.tsx       # Message bubble component
│   │   ├── MessageInput.tsx  # Text input with typing
│   │   └── ui/              # shadcn/ui components
│   ├── lib/
│   │   ├── utils.ts         # Utility functions
│   │   └── types.ts         # Type definitions
│   └── index.css           # Global styles and Tailwind
├── tailwind.config.js     # Tailwind configuration
├── components.json        # shadcn/ui configuration
└── package.json          # Dependencies and scripts
```

## Development

### Building for Production

```bash
bun run build
```

### Linting

```bash
bun run lint
```

### Preview Production Build

```bash
bun run preview
```

## Customization

### Adding More Default Rooms

Edit the `DEFAULT_ROOMS` array in `server.ts`:

```typescript
const DEFAULT_ROOMS = ["general", "random", "tech", "your-room"];
```

### Changing the Server Port

Edit the port in `server.ts` and update the WebSocket URL in `App.tsx`:

```typescript
// server.ts
port: 3001;

// App.tsx
url: "ws://localhost:3001";
```

### Customizing Avatar Colors

Edit the `COLORS` array in `src/lib/utils.ts`:

```typescript
const COLORS = [
  "bg-red-500",
  "bg-blue-500",
  // Add your colors
];
```

## Features Demonstrated

This demo showcases the following Zocket capabilities:

1. **Router Definition**: Type-safe message routing with incoming/outgoing messages
2. **Rooms API**: Join, leave, and broadcast to rooms
3. **Direct Messaging**: Client-to-client messaging via username lookup
4. **Context Management**: User authentication and session management
5. **Real-time Events**: Live updates for typing, presence, and messages
6. **React Integration**: Seamless integration with `@zocket/react`
7. **Type Safety**: End-to-end TypeScript support from server to client

## Learn More

- [Zocket Documentation](../../www/docs)
- [Zocket Core Package](../../core)
- [Zocket React Package](../../react)

## License

MIT
