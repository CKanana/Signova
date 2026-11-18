import { config } from "../config/env.js";
export class PoseServiceError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
        this.name = "PoseServiceError";
    }
}
const CACHE_LIMIT = 32;
const cache = new Map();
function remember(messageId, pose) {
    if (cache.size >= CACHE_LIMIT) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey)
            cache.delete(oldestKey);
    }
    cache.set(messageId, pose);
}
function validatePose(data) {
    const pose = data;
    if (!pose ||
        pose.status !== "ok" ||
        !Array.isArray(pose.joints) ||
        pose.joints.length === 0 ||
        !Array.isArray(pose.frames) ||
        pose.frames.length === 0 ||
        typeof pose.fps !== "number" ||
        pose.fps <= 0) {
        throw new PoseServiceError(502, "The signing service returned an invalid pose sequence.");
    }
    return pose;
}
export async function getMessagePose(messageId, text) {
    const cached = cache.get(messageId);
    if (cached)
        return cached;
    if (!config.signbridgeEnabled) {
        throw new PoseServiceError(503, "2D signing is not enabled on this server.");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.signbridgeTimeoutMs);
    try {
        const headers = { "content-type": "application/json" };
        if (config.signbridgeApiKey)
            headers["x-api-key"] = config.signbridgeApiKey;
        const res = await fetch(`${config.signbridgeUrl}/v1/animations/structured`, {
            method: "POST",
            headers,
            body: JSON.stringify({ text }),
            signal: controller.signal,
        });
        if (!res.ok) {
            const body = (await res.json().catch(() => null));
            const detail = body?.detail ?? body?.error ?? `SignBridge returned ${res.status}`;
            if (res.status === 422) {
                throw new PoseServiceError(422, `No 2D sign is available for some of this message. ${detail}`);
            }
            if (res.status === 503) {
                throw new PoseServiceError(503, "The 2D signing service is unavailable.");
            }
            throw new PoseServiceError(502, `The 2D signing service failed: ${detail}`);
        }
        const pose = validatePose(await res.json());
        remember(messageId, pose);
        return pose;
    }
    catch (err) {
        if (err instanceof PoseServiceError)
            throw err;
        if (err.name === "AbortError") {
            throw new PoseServiceError(504, "The 2D signing service timed out.");
        }
        throw new PoseServiceError(502, "Could not reach the 2D signing service.");
    }
    finally {
        clearTimeout(timer);
    }
}
export function clearPoseCache() {
    cache.clear();
}
