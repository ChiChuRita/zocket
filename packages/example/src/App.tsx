import { useEffect, useMemo, useState } from "react";
import { createZocketClient, type ZocketClient } from "@zocket/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Activity,
  BadgeCheck,
  BrainCircuit,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
  Signal,
  Users,
  Zap,
} from "lucide-react";

import { zocket } from "@/lib/zocket";
import { cn } from "@/lib/utils";
import type { AppRouter } from "../server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const WS_URL = import.meta.env.VITE_ZOCKET_URL ?? "ws://localhost:3000";
const DEFAULT_ROOM = "lobby";

type Client = ZocketClient<AppRouter>;

type EventPayload<TSubscribe> = TSubscribe extends (
  callback: (payload: infer TPayload) => any
) => any
  ? TPayload
  : never;

type ToastPayload = EventPayload<Client["on"]["system"]["toast"]>;
type ChatMessage = EventPayload<Client["on"]["chat"]["message"]>;
type StatsTick = EventPayload<Client["on"]["stats"]["tick"]>;

type Role = ChatMessage["role"];

type Session = {
  name: string;
  role: Role;
};

type ActivityItem = ToastPayload & { at: string };

type SendMessageInput = Parameters<Client["chat"]["send"]>[0];
type SendMessageResult = Awaited<ReturnType<Client["chat"]["send"]>>;

type AnnounceInput = Parameters<Client["admin"]["announce"]>[0];
type AnnounceResult = Awaited<ReturnType<Client["admin"]["announce"]>>;

const initialSession: Session = {
  name: "Nova",
  role: "member",
};

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function App() {
  const [session, setSession] = useState(initialSession);

  const client = useMemo(
    () =>
      createZocketClient<AppRouter>(WS_URL, {
        headers: {
          user: session.name,
          role: session.role,
        },
      }),
    [session.name, session.role]
  );

  useEffect(() => {
    return () => client.close();
  }, [client]);

  return (
    <zocket.ZocketProvider client={client}>
      <MissionControl session={session} onSessionChange={setSession} />
    </zocket.ZocketProvider>
  );
}

function MissionControl({
  session,
  onSessionChange,
}: {
  session: Session;
  onSessionChange: (next: Session) => void;
}) {
  const client = zocket.useClient();
  const { status, readyState, lastError } = zocket.useConnectionState();

  const [activeRoom, setActiveRoom] = useState(DEFAULT_ROOM);
  const [draftName, setDraftName] = useState(session.name);
  const [draftRole, setDraftRole] = useState(session.role);
  const [roomDraft, setRoomDraft] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [adminDraft, setAdminDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [lastTick, setLastTick] = useState<StatsTick | null>(null);

  useEffect(() => {
    setDraftName(session.name);
    setDraftRole(session.role);
  }, [session]);

  const pushActivity = (item: ActivityItem) => {
    setActivity((prev) => [item, ...prev].slice(0, 10));
  };

  const statsQuery = useQuery({
    queryKey: ["stats", session.name, session.role],
    queryFn: () => client.stats.get({}),
    enabled: status === "open",
    refetchInterval: 15000,
  });

  const historyQuery = useQuery({
    queryKey: ["chat.history", activeRoom, session.name, session.role],
    queryFn: () =>
      client.chat.history({
        roomId: activeRoom,
        limit: 30,
      }),
    enabled: status === "open" && Boolean(activeRoom),
  });

  const sendMessage = useMutation<SendMessageResult, Error, SendMessageInput>({
    mutationFn: (payload) => client.chat.send(payload),
    onSuccess: () => setMessageDraft(""),
  });

  const announce = useMutation<AnnounceResult, Error, AnnounceInput>({
    mutationFn: (payload) => client.admin.announce(payload),
    onSuccess: () => setAdminDraft(""),
  });

  zocket.useEvent(client.on.system.toast, (payload) => {
    pushActivity({
      id: payload.id,
      title: payload.title,
      description: payload.description,
      tone: payload.tone,
      at: new Date().toISOString(),
    });
  });

  zocket.useEvent(client.on.presence.joined, (payload) => {
    pushActivity({
      id: createId(),
      title: `${payload.user} joined #${payload.roomId}`,
      description: payload.role === "admin" ? "Admin online" : "Member online",
      tone: "success",
      at: payload.at,
    });
  });

  zocket.useEvent(client.on.presence.left, (payload) => {
    pushActivity({
      id: createId(),
      title: `${payload.user} left #${payload.roomId}`,
      description: "Session closed",
      tone: "warning",
      at: payload.at,
    });
  });

  zocket.useEvent(client.on.chat.message, (payload) => {
    if (payload.roomId !== activeRoom) {
      pushActivity({
        id: createId(),
        title: `Message in #${payload.roomId}`,
        description: `${payload.user}: ${payload.text}`,
        tone: "info",
        at: payload.at,
      });
      return;
    }

    setMessages((prev) => {
      if (prev.some((msg) => msg.id === payload.id)) {
        return prev;
      }
      return [...prev, payload].slice(-40);
    });
  });

  zocket.useEvent(client.on.stats.tick, (payload) => {
    setLastTick(payload);
  });

  useEffect(() => {
    const offOpen = client.onOpen(() => {
      pushActivity({
        id: createId(),
        title: "Connection opened",
        description: "WebSocket handshake complete.",
        tone: "success",
        at: new Date().toISOString(),
      });
    });

    const offClose = client.onClose(() => {
      pushActivity({
        id: createId(),
        title: "Connection closed",
        description: "Client disconnected.",
        tone: "danger",
        at: new Date().toISOString(),
      });
    });

    const offError = client.onError((error) => {
      pushActivity({
        id: createId(),
        title: "Socket error",
        description: `${error}`,
        tone: "danger",
        at: new Date().toISOString(),
      });
    });

    return () => {
      offOpen();
      offClose();
      offError();
    };
  }, [client]);

  useEffect(() => {
    if (status !== "open" || !activeRoom) return;

    client.rooms.join({ roomId: activeRoom });

    return () => {
      client.rooms.leave({ roomId: activeRoom });
    };
  }, [client, status, activeRoom]);

  useEffect(() => {
    setMessages([]);
  }, [activeRoom]);

  useEffect(() => {
    if (historyQuery.data) {
      setMessages(historyQuery.data);
    }
  }, [historyQuery.data]);

  const rooms = (() => {
    const list = statsQuery.data?.rooms ?? [];
    if (activeRoom && !list.some((room) => room.roomId === activeRoom)) {
      return [
        ...list,
        { roomId: activeRoom, members: 1, online: [session.name] },
      ];
    }
    if (list.length === 0) {
      return [{ roomId: DEFAULT_ROOM, members: 0, online: [] }];
    }
    return list;
  })();
  const activeRoomInfo = rooms.find((room) => room.roomId === activeRoom);

  const statusTone =
    status === "open" ? "success" : status === "connecting" ? "warning" : "danger";

  return (
    <div className="relative min-h-screen overflow-hidden bg-grid">
      <div className="pointer-events-none absolute -left-20 top-20 h-64 w-64 animate-float rounded-full bg-[radial-gradient(circle,rgba(255,166,107,0.4),transparent_60%)]" />
      <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 animate-float rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.35),transparent_60%)]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-96 w-96 -translate-x-1/2 animate-float rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.25),transparent_65%)]" />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge variant="accent" className="w-fit">
              Zocket Mission Control
            </Badge>
            <h1 className="heading text-4xl font-semibold text-foreground sm:text-5xl">
              Real-time ops workspace
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
              A full-stack Bun + React demo using Zocket rooms, middleware,
              server push, and RPC-powered TanStack Query views.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={statusTone} className="capitalize">
              {status}
            </Badge>
            <Badge variant="muted">readyState {readyState}</Badge>
            <Badge variant="default">{session.role}</Badge>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card className="animate-rise" style={{ animationDelay: "0ms" }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Signal className="h-5 w-5 text-primary" />
                Connection
              </CardTitle>
              <CardDescription>WebSocket health and controls.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Endpoint: {WS_URL}</p>
                <p>
                  Error: {lastError ? String(lastError) : "None reported"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => client.reconnect()}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reconnect
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => client.close()}
                >
                  Disconnect
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-rise" style={{ animationDelay: "120ms" }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-primary" />
                Identity
              </CardTitle>
              <CardDescription>
                Zocket headers feed the server context.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Display name
                </label>
                <Input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder="Nova"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Role
                </label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={draftRole === "member" ? "secondary" : "outline"}
                    onClick={() => setDraftRole("member")}
                  >
                    Member
                  </Button>
                  <Button
                    size="sm"
                    variant={draftRole === "admin" ? "secondary" : "outline"}
                    onClick={() => setDraftRole("admin")}
                  >
                    Admin
                  </Button>
                </div>
              </div>
              <Button
                size="sm"
                className="w-full"
                onClick={() =>
                  onSessionChange({
                    name: draftName.trim() || "guest",
                    role: draftRole,
                  })
                }
                disabled={
                  draftName.trim() === session.name &&
                  draftRole === session.role
                }
              >
                Apply headers & reconnect
              </Button>
              <p className="text-xs text-muted-foreground">
                Updates the header schema, then reopens the socket with new
                context.
              </p>
            </CardContent>
          </Card>

          <Card className="animate-rise" style={{ animationDelay: "240ms" }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Server snapshot
              </CardTitle>
              <CardDescription>RPC: stats.get()</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Online</span>
                <span className="font-semibold text-foreground">
                  {statsQuery.data?.online ?? "--"}
                </span>
              </div>
              <div className="space-y-2">
                {(statsQuery.data?.rooms ?? []).map((room) => (
                  <div
                    key={room.roomId}
                    className={cn(
                      "flex items-center justify-between rounded-xl border border-border/60 bg-white/60 px-3 py-2 text-xs",
                      room.roomId === activeRoom && "border-primary/60"
                    )}
                  >
                    <span className="font-semibold">#{room.roomId}</span>
                    <span className="text-muted-foreground">
                      {room.members} online
                    </span>
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => statsQuery.refetch()}
              >
                Refresh snapshot
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <Card className="animate-rise" style={{ animationDelay: "320ms" }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Live workspace
              </CardTitle>
              <CardDescription>
                Rooms, chat, RPC queries, and admin ops.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="chat">
                <TabsList>
                  <TabsTrigger value="chat">Chat rooms</TabsTrigger>
                  <TabsTrigger value="rpc">RPC view</TabsTrigger>
                  <TabsTrigger value="admin">Admin</TabsTrigger>
                </TabsList>

                <TabsContent value="chat">
                  <div className="grid gap-4 lg:grid-cols-[0.45fr_0.55fr]">
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-border/60 bg-white/60 p-4">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Rooms
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {rooms.map((room) => (
                            <Button
                              key={room.roomId}
                              size="sm"
                              variant={
                                room.roomId === activeRoom
                                  ? "secondary"
                                  : "outline"
                              }
                              onClick={() => setActiveRoom(room.roomId)}
                            >
                              #{room.roomId}
                            </Button>
                          ))}
                        </div>
                        <div className="mt-4 flex gap-2">
                          <Input
                            value={roomDraft}
                            onChange={(event) =>
                              setRoomDraft(event.target.value)
                            }
                            placeholder="new-room"
                          />
                          <Button
                            size="sm"
                            onClick={() => {
                              const nextRoom = roomDraft.trim();
                              if (!nextRoom) return;
                              setActiveRoom(nextRoom);
                              setRoomDraft("");
                            }}
                          >
                            Join
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border/60 bg-white/60 p-4">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Active room
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="accent">#{activeRoom}</Badge>
                          <Badge variant="muted">
                            {activeRoomInfo?.members ?? 0} online
                          </Badge>
                        </div>
                        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                          {(activeRoomInfo?.online ?? []).length ? (
                            activeRoomInfo?.online.map((name) => (
                              <div key={name} className="flex items-center">
                                <ChevronRight className="mr-1 h-3 w-3" />
                                {name}
                              </div>
                            ))
                          ) : (
                            <span>No one else here yet.</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-white/60 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Messages
                        </p>
                        <Badge variant="muted">
                          {messages.length} total
                        </Badge>
                      </div>
                      <div className="mt-3 max-h-[320px] space-y-3 overflow-y-auto pr-2">
                        {messages.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No messages yet. Start the conversation.
                          </p>
                        ) : (
                          messages.map((message) => (
                            <div
                              key={message.id}
                              className="rounded-2xl border border-border/60 bg-white/70 p-3 text-sm"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">
                                    {message.user}
                                  </span>
                                  <Badge
                                    variant={
                                      message.role === "admin"
                                        ? "warning"
                                        : "muted"
                                    }
                                  >
                                    {message.role}
                                  </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {formatTime(message.at)}
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-foreground">
                                {message.text}
                              </p>
                              <p className="mt-2 text-[11px] text-muted-foreground">
                                Trace {message.traceId}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="mt-4 space-y-2">
                        <Textarea
                          value={messageDraft}
                          onChange={(event) =>
                            setMessageDraft(event.target.value)
                          }
                          placeholder={`Message #${activeRoom}`}
                        />
                        <Button
                          className="w-full"
                          onClick={() => {
                            const text = messageDraft.trim();
                            if (!text) return;
                            sendMessage.mutate({
                              roomId: activeRoom,
                              text,
                            });
                          }}
                          disabled={sendMessage.isPending || status !== "open"}
                        >
                          Send to room
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="rpc">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-white/60 p-4">
                      <p className="text-xs font-semibold text-muted-foreground">
                        stats.get() payload
                      </p>
                      <pre className="mt-3 max-h-[240px] overflow-auto rounded-2xl bg-muted/60 p-3 text-xs">
                        {JSON.stringify(statsQuery.data ?? {}, null, 2)}
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={() => statsQuery.refetch()}
                      >
                        Refetch stats
                      </Button>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-white/60 p-4">
                      <p className="text-xs font-semibold text-muted-foreground">
                        chat.history() for #{activeRoom}
                      </p>
                      <pre className="mt-3 max-h-[240px] overflow-auto rounded-2xl bg-muted/60 p-3 text-xs">
                        {JSON.stringify(historyQuery.data ?? [], null, 2)}
                      </pre>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Powered by TanStack Query with RPC handlers.
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="admin">
                  <div className="rounded-2xl border border-border/60 bg-white/60 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <ShieldAlert className="h-4 w-4 text-primary" />
                      Broadcast to every client
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Uses middleware to check admin role on the server.
                    </p>
                    <Textarea
                      className="mt-3"
                      value={adminDraft}
                      onChange={(event) => setAdminDraft(event.target.value)}
                      placeholder="Message to broadcast"
                    />
                    <Button
                      className="mt-3"
                      onClick={() =>
                        announce.mutate({ message: adminDraft.trim() })
                      }
                      disabled={
                        session.role !== "admin" ||
                        announce.isPending ||
                        !adminDraft.trim() ||
                        status !== "open"
                      }
                    >
                      Send broadcast
                    </Button>
                    {session.role !== "admin" && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Switch role to admin to unlock this action.
                      </p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="animate-rise" style={{ animationDelay: "420ms" }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Activity feed
                </CardTitle>
                <CardDescription>Server push + events.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Activity will appear here as events stream in.
                  </p>
                ) : (
                  activity.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-border/60 bg-white/70 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">
                          {item.title}
                        </p>
                        <Badge
                          variant={
                            item.tone === "success"
                              ? "success"
                              : item.tone === "warning"
                              ? "warning"
                              : item.tone === "danger"
                              ? "danger"
                              : "muted"
                          }
                        >
                          {item.tone}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {item.description}
                      </p>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {formatTime(item.at)}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="animate-rise" style={{ animationDelay: "520ms" }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BrainCircuit className="h-5 w-5 text-primary" />
                  Server pulse
                </CardTitle>
                <CardDescription>handlers.send().broadcast()</CardDescription>
              </CardHeader>
              <CardContent>
                {lastTick ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Last tick</span>
                      <span className="font-semibold">
                        {formatTime(lastTick.at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Online</span>
                      <span className="font-semibold">
                        {lastTick.online}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Rooms</span>
                      <span className="font-semibold">
                        {lastTick.rooms.length}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Waiting for the first server tick.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
