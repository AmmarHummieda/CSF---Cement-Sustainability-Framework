const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const { createChain, deploy, expectPanic, expectRevert, parsedEvents } = require("./helpers");

const chains = [];
afterEach(async () => Promise.all(chains.splice(0).map(({ connection }) => connection.close())));

async function auditChain() {
  const chain = await createChain();
  chains.push(chain);
  const [regulator, manufacturer, auditor, outsider, otherManufacturer] = chain.signers;
  return { regulator, manufacturer, auditor, outsider, otherManufacturer, audit: await deploy("AuditSC", regulator) };
}

async function registeredManufacturer({ production = 100, emissions = 400 } = {}) {
  const chain = await createChain();
  chains.push(chain);
  const [regulator, manufacturer] = chain.signers;
  const scsc = await deploy("SCSC", regulator);
  const address = await manufacturer.getAddress();
  await (await scsc.connect(manufacturer).register("Published behaviour", "Abu Dhabi", "ipfs://registration")).wait();
  await (await scsc.connect(regulator).approveRegistration(address)).wait();
  await (await scsc.connect(manufacturer).connectSensors()).wait();
  await (await scsc.connect(manufacturer).reportEmissions(emissions, production, "ipfs://report")).wait();
  return { regulator, manufacturer, address, scsc };
}

test("published behaviour: a pending registration can be overwritten by a second registration", async () => {
  const chain = await createChain();
  chains.push(chain);
  const [regulator, manufacturer] = chain.signers;
  const scsc = await deploy("SCSC", regulator);
  const address = await manufacturer.getAddress();
  await (await scsc.connect(manufacturer).register("First", "A", "ipfs://first")).wait();
  await (await scsc.connect(manufacturer).register("Second", "B", "ipfs://second")).wait();
  await (await scsc.connect(regulator).approveRegistration(address)).wait();
  const state = await scsc.manufacturers(address);
  assert.deepEqual([state.name, state.location, state.registrationInfoIPFSHash], ["Second", "B", "ipfs://second"]);
});

test("published behaviour: regulator can approve an address that never registered", async () => {
  const chain = await createChain();
  chains.push(chain);
  const [regulator, , , outsider] = chain.signers;
  const scsc = await deploy("SCSC", regulator);
  const outsiderAddress = await outsider.getAddress();
  await (await scsc.connect(regulator).approveRegistration(outsiderAddress)).wait();
  const state = await scsc.manufacturers(outsiderAddress);
  assert.equal(state.isRegistered, true);
  assert.equal(state.manufacturerAddress, "0x0000000000000000000000000000000000000000");
});

test("published behaviour: a certificate can be issued without any AuditSC linkage", async () => {
  const { regulator, address, scsc } = await registeredManufacturer();
  const receipt = await (await scsc.connect(regulator).issueCertificate(address)).wait();
  assert.equal(parsedEvents(scsc, receipt, "CertificateIssued").length, 1);
  assert.equal((await scsc.certifications(0)).manufacturerAddress, address);
});

test("published behaviour: zero reported production makes certificate issuance revert", async () => {
  const { regulator, address, scsc } = await registeredManufacturer({ production: 0 });
  await expectPanic(() => scsc.connect(regulator).issueCertificate(address), 0x12);
});

test("published behaviour: an auditor may submit again after regulator approval", async () => {
  const { regulator, manufacturer, auditor, audit } = await auditChain();
  const manufacturerAddress = await manufacturer.getAddress();
  const auditorAddress = await auditor.getAddress();
  await (await audit.connect(regulator).requestAudit(manufacturerAddress)).wait();
  await (await audit.connect(auditor).applyForAudit(0)).wait();
  await (await audit.connect(regulator).acceptAuditor(0, auditorAddress)).wait();
  await (await audit.connect(auditor).submitAuditReport(0, "ipfs://first", true)).wait();
  await (await audit.connect(regulator).approveAuditResult(0, true)).wait();
  await (await audit.connect(auditor).submitAuditReport(0, "ipfs://replacement", false)).wait();
  const state = await audit.auditRequests(0);
  assert.deepEqual([state.reportIPFSHash, state.isApproved, state.passed], ["ipfs://replacement", true, false]);
});

test("published behaviour: accepting a non-applicant closes the audit request", async () => {
  const { regulator, manufacturer, auditor, outsider, audit } = await auditChain();
  const manufacturerAddress = await manufacturer.getAddress();
  await (await audit.connect(regulator).requestAudit(manufacturerAddress)).wait();
  await (await audit.connect(auditor).applyForAudit(0)).wait();
  await (await audit.connect(regulator).acceptAuditor(0, await outsider.getAddress())).wait();
  assert.equal((await audit.auditRequests(0)).isOpen, false);
  await expectRevert(() => audit.connect(auditor).applyForAudit(0), /not open/i);
  await expectRevert(() => audit.connect(auditor).submitAuditReport(0, "ipfs://report", true), /not approved yet/i);
});

test("published behaviour: the audit approval condition permits approving a failed audit", async () => {
  const { regulator, manufacturer, auditor, audit } = await auditChain();
  const auditorAddress = await auditor.getAddress();
  await (await audit.connect(regulator).requestAudit(await manufacturer.getAddress())).wait();
  await (await audit.connect(auditor).applyForAudit(0)).wait();
  await (await audit.connect(regulator).acceptAuditor(0, auditorAddress)).wait();
  await (await audit.connect(auditor).submitAuditReport(0, "ipfs://failed", false)).wait();
  await (await audit.connect(regulator).approveAuditResult(0, true)).wait();
  assert.equal((await audit.auditRequests(0)).isApproved, true);
});

test("published behaviour: rejecting a passed audit reverts", async () => {
  const { regulator, manufacturer, auditor, audit } = await auditChain();
  const auditorAddress = await auditor.getAddress();
  await (await audit.connect(regulator).requestAudit(await manufacturer.getAddress())).wait();
  await (await audit.connect(auditor).applyForAudit(0)).wait();
  await (await audit.connect(regulator).acceptAuditor(0, auditorAddress)).wait();
  await (await audit.connect(auditor).submitAuditReport(0, "ipfs://passed", true)).wait();
  await expectRevert(() => audit.connect(regulator).approveAuditResult(0, false), /Cannot approve failed audit/i);
  assert.equal((await audit.auditRequests(0)).isApproved, false);
});

test("published behaviour: rejecting a failed audit still sets its approval flag", async () => {
  const { regulator, manufacturer, auditor, audit } = await auditChain();
  const auditorAddress = await auditor.getAddress();
  await (await audit.connect(regulator).requestAudit(await manufacturer.getAddress())).wait();
  await (await audit.connect(auditor).applyForAudit(0)).wait();
  await (await audit.connect(regulator).acceptAuditor(0, auditorAddress)).wait();
  await (await audit.connect(auditor).submitAuditReport(0, "ipfs://failed", false)).wait();
  await (await audit.connect(regulator).approveAuditResult(0, false)).wait();
  assert.equal((await audit.auditRequests(0)).isApproved, true);
});

test("published behaviour: latest-request gating blocks an accepted earlier auditor", async () => {
  const { regulator, manufacturer, auditor, audit } = await auditChain();
  const auditorAddress = await auditor.getAddress();
  await (await audit.connect(regulator).requestAudit(await manufacturer.getAddress())).wait();
  await (await audit.connect(auditor).applyForAudit(0)).wait();
  await (await audit.connect(regulator).acceptAuditor(0, auditorAddress)).wait();
  await (await audit.connect(regulator).requestAudit(auditorAddress)).wait();
  await expectRevert(() => audit.connect(auditor).submitAuditReport(0, "ipfs://report", true), /Only auditors/i);
});

test("published behaviour: calling applyForAudit before any request panics in onlyAuditor", async () => {
  const { auditor, audit } = await auditChain();
  await expectPanic(() => audit.connect(auditor).applyForAudit(0), 0x11);
});

test("published behaviour: reporting-cycle factor and certificate score use different integer scales", async () => {
  const { regulator, address, scsc } = await registeredManufacturer({ emissions: 999, production: 1000 });
  const cycleReceipt = await (await scsc.connect(regulator).calculateAverageAndEmissionFactor(address)).wait();
  assert.equal(parsedEvents(scsc, cycleReceipt, "ReportingCycleCompleted")[0].args.emissionFactor, 99n);
  await (await scsc.connect(regulator).issueCertificate(address)).wait();
  assert.equal((await scsc.certifications(0)).sustainabilityScore, 0n);
});
