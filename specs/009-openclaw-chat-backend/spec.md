# Feature Specification: OpenClaw Chat Relay Backend

**Feature Branch**: `009-openclaw-chat-backend`  
**Created**: 2026-07-11  
**Status**: Draft  
**Input**: User description: "tôi cần viết một server backend đơn giản để bên fe gọi vào đưa chat, sessionId sau đó ta sẽ gửi qua bên openclaw với cách kết nối đã được thử nghiệm trong openclaw-client, deviceId nên được cố định trong code luôn để approve một lần thôi"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Frontend sends a chat message and gets the assistant reply (Priority: P1)

A frontend application sends a chat message together with a session identifier to the backend. The backend relays the message to the OpenClaw gateway over the already-proven connection, waits for the assistant's response, and returns that response to the frontend. The frontend does not need to know anything about OpenClaw's authentication, device pairing, or message protocol.

**Why this priority**: This is the core reason the backend exists. Without it, the frontend has no way to talk to OpenClaw. Everything else is supporting infrastructure.

**Independent Test**: Start the backend, send a single HTTP request with a message and a sessionId, and confirm a coherent assistant reply comes back in the response. This alone delivers a usable chat proxy.

**Acceptance Scenarios**:

1. **Given** the backend is running and its device identity is already approved, **When** the frontend sends a request containing a message and a sessionId, **Then** the backend returns the assistant's reply text for that session.
2. **Given** a valid message and sessionId, **When** the assistant produces a multi-part or lengthy reply, **Then** the backend returns the complete final reply (not a partial fragment).
3. **Given** two requests with different sessionIds, **When** both are sent, **Then** each reply reflects its own session's conversation context and they do not cross over.

---

### User Story 2 - Backend uses a fixed device identity approved only once (Priority: P1)

The backend holds a single, fixed device identity (keypair and derived device ID) defined in code/configuration. This identity is approved on the OpenClaw gateway exactly one time by an operator. From then on, every backend start-up and every request reuses the same approved identity without triggering a new pairing request.

**Why this priority**: The user explicitly required this. A rotating identity would force re-approval on every restart, which is operationally unacceptable for a backend service. It is a prerequisite for reliable P1 chat relay.

**Independent Test**: Approve the device once, restart the backend several times, and confirm no new pairing request appears and chat continues to work without operator intervention.

**Acceptance Scenarios**:

1. **Given** a fresh backend deployment with its fixed identity, **When** it connects to the gateway for the first time, **Then** it presents the fixed device ID and requests pairing once.
2. **Given** the operator has approved that device ID, **When** the backend restarts, **Then** it connects successfully with no new pairing request.
3. **Given** the fixed identity, **When** multiple backend instances or repeated connections occur, **Then** they all present the same device ID and reuse the single approval.

---

### User Story 3 - Frontend receives clear, actionable errors (Priority: P2)

When something goes wrong — the gateway is unreachable, the device is not yet approved, authentication fails, or a request times out — the backend returns a clear error to the frontend instead of hanging or leaking raw protocol details.

**Why this priority**: Improves reliability and developer experience, but the happy-path relay (P1) can be demonstrated without exhaustive error handling.

**Independent Test**: Stop the gateway (or use an unapproved identity), send a request, and confirm the backend returns a meaningful error status/message quickly rather than hanging.

**Acceptance Scenarios**:

1. **Given** the gateway is unreachable, **When** the frontend sends a request, **Then** the backend responds with a clear "gateway unavailable" error within a bounded time.
2. **Given** the device identity is not yet approved, **When** the frontend sends a request, **Then** the backend responds with an error indicating pairing/approval is required.
3. **Given** a request that the assistant does not answer within the timeout window, **When** the timeout elapses, **Then** the backend returns a timeout error and does not leave the request hanging indefinitely.

---

### Edge Cases

- What happens when a request arrives with a missing or empty `sessionId` or missing message text? → Backend rejects with a validation error and does not contact the gateway.
- What happens when the gateway connection drops mid-request? → Backend surfaces an error for the in-flight request; subsequent requests transparently re-establish the connection.
- What happens when two requests for the same `sessionId` arrive nearly simultaneously? → Behavior is defined so replies are not mixed up (see FR-011).
- What happens when the assistant reply is an error message from OpenClaw itself? → Backend relays it as an error rather than a normal reply.
- What happens on the very first connection after deploy but before operator approval? → Requests fail with a clear "approval required" error until approved.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Backend MUST expose an endpoint that accepts a chat request containing at least a message and a `sessionId` from the frontend.
- **FR-002**: Backend MUST relay the received message to the OpenClaw gateway on behalf of the specified session, using the connection and authentication method already validated in `openclaw-client.html`.
- **FR-003**: Backend MUST wait for the assistant's final reply for that session and return it to the frontend in the response.
- **FR-004**: Backend MUST use a single, fixed device identity defined in code/configuration (not randomly generated per start-up).
- **FR-005**: Backend MUST reuse the fixed device identity so that operator approval on the gateway is required only once for the lifetime of that identity.
- **FR-006**: Backend MUST authenticate to the gateway using the shared gateway token and the fixed device identity's signed challenge (the proven handshake).
- **FR-007**: Backend MUST validate incoming requests and reject those missing a message or `sessionId` without contacting the gateway.
- **FR-008**: Backend MUST return clear, frontend-friendly errors for the failure cases: gateway unreachable, device not approved, authentication failure, and reply timeout.
- **FR-009**: Backend MUST NOT require the frontend to handle any OpenClaw-specific authentication, pairing, or low-level protocol concerns.
- **FR-010**: Backend MUST enforce a bounded wait time for an assistant reply and return a timeout error if exceeded.
- **FR-011**: Backend MUST correctly associate each assistant reply with the request/session that triggered it, so concurrent sessions do not receive each other's replies.
- **FR-012**: Backend MUST keep the gateway token and device private key out of responses and logs.
- **FR-013**: Backend MUST re-establish the gateway connection automatically after a disconnect, without manual restart.

### Key Entities _(include if feature involves data)_

- **Chat Request**: What the frontend sends — a message (text) and a `sessionId` identifying the conversation. May optionally carry an agent identifier.
- **Chat Reply**: What the backend returns — the assistant's final response text for the given session, or an error descriptor.
- **Device Identity**: The fixed keypair and its derived device ID used by the backend to authenticate to the gateway; approved once by an operator.
- **Gateway Connection**: The authenticated channel between backend and OpenClaw gateway over which messages and replies flow.
- **Session**: The conversation context on the OpenClaw side addressed by `sessionId`; the gateway maintains its own history per session.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A frontend can obtain an assistant reply by making a single request with a message and `sessionId`, with no knowledge of OpenClaw internals.
- **SC-002**: After the device is approved once, the backend can be restarted at least 5 times consecutively and continues serving chat with zero additional operator approvals.
- **SC-003**: For a typical short prompt, the frontend receives the assistant's reply in the same round-trip (no polling required by the frontend).
- **SC-004**: When the gateway is unavailable or the device is unapproved, the frontend receives a clear error within 10 seconds rather than an indefinite hang.
- **SC-005**: Under concurrent requests across at least 3 distinct sessionIds, every reply is delivered to the correct session 100% of the time.

## Assumptions

- The OpenClaw gateway connection, Ed25519 device authentication, one-time device pairing, and `chat.send`/`chat` event protocol proven in `openclaw-client.html` are the reference implementation the backend will reuse.
- The gateway is reachable from the backend at the same host/port used during testing (default `ws://localhost:18790`), configurable via environment.
- The gateway shared token is provided to the backend via configuration/environment, not hardcoded in source committed to the repo.
- `sessionId` maps to the OpenClaw session key convention (e.g. an `agent:main:<session>`-style key); exact mapping is an implementation detail resolved during planning.
- A single default agent (e.g. `main`) is sufficient unless the request specifies otherwise.
- The frontend and backend are trusted components on the same deployment; frontend-facing authentication/authorization is out of scope for this feature unless added later.
- Synchronous request/response (frontend waits for the reply) is acceptable for the initial version; streaming to the frontend is out of scope.
