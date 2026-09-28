# Architecture and implementation map

The paper presents a transparent and traceable certification workflow for sustainable cement production. This repository maps that workflow into two Solidity contracts and a local runnable example. The contracts organise records and permissions for the main participants; the regulator coordinates the full sequence.

## Roles and workflow

The workflow has three roles. The regulator deploys the contracts, approves manufacturer registration, oversees reporting and calculation, opens audit requests, selects an auditor, reviews the reported result, and issues and approves certificates. A manufacturer registers its details, records sensor connection status and submits reporting values. An auditor applies for a request and submits an audit report and result.

The paper's workflow proceeds through four stages:

1. **Registration.** The manufacturer submits a name, location and registration-information IPFS identifier. The regulator approves the registration.
2. **Reporting.** The registered manufacturer records sensor connection status and submits emissions, production and a report IPFS identifier. The regulator can calculate and emit a reporting-cycle result.
3. **Auditing.** The regulator opens an audit request, an auditor applies, the regulator selects an applicant, and the auditor submits the audit report and result for the regulator to review and approve.
4. **Certification.** The regulator issues a certificate from the accumulated `SCSC` reporting values and approves it by certificate index.

`SCSC` and `AuditSC` are modular contracts with their own state and regulator field. The local example uses the same regulator account for both, then follows the paper's audit-before-certification sequence through the regulator's procedure.

## Contract records

The following data are stored or emitted by the contracts:

| Contract | Main records | Key role actions |
| --- | --- | --- |
| `SCSC` | Manufacturer details, registration and sensor status, cumulative emissions and production, report count, thresholds and certificates | Manufacturer: register, connect sensors, report. Regulator: approve registration, calculate, issue and approve certificate. |
| `AuditSC` | Audit requests, applicants, selected auditor, report IPFS identifier and audit status fields | Regulator: request audit, select auditor, review result. Auditor: apply and submit report. |

An individual `EmissionsReport` stores `block.timestamp`, submitted emissions and a report IPFS identifier. The submitted production quantity contributes to the manufacturer's cumulative total rather than being retained in that struct. Certification records copy the accumulated emissions and production values, alongside the calculated score, into the public certificate list.

## Information around the contracts

The article's broader architecture includes CEMS, smart meters, oracles and IPFS. In this source, the contract methods receive the values and identifiers that the surrounding application provides. `connectSensors()` records a manufacturer status, while report and audit functions accept IPFS strings as references to associated material. This division keeps the Solidity file focused on the ledger workflow and leaves equipment, oracle and content processes to the connected application and operating arrangement.

## Adapting the pattern

The paper presents the modular workflow as adaptable to other energy-intensive industries and regulatory settings. An adapted implementation would make the relevant stakeholder governance, data model, metrics, thresholds, reporting cadence, certification rules, monitoring interfaces and deployment choice fit its intended use. These are implementation and application choices for an adapted version, rather than controls already exposed by every function in this archived snapshot. The paper discusses this path in Sections 3.2, 5.4 and 6.

## A small arithmetic example

For the runnable example, a manufacturer reports `1200` emissions units and `300` production units. With the source's fixed `timeElapsed = 1`, `calculateAverageAndEmissionFactor` emits a reporting factor of `400`. Issuing the certificate records the unscaled integer score `4`, then resets the manufacturer's cumulative emissions, production and report count for the next cycle. [The walkthrough](walkthrough.md) sets out the calls in order, while [the implementation notes](implementation-notes.md) explain the arithmetic and state changes.
