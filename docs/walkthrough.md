# Local VM walkthrough

This walkthrough maps the regulator-led sequence run by `npm run demo`. The individual contract workflows are also covered by the baseline tests; `npm run verify` runs those tests in Hardhat 3.18.0's in-process EDR-simulated local network (chain ID 1337), using local accounts without a wallet or public-network transaction.

## Prepare the accounts

The demo deploys `SCSC` and `AuditSC` from one local account, which becomes the immutable `regulator` in each contract. It uses a second account as the manufacturer and a third as the auditor. The reported sequence below is therefore a readable companion to that tested execution.

Use non-sensitive placeholder strings for IPFS hashes. The contracts store a string and do not fetch the corresponding content, so the local example does not require IPFS access.

## Registration and reporting in SCSC

With the manufacturer account selected, use the same simple values exercised by the baseline test: `Cement One`, `Abu Dhabi`, `ipfs://registration`, `1200`, `300` and `ipfs://report-1`.

1. Call `register("Cement One", "Abu Dhabi", "ipfs://registration")`. The transaction emits `RegistrationRequested`, but the manufacturer remains unregistered in contract state.
2. Switch to the regulator account and call `approveRegistration` with the manufacturer address. This sets `isRegistered` to `true` and `threshold` to `1000`.
3. Switch back to the manufacturer and call `connectSensors`. This sets `isConnectedToSensors` to `true`; it does not contact a device.
4. Call `reportEmissions(1200, 300, "ipfs://report-1")`. The contract increments the cumulative totals and report count to `1200`, `300` and `1`. Because `1200` exceeds the fixed threshold, it also emits `ViolationDetected`.

Switch to the regulator account and call `calculateAverageAndEmissionFactor` with the manufacturer address. It emits `ReportingCycleCompleted` with `1200`, `300` and `400`. The function contains a fixed `timeElapsed = 1`, so do not treat the emitted field names as a measured annual rate.

## Audit in the separate AuditSC contract

With the regulator account, call `requestAudit` using the manufacturer address. This creates request `0` in `AuditSC`; it does not look up registration or reports in `SCSC`.

Switch to the auditor account and call `applyForAudit(0)`. Then return to the regulator account and call `acceptAuditor(0, auditorAddress)`. Once an auditor is accepted, the request is closed to further applications. The accepted auditor calls `submitAuditReport(0, "ipfs://audit-report", true)` and the regulator calls `approveAuditResult(0, true)`.

The local example follows the paper's audit-before-certification sequence. The regulator coordinates the audit record and the later certification call across the two modular contracts.

## Issue and approve a certificate

Using the regulator account on `SCSC`, call `issueCertificate(manufacturerAddress)`. This only requires that the manufacturer is registered. With the sample report, it creates certificate `0` with `1200` emissions, `300` tons and a score of `4`, then resets the manufacturer's cumulative emissions, production and report-count fields. A zero production total causes the Solidity division to revert.

Finally call `approveCertificate(index)` using the emitted index. This changes the corresponding certificate's `regulatorApproved` flag to `true`.

## Useful checks while exploring

- A non-regulator caller should be rejected by regulator-only functions.
- `reportEmissions` should be rejected until registration has been approved and the sensor flag has been set.
- A report above the fixed threshold is still stored; the observable consequence is a violation event.
- The audit and certificate stages are coordinated by the regulator's procedure across `AuditSC` and `SCSC`.
- After `issueCertificate`, inspect the manufacturer record again to see the cumulative fields reset.


## Run the compact demonstration

After `npm ci`, run `npm run demo`. It follows the same `1200`-emissions and `300`-production example used in the baseline test, reporting an emission factor of `400` and a certificate score of `4`. The demonstration completes auditing before certification through the regulator-led workflow.
