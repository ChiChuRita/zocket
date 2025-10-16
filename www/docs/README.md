# Zocket Documentation

This is the official documentation for Zocket - an end-to-end type-safe WebSocket library for TypeScript.

## Documentation Structure

The documentation is organized into the following sections:

### 1. Getting Started

- **Introduction**: Overview of Zocket and its features
- **Motivation**: Why Zocket exists and comparison with raw WebSockets
- **Installation**: How to install Zocket in your project
- **Quick Start**: Build your first Zocket application

### 2. Core Concepts

- **Overview**: Architecture and key concepts
- **Routers**: Define your WebSocket API structure
- **Messages**: Incoming and outgoing message types
- **Handlers**: Process incoming messages
- **Context**: Access user data and utilities
- **Middleware**: Reusable logic and authentication
- **Rooms**: Group clients and broadcast messages

### 3. Server API

- **Creating Instance**: Set up your Zocket server
- **Router Definition**: Define routes and handlers
- **Adapters**: Use with Bun, Node.js, and other runtimes
- **Lifecycle**: Connection and disconnection hooks
- **Sending Messages**: Send messages to clients

### 4. Client API

- **Creating Client**: Set up the WebSocket client
- **Sending Messages**: Send messages to the server
- **Receiving Messages**: Listen for server messages
- **Connection Management**: Handle connection state
- **Headers**: Pass authentication headers

### 5. React Integration

- **Overview**: Using Zocket with React
- **Provider**: Set up ZocketProvider
- **useZocket**: Access the client in components
- **useEvent**: Type-safe event listeners

### 6. Examples

- **Ping-Pong**: Simple request-response example
- **Chat Rooms**: Multi-room chat application
- **Private Messaging**: Direct client-to-client messaging
- **Notifications**: Flexible notification system
- **Game**: Real-time multiplayer Pong game

### 7. Advanced Topics

- **Authentication**: Implement secure authentication
- **Validation**: Advanced validation with Zod and Valibot
- **Error Handling**: Best practices for error handling
- **Type Safety**: Deep dive into the type system
- **Best Practices**: Production-ready patterns

### 8. API Reference

- **zocket.create**: Server instance creation
- **Message Builder**: Build messages with validation
- **Router Types**: TypeScript type definitions
- **Client Types**: Client API types
- **React Types**: React hooks types

## Running the Documentation

```bash
cd www/docs
bun install
bun run dev
```

The documentation will be available at `http://localhost:3000`.

## Building the Documentation

```bash
bun run build
```

## Features

- **Type-Safe**: Full TypeScript support with autocomplete
- **Searchable**: Built-in search functionality
- **Dark Mode**: Toggle between light and dark themes
- **Mobile Responsive**: Works on all devices
- **Code Examples**: Real-world examples throughout

## Contributing

To contribute to the documentation:

1. Edit files in the `content/` directory
2. Use markdown format with frontmatter
3. Follow the existing structure and style
4. Test locally before submitting

## Documentation Framework

Built with:

- [Nuxt Content](https://content.nuxtjs.org/)
- [shadcn-docs-nuxt](https://shadcn-docs-nuxt.vercel.app/)
- [Vue 3](https://vuejs.org/)
- [Tailwind CSS](https://tailwindcss.com/)

## Support

For issues or questions about Zocket itself, please visit:

- GitHub: https://github.com/yourusername/zocket
- Documentation: https://zocket-docs.vercel.app
