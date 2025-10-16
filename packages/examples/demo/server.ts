import { z } from "zod";
import { zocket, createBunServer } from "@zocket/core";

const WIDTH = 800;
const HEIGHT = 480;
const PADDLE_W = 12;
const PADDLE_H = 80;
const PADDLE_X_LEFT = 20;
const PADDLE_X_RIGHT = WIDTH - PADDLE_X_LEFT - PADDLE_W;
const PADDLE_SPEED = 12;
const BALL_R = 8;
const BALL_SPEED = 9;

const rooms = new Map();
const clientToRoom = new Map();

function createInitialRoomState() {
  return {
    players: {},
    paddles: {
      leftY: HEIGHT / 2 - PADDLE_H / 2,
      rightY: HEIGHT / 2 - PADDLE_H / 2,
    },
    inputs: { left: "stop", right: "stop" },
    ball: { x: WIDTH / 2, y: HEIGHT / 2, vx: BALL_SPEED, vy: BALL_SPEED * 0.6 },
    scores: { left: 0, right: 0 },
    status: "waiting",
    loop: null,
  };
}

function clampPaddle(y: number) {
  if (y < 0) return 0;
  const maxY = HEIGHT - PADDLE_H;
  return y > maxY ? maxY : y;
}

function startLoop(
  roomId: string,
  publish: (topic: string, message: string) => void
) {
  const state = rooms.get(roomId);
  if (!state || state.loop) return;

  state.status = "playing";
  state.loop = setInterval(() => {
    // update paddles by inputs
    if (state.inputs.left === "up")
      state.paddles.leftY = clampPaddle(state.paddles.leftY - PADDLE_SPEED);
    else if (state.inputs.left === "down")
      state.paddles.leftY = clampPaddle(state.paddles.leftY + PADDLE_SPEED);

    if (state.inputs.right === "up")
      state.paddles.rightY = clampPaddle(state.paddles.rightY - PADDLE_SPEED);
    else if (state.inputs.right === "down")
      state.paddles.rightY = clampPaddle(state.paddles.rightY + PADDLE_SPEED);

    // move ball
    state.ball.x += state.ball.vx;
    state.ball.y += state.ball.vy;

    // wall collisions
    if (state.ball.y <= BALL_R || state.ball.y >= HEIGHT - BALL_R) {
      state.ball.vy = -state.ball.vy;
      state.ball.y = Math.max(BALL_R, Math.min(HEIGHT - BALL_R, state.ball.y));
    }

    // paddle collisions
    // left
    const leftHitX = PADDLE_X_LEFT + PADDLE_W;
    if (
      state.ball.vx < 0 &&
      state.ball.x - BALL_R <= leftHitX &&
      state.ball.x - BALL_R >= PADDLE_X_LEFT &&
      state.ball.y >= state.paddles.leftY &&
      state.ball.y <= state.paddles.leftY + PADDLE_H
    ) {
      state.ball.vx = Math.abs(state.ball.vx) * 1.03;
      const rel =
        (state.ball.y - (state.paddles.leftY + PADDLE_H / 2)) / (PADDLE_H / 2);
      state.ball.vy += rel * 1.5;
      state.ball.x = leftHitX + BALL_R; // prevent sticking
    }

    // right
    const rightHitX = PADDLE_X_RIGHT;
    if (
      state.ball.vx > 0 &&
      state.ball.x + BALL_R >= rightHitX &&
      state.ball.x + BALL_R <= rightHitX + PADDLE_W &&
      state.ball.y >= state.paddles.rightY &&
      state.ball.y <= state.paddles.rightY + PADDLE_H
    ) {
      state.ball.vx = -Math.abs(state.ball.vx) * 1.03;
      const rel =
        (state.ball.y - (state.paddles.rightY + PADDLE_H / 2)) / (PADDLE_H / 2);
      state.ball.vy += rel * 1.5;
      state.ball.x = rightHitX - BALL_R; // prevent sticking
    }

    // scoring
    if (state.ball.x < -BALL_R) {
      state.scores.right += 1;
      state.status = "point";
      state.ball.x = WIDTH / 2;
      state.ball.y = HEIGHT / 2;
      state.ball.vx = BALL_SPEED;
      state.ball.vy = BALL_SPEED * 0.6 * (Math.random() > 0.5 ? 1 : -1);
    } else if (state.ball.x > WIDTH + BALL_R) {
      state.scores.left += 1;
      state.status = "point";
      state.ball.x = WIDTH / 2;
      state.ball.y = HEIGHT / 2;
      state.ball.vx = -BALL_SPEED;
      state.ball.vy = BALL_SPEED * 0.6 * (Math.random() > 0.5 ? 1 : -1);
    } else {
      state.status = "playing";
    }

    // broadcast state to room
    const payload = {
      ball: { x: state.ball.x, y: state.ball.y },
      paddles: { leftY: state.paddles.leftY, rightY: state.paddles.rightY },
      scores: { left: state.scores.left, right: state.scores.right },
      status: state.status,
      players: {
        left: state.players.leftName,
        right: state.players.rightName,
      },
    };
    publish(roomId, JSON.stringify({ type: "game.state", payload }));
  }, 1000 / 30);
}

function stopLoop(roomId: string) {
  const state = rooms.get(roomId);
  if (!state || !state.loop) return;
  clearInterval(state.loop);
  state.loop = null;
}

const zo = zocket.create({
  headers: z.object({
    user: z.string().default("guest"),
  }),
  onConnect: (headers, clientId) => {
    console.log(`✅ ${headers.user} connected (${clientId})`);
    return {
      user: headers.user,
    };
  },
  onDisconnect: (ctx, clientId) => {
    // remove from room state if present
    const ref = clientToRoom.get(clientId);
    if (ref) {
      const { roomId, side } = ref;
      const state = rooms.get(roomId);
      if (state) {
        if (side === "left" && state.players.left === clientId) {
          delete state.players.left;
          delete state.players.leftName;
          state.inputs.left = "stop";
        }
        if (side === "right" && state.players.right === clientId) {
          delete state.players.right;
          delete state.players.rightName;
          state.inputs.right = "stop";
        }
        // stop loop if less than 2 players
        const playersCount =
          Number(Boolean(state.players.left)) +
          Number(Boolean(state.players.right));
        if (playersCount < 2) {
          stopLoop(roomId);
          state.status = "waiting";
        }
      }
      clientToRoom.delete(clientId);
    }
    console.log(`❌ ${ctx.user} disconnected (${clientId})`);
  },
});

const gameRouter = {
  game: {
    join: zo.message.incoming({
      payload: z.object({
        roomId: z.string(),
        username: z.string(),
      }),
    }),
    move: zo.message.incoming({
      payload: z.object({
        dir: z.enum(["up", "down", "stop"]),
      }),
    }),
    assign: zo.message.outgoing({
      payload: z.object({
        side: z.enum(["left", "right", "spectator"]),
      }),
    }),
    state: zo.message.outgoing({
      payload: z.object({
        ball: z.object({ x: z.number(), y: z.number() }),
        paddles: z.object({ leftY: z.number(), rightY: z.number() }),
        scores: z.object({ left: z.number(), right: z.number() }),
        status: z.enum(["waiting", "playing", "point"]),
        players: z.object({
          left: z.string().optional(),
          right: z.string().optional(),
        }),
      }),
    }),
  },
};

export type GameRouter = typeof gameRouter;

// eslint-disable-next-line prefer-const
let publish: (topic: string, message: string) => void;

const appRouter = zo.router(gameRouter, {
  game: {
    join: ({ payload, ctx }) => {
      const { roomId, username } = payload;
      if (!rooms.has(roomId)) rooms.set(roomId, createInitialRoomState());
      const state = rooms.get(roomId)!;

      if (!ctx.rooms.has(roomId)) ctx.rooms.join(roomId);

      let side: "left" | "right" | "spectator" = "spectator";
      if (!state.players.left) {
        state.players.left = ctx.clientId;
        state.players.leftName = username;
        side = "left";
      } else if (!state.players.right) {
        state.players.right = ctx.clientId;
        state.players.rightName = username;
        side = "right";
      } else {
        side = "spectator";
      }

      clientToRoom.set(ctx.clientId, { roomId, side });

      // notify the joining client of assigned side
      ctx.send.game.assign({ side }).to([ctx.clientId]);

      // start loop if we have two players
      const playersCount =
        Number(Boolean(state.players.left)) +
        Number(Boolean(state.players.right));
      if (playersCount >= 2 && !state.loop) {
        startLoop(roomId, publish);
      }

      // broadcast current state
      const payloadState = {
        ball: { x: state.ball.x, y: state.ball.y },
        paddles: { leftY: state.paddles.leftY, rightY: state.paddles.rightY },
        scores: { left: state.scores.left, right: state.scores.right },
        status: state.status,
        players: {
          left: state.players.leftName,
          right: state.players.rightName,
        },
      };
      ctx.rooms.broadcast(roomId, "game.state", payloadState);
    },
    move: ({ payload, ctx }) => {
      const ref = clientToRoom.get(ctx.clientId);
      if (!ref) return;
      const { roomId, side } = ref;
      const state = rooms.get(roomId);
      if (!state) return;
      if (side === "left" || side === "right") {
        state.inputs[side] = payload.dir;
      }
    },
  },
});

const handlers = createBunServer(appRouter, zo);
publish = handlers.publish;

const server = Bun.serve({
  fetch: handlers.fetch,
  websocket: handlers.websocket,
  port: 3000,
  hostname: "127.0.0.1",
});

console.log(`🚀 Server running on ws://localhost:${server.port}`);
