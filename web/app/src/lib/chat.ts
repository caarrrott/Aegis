import type { Citation } from "./api";

export type MessageStatus = "pending" | "done" | "error" | "cancelled";

export interface UserMessage {
  id: string;
  role: "user";
  personaId: string;
  text: string;
  at: number;
}

export interface AssistantMessage {
  id: string;
  role: "assistant";
  status: MessageStatus;
  question: string;
  personaId: string;
  text: string;
  answered: boolean | null;
  grounded: boolean | null;
  citations: Citation[];
  warnings: string[];
  trace: string[];
  error?: string;
  at: number;
}

export type ChatMessage = UserMessage | AssistantMessage;

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
