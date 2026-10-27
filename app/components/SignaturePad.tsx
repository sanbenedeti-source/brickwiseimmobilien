"use client";

import { Eraser, PenLine } from "lucide-react";
import { useCallback, useEffect, useId, useRef } from "react";

type SignaturePadProps = {
  label: string;
  help: string;
  clearLabel: string;
  typedLabel: string;
  name: string;
  disabled?: boolean;
  /** Receives a PNG data URL once enough has been drawn, or null when the pad is empty. */
  onChange: (signature: string | null) => void;
};

const inkColor = "#14213d";
const minimumInk = 40;
const buttonStyle = "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40";

export default function SignaturePad({ label, help, clearLabel, typedLabel, name, disabled = false, onChange }: SignaturePadProps) {
  const id = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const ink = useRef(0);
  const changed = useRef(onChange);
  useEffect(() => { changed.current = onChange; }, [onChange]);

  const reset = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
    ink.current = 0;
    changed.current(null);
  }, []);

  // Match the backing store to the displayed size; a resize clears the drawing.
  const fit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = canvas.getBoundingClientRect();
    const pixelWidth = Math.round(width * ratio), pixelHeight = Math.round(height * ratio);
    if (!pixelWidth || (canvas.width === pixelWidth && canvas.height === pixelHeight)) return;
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2.4;
    context.strokeStyle = inkColor;
    context.fillStyle = inkColor;
    ink.current = 0;
    changed.current(null);
  }, []);

  useEffect(() => {
    fit();
    const observer = new ResizeObserver(fit);
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [fit]);

  function position(event: { clientX: number; clientY: number }) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = position(event);
    const context = event.currentTarget.getContext("2d");
    context?.beginPath();
    context?.arc(point.x, point.y, 1.2, 0, Math.PI * 2);
    context?.fill();
    last.current = point;
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    const context = event.currentTarget.getContext("2d");
    if (!last.current || !context) return;
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    for (const item of events.length ? events : [event.nativeEvent]) {
      const point = position(item);
      context.beginPath();
      context.moveTo(last.current.x, last.current.y);
      context.lineTo(point.x, point.y);
      context.stroke();
      ink.current += Math.hypot(point.x - last.current.x, point.y - last.current.y);
      last.current = point;
    }
  }

  function end() {
    if (!last.current) return;
    last.current = null;
    changed.current(ink.current >= minimumInk ? canvasRef.current!.toDataURL("image/png") : null);
  }

  // Keyboard-friendly alternative: render the profile name in a handwriting style.
  function insertName() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const text = name.trim();
    if (!canvas || !context || text.length < 2) return;
    reset();
    const { width, height } = canvas.getBoundingClientRect();
    let size = 46;
    const font = (value: number) => `italic ${value}px "Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive`;
    context.font = font(size);
    while (size > 18 && context.measureText(text).width > width * 0.84) context.font = font(--size);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, width / 2, height / 2);
    ink.current = minimumInk;
    changed.current(canvas.toDataURL("image/png"));
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={`${id}-label`} className="text-sm font-semibold">{label}</span>
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={insertName} disabled={disabled || name.trim().length < 2} className={buttonStyle}><PenLine size={14} aria-hidden="true" />{typedLabel}</button>
          <button type="button" onClick={reset} disabled={disabled} className={buttonStyle}><Eraser size={14} aria-hidden="true" />{clearLabel}</button>
        </div>
      </div>
      <div className="relative mt-2">
        <canvas
          ref={canvasRef}
          role="img"
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-help`}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className={`block h-40 w-full touch-none rounded-xl border border-dashed border-line-strong bg-white ${disabled ? "cursor-not-allowed opacity-60" : "cursor-crosshair"}`}
        />
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-slate-200" />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-9 left-6 text-sm text-slate-300">×</span>
      </div>
      <p id={`${id}-help`} className="mt-1.5 text-xs leading-5 text-muted">{help}</p>
    </div>
  );
}
