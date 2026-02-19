/** @format */

"use client";

import { create } from "zustand";
import type {
  PipelineEvent,
  RunResult,
  PipelineStage,
  EventStatus,
} from "@rift/types";

// ─── Stage display state derived from events ─────────────────────────────────

export interface StageState {
  stage: PipelineStage;
  status: EventStatus | "PENDING";
  message: string;
  timestamp: string | null;
}

// ─── Store shape ──────────────────────────────────────────────────────────────

interface RunStore {
  runId: string | null;
  events: PipelineEvent[];
  stageStates: Partial<Record<PipelineStage, StageState>>;
  result: RunResult | null;
  wsStatus: "idle" | "connecting" | "connected" | "closed" | "error";

  // Actions
  setRunId: (runId: string) => void;
  appendEvent: (event: PipelineEvent) => void;
  setResult: (result: RunResult) => void;
  setWsStatus: (status: RunStore["wsStatus"]) => void;
  reset: () => void;
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState = {
  runId: null,
  events: [],
  stageStates: {},
  result: null,
  wsStatus: "idle" as const,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useRunStore = create<RunStore>((set) => ({
  ...initialState,

  setRunId: (runId) => set({ runId }),

  appendEvent: (event) =>
    set((state) => ({
      events: [...state.events, event],
      stageStates: {
        ...state.stageStates,
        [event.stage]: {
          stage: event.stage,
          status: event.status,
          message: event.message,
          timestamp: event.timestamp,
        },
      },
    })),

  setResult: (result) => set({ result }),

  setWsStatus: (wsStatus) => set({ wsStatus }),

  reset: () => set(initialState),
}));
