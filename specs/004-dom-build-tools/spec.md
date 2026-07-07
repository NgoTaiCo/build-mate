# Feature Specification: DOM Build Tools

**Feature Branch**: `004-dom-build-tools`  
**Created**: 2026-07-07  
**Status**: Draft  
**Input**: User description: "DOM execution tools add_to_build(sku) and read_current_build via OpenClaw browser automation server-side on phongvu.vn/buildpc. Fallback to mock build-PC page (self-hosted) if browser automation cannot drive real site (login/React/anti-bot). add_to_build clicks through build PC UI to insert component; read_current_build parses current cart state. Out-of-scope: Chrome Extension overlay, checkout/payment, multi-tab."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Add a Component to the Active Build (Priority: P1)

A customer asks the BuildMate agent to add a specific component to their PC build. The agent invokes the add capability, the component is inserted into the active build, and the customer can see the updated build contents.

**Why this priority**: Adding components is the core action that closes the loop between recommendation and a tangible build. Without it, the agent cannot materialize its suggestions.

**Independent Test**: Can be fully tested by requesting the addition of a known component and verifying that the build state reflects the new component.

**Acceptance Scenarios**:

1. **Given** the customer has an active build session and a valid component SKU, **When** the agent adds the component, **Then** the component appears in the active build and the customer receives confirmation.
2. **Given** the customer requests a component that is incompatible with the current build, **When** the agent attempts to add it, **Then** the system reports the failure clearly without silently dropping the request.

---

### User Story 2 - Read the Current Build State (Priority: P1)

A customer asks the agent to review what is already in their build. The agent reads the current build state and summarizes the components, categories, totals, and any missing essentials.

**Why this priority**: Customers need visibility into their build before deciding on the next component. Reading the build state enables advice, gap analysis, and confirmation.

**Independent Test**: Can be fully tested by opening an active build with known components and verifying that the agent accurately reports the contents.

**Acceptance Scenarios**:

1. **Given** the active build contains several components, **When** the agent reads the build state, **Then** the customer receives a complete summary including each component's category and the build total.
2. **Given** the active build is empty, **When** the agent reads the build state, **Then** the customer is informed that no components have been selected yet.

---

### User Story 3 - Continue Operating When the Live Site Cannot Be Driven (Priority: P2)

The live phongvu.vn/buildpc page becomes undrivable because of a login wall, anti-bot measure, or UI change. The system switches to the self-hosted mock build-PC page so that the agent can still demonstrate add and read behavior end-to-end.

**Why this priority**: Fallback preserves demo continuity and development velocity when the external site is unstable or blocks automation. It is secondary to the live-site happy path.

**Independent Test**: Can be fully tested by simulating a failure against the live site and verifying that add and read operations succeed on the mock fallback.

**Acceptance Scenarios**:

1. **Given** the live build page is unreachable or undrivable, **When** the agent attempts an add or read operation, **Then** the system asks the customer for confirmation before redirecting execution to the mock page and reports that fallback mode is active.
2. **Given** the system is running in fallback mode, **When** the agent reads the build state, **Then** the returned state matches the contents last modified on the mock page.

---

### Edge Cases

- What happens when the requested SKU is out of stock, discontinued, or not found on the live site?
- What happens when the live site session expires or requires login before an operation can complete?
- What happens when the same component is added to the build more than once?
- What happens when the live site's build UI changes and the expected insertion flow no longer matches?
- What happens when the self-hosted mock fallback page is unreachable?
- What happens when the customer attempts to add a component to a category that already has a selected component?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a capability to add a component to the active PC build by its SKU.
- **FR-002**: System MUST provide a capability to read the current state of the active PC build.
- **FR-003**: System MUST attempt add and read operations against the live phongvu.vn/buildpc page before falling back to any alternative target.
- **FR-004**: System MUST switch to the self-hosted mock build-PC page when the live site cannot be driven.
- **FR-005**: System MUST report whether an operation executed against the live site or the mock fallback.
- **FR-006**: System MUST confirm successful insertion after an add operation, or report failure with a clear reason.
- **FR-007**: System MUST return, at minimum, each component's SKU, category, and price, plus the build total when reading the current build state.
- **FR-008**: System MUST NOT initiate checkout, payment, or multi-tab flows as a result of these operations.
- **FR-009**: System MUST provide a self-hosted mock fallback whose component catalog mirrors the real phongvu.vn/buildpc categories and representative SKUs.
- **FR-010**: System MUST pause and ask the user for confirmation before switching from the live site to the mock fallback.

### Key Entities _(include if feature involves data)_

- **Active Build**: The PC build currently being edited, containing zero or more selected components and a running total.
- **Component**: A product selected for the build, identified by SKU, with a category, name, and price.
- **Build State**: A snapshot of the Active Build, including the list of Components, the total price, and any warnings about missing or conflicting selections.
- **Execution Target**: The environment where the operation runs — either the live phongvu.vn/buildpc page or the self-hosted mock build-PC page.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Customers can have a component added to their build within 30 seconds of the agent confirming the request.
- **SC-002**: The agent accurately describes the current build contents after reading the build state, with no missing components or incorrect totals.
- **SC-003**: At least 90% of add-to-build attempts on the live site succeed without manual intervention when the site is reachable and the SKU is valid.
- **SC-004**: When the live site cannot be driven and the customer confirms fallback, the system switches to the mock fallback and remains usable for demonstration within 10 seconds.
- **SC-005**: No operation triggered by these capabilities initiates checkout, payment, or opens additional tabs.

## Assumptions

- The agent has already identified the correct component SKU through catalog search or compiler recommendation before invoking add.
- The customer is interacting through the primary WebChat channel.
- The self-hosted mock build-PC page is deployed and reachable whenever fallback is invoked.
- The mock fallback catalog is derived from the real phongvu.vn/buildpc catalog so that categories and representative SKUs remain aligned.
- The add capability is responsible for insertion only; compatibility validation is handled by the Build Compiler layer.
