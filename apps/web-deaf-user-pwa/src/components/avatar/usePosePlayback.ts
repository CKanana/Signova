import { useCallback, useEffect, useRef, useState } from "react";
import type { SignPoseSequence } from "../../../../../shared/types/signPose";

interface UsePosePlaybackOptions {
  pose: SignPoseSequence | null;
  autoPlay?: boolean;
  reduceMotion?: boolean;
}

export function usePosePlayback({
  pose,
  autoPlay = true,
  reduceMotion = false,
}: UsePosePlaybackOptions) {
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const positionRef = useRef(0);
  const playingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const poseRef = useRef<SignPoseSequence | null>(pose);
  poseRef.current = pose;

  const frameCount = pose?.frameCount ?? 0;
  const lastFrame = Math.max(0, frameCount - 1);

  const stop = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    lastTimeRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    const currentPose = poseRef.current;
    if (!currentPose || currentPose.frameCount < 2) return;

    if (positionRef.current >= currentPose.frameCount - 1) {
      positionRef.current = 0;
      setPosition(0);
    }

    if (playingRef.current) return;

    playingRef.current = true;
    setPlaying(true);
    lastTimeRef.current = null;

    const tick = (timestamp: number) => {
      if (!playingRef.current) return;
      const active = poseRef.current;
      if (!active) {
        stop();
        return;
      }

      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const delta = Math.min(Math.max(0, timestamp - lastTimeRef.current), 120);
      lastTimeRef.current = timestamp;
      const next = positionRef.current + (delta / 1000) * active.fps;

      if (next >= active.frameCount - 1) {
        positionRef.current = active.frameCount - 1;
        setPosition(active.frameCount - 1);
        playingRef.current = false;
        setPlaying(false);
        rafRef.current = null;
        return;
      }

      positionRef.current = next;
      setPosition(next);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

  }, [stop]);

  const pause = useCallback(() => {
    stop();
  }, [stop]);

  const replay = useCallback(() => {
    stop();
    positionRef.current = 0;
    setPosition(0);
    start();
  }, [start, stop]);

  useEffect(() => {
    stop();
    positionRef.current = 0;
    setPosition(0);
    if (autoPlay && !reduceMotion && pose && pose.frameCount > 1) {
      const timer = setTimeout(() => start(), 120);
      return () => {
        clearTimeout(timer);
        stop();
      };
    }
    return () => stop();
  }, [pose, autoPlay, reduceMotion, start, stop]);

  useEffect(() => {
    return () => {
      playingRef.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const progress =
    lastFrame > 0 ? Math.min(1, Math.max(0, position / lastFrame)) : 0;

  return {
    position,
    playing,
    progress,
    frameCount,
    play: start,
    pause,
    replay,
  };
}

