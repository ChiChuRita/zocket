import { useState } from "react";
import { ZocketProvider } from "@zocket/react";
import type { ChatRouter } from "../shared";
import { ChatLayout } from "./components/ChatLayout";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { MessageSquare } from "lucide-react";

function App() {
  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  if (!joined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 bg-primary rounded-full flex items-center justify-center">
                <MessageSquare className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="text-2xl">Welcome to Zocket Chat</CardTitle>
            <CardDescription>
              A real-time chat application powered by Zocket
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium">
                  Choose a username
                </label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter" && username.trim()) {
                      setJoined(true);
                    }
                  }}
                  placeholder="Enter your username..."
                  autoFocus
                />
              </div>
              <Button
                onClick={() => username.trim() && setJoined(true)}
                disabled={!username.trim()}
                className="w-full"
                size="lg"
              >
                Join Chat
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ZocketProvider<ChatRouter>
      url="ws://localhost:3001"
      headers={{ username }}
      debug={true}
      onOpen={() => {
        console.log("Connected to server");
        setIsConnected(true);
      }}
      onClose={() => {
        console.log("Disconnected from server");
        setIsConnected(false);
      }}
    >
      <div className="relative">
        {!isConnected && (
          <div className="absolute top-0 left-0 right-0 bg-yellow-500 text-white text-center py-2 text-sm z-50">
            Connecting to server...
          </div>
        )}
        <ChatLayout username={username} />
      </div>
    </ZocketProvider>
  );
}

export default App;
