import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Loader2, SwitchCamera } from "lucide-react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";

import { Button } from "@/components/ui/button";
import type { Landmark } from "@/lib/pose-metrics";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

// Skeleton: head, torso, arms, legs
const BONES: Array<[number, number]> = [
  [0, 2], [0, 5], [2, 7], [5, 8], [9, 10],
  [11, 12], [11, 23], [12, 24], [23, 24],
  [11, 13], [13, 15], [12, 14], [14, 16],
  [15, 19], [16, 20],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 31], [28, 32], [27, 29], [28, 30],
];
const JOINTS = [0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 19, 20, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
const KEY_JOINTS = new Set([13, 14]); // elbows: the angle we measure

type Status = "idle" | "loading" | "running" | "error";

export function PoseCamera({
  onLandmarks,
  onRunningChange,
  children,
}: {
  onLandmarks: (lms: Landmark[] | null, aspect: number) => void;
  onRunningChange?: (running: boolean) => void;
  children?: React.ReactNode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const onLmRef = useRef(onLandmarks);
  onLmRef.current = onLandmarks;
  const onRunRef = useRef(onRunningChange);
  onRunRef.current = onRunningChange;

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    onLmRef.current(null, 1);
    setStatus("idle");
  }, []);

  const start = useCallback(
    async (mode: "user" | "environment") => {
      setError(null);
      setStatus("loading");
      try {
        if (!landmarkerRef.current) {
          const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
          const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
          const opts = (delegate: "GPU" | "CPU") => ({
            baseOptions: { modelAssetPath: MODEL_URL, delegate },
            runningMode: "VIDEO" as const,
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
          try {
            landmarkerRef.current = await PoseLandmarker.createFromOptions(fileset, opts("GPU"));
          } catch {
            landmarkerRef.current = await PoseLandmarker.createFromOptions(fileset, opts("CPU"));
          }
        }

        streamRef.current?.getTracks().forEach((t) => t.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode, width: { ideal: 960 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setStatus("running");
        loop();
      } catch (e) {
        console.error(e);
        const msg =
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "Kamera izni verilmedi. Tarayıcı ayarlarından kameraya izin verin."
            : "Kamera veya yapay zekâ modeli başlatılamadı. Sayfayı yenileyip tekrar deneyin.";
        setError(msg);
        setStatus("error");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const loop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const lm = landmarkerRef.current;
    if (!video || !canvas || !lm) return;
    let lastTime = -1;

    const tick = () => {
      if (!streamRef.current) return;
      if (video.readyState >= 2 && video.currentTime !== lastTime) {
        lastTime = video.currentTime;
        if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
        if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
        const result = lm.detectForVideo(video, performance.now());
        const pose = result.landmarks[0] ?? null;
        draw(canvas, pose);
        onLmRef.current(pose, video.videoWidth / Math.max(video.videoHeight, 1));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    onRunRef.current?.(status === "running");
  }, [status]);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    landmarkerRef.current?.close();
  }, []);

  const flip = () => {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    if (status === "running") void start(next);
  };

  const mirror = facing === "user" ? "-scale-x-100" : "";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface aspect-[3/4] sm:aspect-video">
      <video ref={videoRef} playsInline muted className={`absolute inset-0 h-full w-full object-contain ${mirror}`} />
      <canvas ref={canvasRef} className={`pointer-events-none absolute inset-0 h-full w-full object-contain ${mirror}`} />

      {status !== "running" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 text-center">
          <SkeletonGlyph />
          <p className="max-w-xs text-sm text-muted-foreground">
            {error ?? "Telefonu yere veya rafa koy, tüm vücudun (baş, gövde, bacaklar) görünecek şekilde yandan çek."}
          </p>
          <Button variant="ember" size="xl" onClick={() => start(facing)} disabled={status === "loading"}>
            {status === "loading" ? <Loader2 className="animate-spin" /> : <Camera />}
            {status === "loading" ? "Yapay zekâ yükleniyor" : "Kamerayı Başlat"}
          </Button>
        </div>
      )}

      {status === "running" && children}

      <div className="absolute right-3 top-3 flex gap-2">
        <Button variant="hud" size="icon" onClick={flip} aria-label="Ön/arka kamera">
          <SwitchCamera />
        </Button>
        {status === "running" && (
          <Button variant="hud" size="icon" onClick={stop} aria-label="Kamerayı durdur">
            <CameraOff />
          </Button>
        )}
      </div>
    </div>
  );
}

function draw(canvas: HTMLCanvasElement, pose: Landmark[] | null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  if (!pose) return;
  // Canvas pixels: plain sRGB values mirror the --bone / --ember tokens.
  const bone = "#ffffff";
  const ember = "#ff6a2b";
  const scale = Math.max(w, h) / 640;
  const ok = (i: number) => (pose[i]?.visibility ?? 0) > 0.4;

  ctx.lineCap = "round";
  ctx.strokeStyle = bone;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 3 * scale;
  for (const [a, b] of BONES) {
    const p = pose[a];
    const q = pose[b];
    if (!p || !q || !ok(a) || !ok(b)) continue;
    ctx.beginPath();
    ctx.moveTo(p.x * w, p.y * h);
    ctx.lineTo(q.x * w, q.y * h);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const i of JOINTS) {
    const p = pose[i];
    if (!p || !ok(i)) continue;
    const key = KEY_JOINTS.has(i);
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, (key ? 8 : 5.5) * scale, 0, Math.PI * 2);
    ctx.fillStyle = bone;
    ctx.fill();
    ctx.lineWidth = (key ? 3.5 : 2) * scale;
    ctx.strokeStyle = key ? ember : "rgba(0,0,0,0.55)";
    ctx.stroke();
  }
}

function SkeletonGlyph() {
  return (
    <svg viewBox="0 0 80 100" className="h-24 w-20 text-bone" aria-hidden>
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.6">
        <line x1="40" y1="22" x2="40" y2="55" />
        <line x1="28" y1="28" x2="52" y2="28" />
        <line x1="28" y1="28" x2="20" y2="44" /><line x1="20" y1="44" x2="16" y2="58" />
        <line x1="52" y1="28" x2="60" y2="44" /><line x1="60" y1="44" x2="64" y2="58" />
        <line x1="32" y1="55" x2="48" y2="55" />
        <line x1="32" y1="55" x2="30" y2="75" /><line x1="30" y1="75" x2="28" y2="94" />
        <line x1="48" y1="55" x2="50" y2="75" /><line x1="50" y1="75" x2="52" y2="94" />
      </g>
      <g fill="currentColor">
        {[[40, 12], [28, 28], [52, 28], [20, 44], [60, 44], [16, 58], [64, 58], [32, 55], [48, 55], [30, 75], [50, 75], [28, 94], [52, 94]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={x === 40 ? 6 : 3.5} />
        ))}
      </g>
    </svg>
  );
}
