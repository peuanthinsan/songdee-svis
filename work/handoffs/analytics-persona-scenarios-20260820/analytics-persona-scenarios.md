# Analytics persona scenarios

## Primary persona: fleet supervisor

The supervisor is trying to keep vehicles safe and available while coordinating drivers, maintenance, and fleet managers. Every analytics view should answer four things: what changed, where it happened, what needs attention, and what evidence supports the next action.

| Scenario | Question to answer | Data needed | Product response |
| --- | --- | --- | --- |
| Morning readiness | Which fleets or vehicles have not completed the required inspection today? | Active-vehicle denominator, inspected vehicles, inspection frequency, fleet, GPS freshness | Completion KPI with denominator, fleet breakdown, and a direct link to pending vehicles. |
| Safety triage | Which vehicles need to be held or inspected first? | Fail count and fail rate per vehicle, latest failure date, open issue status, plate, fleet | Rank by failure rate with sample size; show latest evidence and link to issue detail. |
| Recurring defect | What keeps failing across the fleet? | Checklist item, vehicle type, frequency, fail count, fail rate, affected vehicles | Top failing items with rate and affected-vehicle count, not raw count alone. |
| Fleet comparison | Which fleet is underperforming, and is it a real gap? | Active vehicles, inspections, pass/fail, completion, open issues, date range | Compare rates with denominators and flag low-volume fleets as low confidence. |
| Shift handoff | What changed since the last shift? | Current vs prior period pass rate, new failures, resolved issues, unresolved aging | “Since previous period” summary and a short action queue. |
| Maintenance planning | Which vehicles are becoming unavailable or accumulating defects? | Open/in-progress issues, age, resolution time, vehicle, fleet, maintenance due/overdue | Open issue count, aging buckets, average resolution time, and drill-through list. |

## Stakeholder scenarios

| Stakeholder | Decision | Minimum useful view |
| --- | --- | --- |
| Fleet manager | Where should people and budget go? | Fleet-level pass/completion rates, recurring items, open issues, trend and export. |
| Operations manager | Can the network run today? | Readiness/completion, out-of-service or defect vehicles, unresolved issue aging. |
| Maintenance/vendor lead | What work is urgent and is it getting closed? | Issue queue by age/severity proxy, affected vehicle, vendor notification, resolution trend. |
| Safety/compliance lead | Can we prove inspections are happening and defects are controlled? | Inspection volume, completion denominator, fail trend, checklist coverage, period/export metadata. |
| Executive sponsor | Is the program improving? | One-period scorecard: completion, pass rate, open issues, resolution time, trend direction. |

## Coverage rules

- Always show the period and the denominator behind a percentage.
- Separate inspection volume, unique vehicles, and issue count; they are not interchangeable.
- Use rates beside counts so larger fleets do not automatically look worse.
- Label missing, stale, or low-volume data instead of implying a healthy result.
- Every red or amber metric should lead to a filtered list or an exportable evidence set.
- Keep raw inspection results and calculated operational metrics visually distinct.

## Current implementation gaps addressed in this pass

- The API already returned completion and resolution trends, but the client type and screen omitted them.
- Vehicle rankings used raw failure counts, which can hide a high failure rate in a smaller fleet.
- The analytics screen had no summary of total inspections, pass rate, open issues, or the active-vehicle denominator.
