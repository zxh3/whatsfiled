import os from "node:os";
import { db } from "../db/index.js";
import { pipelineWorkers } from "../db/schema.js";

type WorkerHeartbeatOptions = {
  workerType: string;
  stage?: string;
  details?: Record<string, unknown>;
  heartbeatIntervalMs?: number;
};

export async function withWorkerHeartbeat<T>(
  options: WorkerHeartbeatOptions,
  fn: () => Promise<T>,
): Promise<T> {
  const {
    workerType,
    stage,
    details,
    heartbeatIntervalMs = 30000,
  } = options;

  const workerKey = `${workerType}:${stage ?? "unknown"}:${process.pid}:${Date.now()}`;
  const startedAt = new Date();
  const detailsJson = details ? JSON.stringify(details) : null;

  const upsertHeartbeat = async (status: "running" | "stopped") => {
    const now = new Date();
    await db
      .insert(pipelineWorkers)
      .values({
        workerKey,
        workerType,
        stage,
        host: os.hostname(),
        pid: process.pid,
        status,
        startedAt,
        lastHeartbeatAt: now,
        endedAt: status === "stopped" ? now : null,
        details: detailsJson,
      })
      .onConflictDoUpdate({
        target: pipelineWorkers.workerKey,
        set: {
          workerType,
          stage,
          host: os.hostname(),
          pid: process.pid,
          status,
          lastHeartbeatAt: now,
          endedAt: status === "stopped" ? now : null,
          details: detailsJson,
        },
      });
  };

  await upsertHeartbeat("running");
  const interval = setInterval(() => {
    void upsertHeartbeat("running");
  }, heartbeatIntervalMs);

  try {
    return await fn();
  } finally {
    clearInterval(interval);
    await upsertHeartbeat("stopped");
  }
}
