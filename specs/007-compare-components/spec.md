# Feature Specification: Component Comparison Tool

**Feature Branch**: `007-compare-components`  
**Created**: 2026-07-08  
**Status**: Draft  
**Input**: User description: "compare_components(skus) tool: accept 2-N SKUs, return comparison table (spec fields side-by-side: price, stock, promo, socket, ram_gen, tdp, wattage, clearance, form_factor) plus recommend best-fit per stated use case (gaming/productivity/budget). Deterministic comparison, LLM only for recommendation prose. Stretch goal - implement only if MVP done early. Out-of-scope: live benchmarking, external review aggregation."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Compare Multiple Components Side-by-Side (Priority: P1)

A shopper wants to decide between two or more similar PC components (for example, CPUs or motherboards). They provide the product SKUs they are considering, and the system returns a side-by-side comparison table showing key specification fields and commercial information for each item.

**Why this priority**: Side-by-side comparison is the core capability of this feature. Without it, shoppers cannot evaluate alternatives objectively using consistent data.

**Independent Test**: Can be fully tested by entering 2-5 valid SKUs and receiving a table that lists price, stock status, promotion, socket, RAM generation, TDP, wattage, clearance, and form factor for each SKU.

**Acceptance Scenarios**:

1. **Given** a shopper provides 2 valid SKUs of the same component category, **When** the comparison is requested, **Then** the system returns a table with all listed spec fields side-by-side.
2. **Given** a shopper provides 3-5 valid SKUs, **When** the comparison is requested, **Then** the table includes every SKU with its corresponding values aligned in columns.

---

### User Story 2 - Receive Best-Fit Recommendation by Use Case (Priority: P2)

After viewing the comparison table, the shopper states their primary use case (gaming, productivity, or budget). The system highlights the component that best fits that use case and explains the recommendation in plain language.

**Why this priority**: The recommendation helps shoppers make a final choice without manually weighing every spec. It is secondary to the deterministic comparison table.

**Independent Test**: Can be fully tested by providing a set of SKUs and a stated use case, then receiving a single recommended SKU with a short explanation tied to the use case.

**Acceptance Scenarios**:

1. **Given** a shopper provides 2 or more valid SKUs and selects "gaming" as the use case, **When** the recommendation is generated, **Then** the system returns the SKU best suited for gaming with an explanation referencing relevant specs.
2. **Given** a shopper provides the same SKU list and selects "budget" as the use case, **When** the recommendation is generated, **Then** the system may recommend a different SKU than for gaming, based on price and value.

---

### Edge Cases

- What happens when fewer than 2 SKUs are provided?
- What happens when one or more SKUs cannot be found in the catalog?
- What happens when SKUs belong to different component categories (for example, comparing a CPU with a GPU)?
- What happens when a spec field is missing for one or more SKUs?
- What happens when the stated use case is not one of the supported values (gaming, productivity, budget)?
- What happens when all provided SKUs are out of stock?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component comparison capability MUST accept 2 or more SKUs as input.
- **FR-002**: The system MUST return a side-by-side comparison table that includes the following fields for each SKU: price, stock status, active promotion, socket, RAM generation, TDP, wattage, clearance, and form factor.
- **FR-003**: Comparison values MUST be deterministic: the same set of SKUs MUST always produce the same table values when catalog data has not changed.
- **FR-004**: When a shopper states a supported use case (gaming, productivity, or budget), the system MUST recommend the single best-fitting SKU from the provided list.
- **FR-005**: The system MUST generate the recommendation explanation in natural language; the underlying scoring and comparison logic MUST remain deterministic.
- **FR-006**: The system MUST validate input and return a clear, actionable message when fewer than 2 SKUs are provided, when a SKU is not found, or when SKUs belong to incompatible categories.
- **FR-007**: The system MUST handle missing or unavailable spec fields gracefully by displaying a meaningful placeholder instead of failing the entire comparison.
- **FR-008**: Out-of-scope capabilities MUST NOT block the comparison: live benchmark scores and external review aggregation are excluded.

### Assumptions

- The catalog provides the listed spec fields for each SKU at the time of comparison.
- "Promotion" refers to the currently active discount or offer associated with a SKU.
- "Best-fit" scoring uses deterministic rules based on the stated use case and available spec fields, not subjective or live benchmark data.
- The initial release supports up to 5 SKUs per comparison; this limit may be revised based on observed shopper behavior.
- This feature is a stretch goal for the current milestone and should only be implemented after core MVP capabilities are complete.

### Key Entities

- **SKU**: A unique product identifier used to look up a component in the catalog.
- **Component Specification**: The set of attributes compared for each SKU, including price, stock status, promotion, socket, RAM generation, TDP, wattage, clearance, and form factor.
- **Use Case**: The shopper's stated goal, limited to gaming, productivity, or budget.
- **Comparison Result**: The combined output containing the side-by-side table and the optional best-fit recommendation with explanation.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Shoppers can compare 2-5 components in a single request.
- **SC-002**: The comparison table displays all nine specified spec fields for every SKU that has them available.
- **SC-003**: Repeated comparisons with identical SKUs and unchanged catalog data produce identical results 100% of the time.
- **SC-004**: For supported use cases, shoppers receive a single recommended SKU and a plain-language explanation within 5 seconds of requesting the recommendation.
- **SC-005**: At least 95% of invalid inputs (fewer than 2 SKUs, unknown SKU, or incompatible categories) receive a clear, actionable message instead of a generic failure.
- **SC-006**: Comparison results remain unaffected by live benchmarking data or external review scores, keeping the scope bounded to catalog specs and stated use cases.
