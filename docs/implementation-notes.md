# Source behaviour and local verification

This note links the paper's four-stage workflow to the archived Solidity source and the local harness. It is a reading guide for reproducing the example, not a second implementation of the framework.

## Workflow mapped to the source

| Framework stage | Source entry points | Important current behaviour |
| --- | --- | --- |
| Registration | `register`, `approveRegistration` | A manufacturer supplies its details and a registration identifier; the regulator marks the account registered and sets the threshold to `1000`. |
| Reporting | `connectSensors`, `reportEmissions`, `calculateAverageAndEmissionFactor` | The manufacturer records the sensor status and submits emissions, production and a report identifier. The regulator emits a reporting-cycle calculation. |
| Auditing | `requestAudit`, `applyForAudit`, `acceptAuditor`, `submitAuditReport`, `approveAuditResult` | The regulator coordinates the audit request, selection and review sequence with the auditor. |
| Certification | `issueCertificate`, `approveCertificate` | The regulator issues a certificate from accumulated reporting values, then approves it by index. |

## Recorded arithmetic and state changes

The source sets `timeElapsed` to `1` in `calculateAverageAndEmissionFactor`. The reported values therefore use the accumulated totals for the active cycle. The event's emission-factor expression applies a factor of 100 and integer division; certificate creation uses an unscaled integer ratio for both `emissionFactor` and `sustainabilityScore`.

The baseline test and demo use `1200` emissions units and `300` production units. They produce a reporting factor of `400` and a certificate score of `4`. `issueCertificate` copies the current totals into a certificate and resets `totalEmissions`, `tonsOfCementProduced` and `numReports`. Registration state, sensor status and `lastReportTimestamp` remain in the manufacturer record for the next cycle.

## Local verification

`npm run verify` performs three steps: it checks the source SHA-256, builds the contracts, and runs the baseline and recorded-behaviour test files against Hardhat's local EDR network. The harness uses Solidity 0.8.26 with the optimiser set to 200 runs, `viaIR: true` and `evmVersion: "paris"`.

The suite preserves the source and records observable calls, events, state transitions and reverts. It does not substitute for the paper's historical cost measurements or for the surrounding CEMS, oracle, IPFS and regulatory processes described in the wider architecture.
