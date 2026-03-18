import { useRef, useEffect, useCallback, useState, type PointerEvent } from "react";
import type { ActorHandle } from "@zocket/core";
import type { DrawingRoom } from "../../game";
import { useActorState } from "../zocket";

type Room = ActorHandle<typeof DrawingRoom>;
type Point = [number, number];
type Stroke = { points: Point[]; color: string; width: number };

const COLORS = [
  "#000000", "#ffffff", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#3b82f6", "#8b5cf6",
];
const WIDTHS = [2, 4, 8, 14];

export function Canvas({
  room,
  isDrawer,
}: {
  room: Room;
  isDrawer: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useActorState(room, (s) => s.strokes) ?? [];

  const [color, setColor] = useState("#000000");
  const [width, setWidth] = useState(4);
  const drawing = useRef(false);
  const currentPoints = useRef<Point[]>([]);

  const redraw = useCallback(
    (strokesToDraw: Stroke[]) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const stroke of strokesToDraw) {
        if (stroke.points.length < 2) continue;
        ctx.beginPath();
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i][0], stroke.points[i][1]);
        }
        ctx.stroke();
      }
    },
    [],
  );

  useEffect(() => {
    redraw(strokes);
  }, [strokes, redraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const onResize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width;
      canvas.height = r.height;
      redraw(strokes);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function getPos(e: PointerEvent): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  function onPointerDown(e: PointerEvent) {
    if (!isDrawer) return;
    drawing.current = true;
    currentPoints.current = [getPos(e)];
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!drawing.current) return;
    const pt = getPos(e);
    currentPoints.current.push(pt);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pts = currentPoints.current;
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(pts[pts.length - 2][0], pts[pts.length - 2][1]);
    ctx.lineTo(pt[0], pt[1]);
    ctx.stroke();
  }

  function onPointerUp() {
    if (!drawing.current) return;
    drawing.current = false;
    const pts = currentPoints.current;
    if (pts.length >= 2) {
      room.draw({ stroke: { points: pts, color, width } });
    }
    currentPoints.current = [];
  }

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        className="w-full aspect-[4/3] rounded-lg border border-zinc-700 bg-white"
        style={{ cursor: isDrawer ? "crosshair" : "default", touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />

      {isDrawer && (
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? "#3b82f6" : "transparent",
                }}
              />
            ))}
          </div>
          <div className="h-5 w-px bg-zinc-700" />
          <div className="flex gap-1.5">
            {WIDTHS.map((w) => (
              <button
                key={w}
                onClick={() => setWidth(w)}
                className={`h-7 w-7 rounded-lg border flex items-center justify-center transition-colors
                  ${width === w ? "border-blue-500 bg-zinc-800" : "border-zinc-700 bg-zinc-900 hover:bg-zinc-800"}`}
              >
                <span
                  className="rounded-full bg-zinc-300"
                  style={{ width: w + 2, height: w + 2 }}
                />
              </button>
            ))}
          </div>
          <button
            onClick={() => room.clearCanvas()}
            className="ml-auto rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs
                       font-medium hover:bg-zinc-800 transition-colors"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
