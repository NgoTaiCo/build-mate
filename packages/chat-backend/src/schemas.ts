/**
 * Wire schemas for the frontend-facing HTTP API (see contracts/http-chat.md).
 * Validation runs before any gateway call (FR-007).
 */
import { z } from 'zod';

/** FE -> backend. `message` and `sessionId` non-empty; `agentId` optional. */
export const ChatRequestSchema = z.object({
  message: z.string().trim().min(1, 'message is required'),
  sessionId: z.string().trim().min(1, 'sessionId is required'),
  agentId: z.string().trim().min(1).optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

/** Stable machine-readable error codes returned to the FE. */
export type ErrorCode =
  | 'validation_error'
  | 'gateway_unavailable'
  | 'pairing_required'
  | 'auth_failed'
  | 'timeout'
  | 'gateway_error';

export interface ChatReply {
  sessionId: string;
  reply: string;
  runId: string;
}

export interface ErrorReply {
  error: ErrorCode;
  /** Human-readable, FE-safe. Never contains a token or private key (FR-012). */
  message: string;
}
