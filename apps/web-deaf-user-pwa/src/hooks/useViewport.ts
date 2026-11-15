import { useState, useEffect } from "react";

export interface Viewport {
  width: number;
  height: number;
  isTablet: boolean;
}

export function useViewport(): Viewport {
  const [size, setSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 768,
    height: typeof window !== "undefined" ? window.innerHeight : 1024,
  });

  useEffect(() => {
    const onResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return { ...size, isTablet: size.width >= 768 };
}
