import { api } from "../../services/api";
import type { SignPoseSequence } from "../../../../../shared/types/signPose";

const CACHE_LIMIT = 24;
const cache = new Map<string, SignPoseSequence>();

function key(sessionId: string, messageId: string): string {
  return `${sessionId}:${messageId}`;
}

export async function loadSignPose(
  sessionId: string,
  messageId: string,
): Promise<SignPoseSequence> {
  const cacheKey = key(sessionId, messageId);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const { pose } = await api.getMessagePose(sessionId, messageId);

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(cacheKey, pose);
  return pose;
}

export function clearSignPoseCache(): void {
  cache.clear();
}
