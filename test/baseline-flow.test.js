const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const { id } = require("ethers");
const { createChain, deploy, expectRevert, parsedEvents } = require("./helpers");

const chains = [];
afterEach(async () => Promise.all(chains.splice(0).map(({ connection }) => connection.close())));

async function setupManufacturer() {
  const chain = await createChain();
  chains.push(chain);
  const [regulator, manufacturer, auditor, outsider] = chain.signers;
  const scsc = await deploy("SCSC", regulator);
  return { regulator, manufacturer, auditor, outsider, scsc };
}

test("baseline: manufacturer reports, regulator calculates, and certificate is approved", async () => {
  const { regulator, manufacturer, scsc } = await setupManufacturer();
  const manufacturerAddress = await manufacturer.getAddress();

  let receipt = await (await scsc.connect(manufacturer).register("Cement One", "Abu Dhabi", "ipfs://registration")).wait();
  const request = parsedEvents(scsc, receipt, "RegistrationRequested")[0];
  assert.equal(request.args.manufacturerAddress, manufacturerAddress);
  assert.equal(request.args.name.hash, id("Cement One"));

  receipt = await (await scsc.connect(regulator).approveRegistration(manufacturerAddress)).wait();
  assert.equal(parsedEvents(scsc, receipt, "RegistrationApproved")[0].args.location.hash, id("Abu Dhabi"));
  receipt = await (await scsc.connect(manufacturer).connectSensors()).wait();
  assert.equal(parsedEvents(scsc, receipt, "SensorConnected")[0].args.manufacturerAddress, manufacturerAddress);

  receipt = await (await scsc.connect(manufacturer).reportEmissions(1200, 300, "ipfs://report-1")).wait();
  assert.equal(parsedEvents(scsc, receipt, "ViolationDetected")[0].args.emissions, 1200n);
  let state = await scsc.manufacturers(manufacturerAddress);
  assert.equal(state.totalEmissions, 1200n);
  assert.equal(state.tonsOfCementProduced, 300n);
  assert.equal(state.numReports, 1n);

  receipt = await (await scsc.connect(regulator).calculateAverageAndEmissionFactor(manufacturerAddress)).wait();
  const cycle = parsedEvents(scsc, receipt, "ReportingCycleCompleted")[0];
  assert.deepEqual([cycle.args.emissionsPerYear, cycle.args.tonsOfCementProducedPerYear, cycle.args.emissionFactor], [1200n, 300n, 400n]);

  receipt = await (await scsc.connect(regulator).issueCertificate(manufacturerAddress)).wait();
  assert.equal(parsedEvents(scsc, receipt, "CertificateIndex")[0].args.index, 0n);
  let certificate = await scsc.certifications(0);
  assert.deepEqual([certificate.emissionsPerYear, certificate.tonsOfCementProducedPerYear, certificate.sustainabilityScore, certificate.regulatorApproved], [1200n, 300n, 4n, false]);
  await (await scsc.connect(regulator).approveCertificate(0)).wait();
  certificate = await scsc.certifications(0);
  assert.equal(certificate.regulatorApproved, true);
  state = await scsc.manufacturers(manufacturerAddress);
  assert.deepEqual([state.totalEmissions, state.tonsOfCementProduced, state.numReports], [0n, 0n, 0n]);
});

test("baseline: audit request passes through application, acceptance, submission and approval", async () => {
  const chain = await createChain();
  chains.push(chain);
  const [regulator, manufacturer, auditor, outsider] = chain.signers;
  const audit = await deploy("AuditSC", regulator);
  const manufacturerAddress = await manufacturer.getAddress();
  const auditorAddress = await auditor.getAddress();

  let receipt = await (await audit.connect(regulator).requestAudit(manufacturerAddress)).wait();
  assert.equal(parsedEvents(audit, receipt, "AuditRequestOpened")[0].args.requestId, 0n);
  receipt = await (await audit.connect(auditor).applyForAudit(0)).wait();
  assert.equal(parsedEvents(audit, receipt, "AuditorApplied")[0].args.auditor, auditorAddress);
  await (await audit.connect(regulator).acceptAuditor(0, auditorAddress)).wait();
  receipt = await (await audit.connect(auditor).submitAuditReport(0, "ipfs://audit-report", true)).wait();
  assert.equal(parsedEvents(audit, receipt, "AuditResultAvailable")[0].args.passed, true);
  receipt = await (await audit.connect(regulator).approveAuditResult(0, true)).wait();
  assert.equal(parsedEvents(audit, receipt, "AuditCompleted")[0].args.passed, true);
  const state = await audit.auditRequests(0);
  assert.deepEqual([state.acceptedAuditor, state.reportIPFSHash, state.isCompleted, state.isApproved, state.passed, state.isOpen], [auditorAddress, "ipfs://audit-report", true, true, true, false]);

  await expectRevert(() => audit.connect(outsider).submitAuditReport(0, "ipfs://other", true), /accepted auditor|approved yet/i);
});

test("baseline: registration, sensor, reporting and certification permissions are enforced", async () => {
  const unapproved = await setupManufacturer();
  await expectRevert(() => unapproved.scsc.connect(unapproved.manufacturer).connectSensors(), /not registered/i);

  const nonRegulator = await setupManufacturer();
  await expectRevert(
    async () => nonRegulator.scsc.connect(nonRegulator.outsider).approveRegistration(await nonRegulator.manufacturer.getAddress()),
    /Only regulator/i
  );

  const noSensor = await setupManufacturer();
  const noSensorAddress = await noSensor.manufacturer.getAddress();
  await (await noSensor.scsc.connect(noSensor.manufacturer).register("Cement One", "Abu Dhabi", "ipfs://registration")).wait();
  await (await noSensor.scsc.connect(noSensor.regulator).approveRegistration(noSensorAddress)).wait();
  await expectRevert(() => noSensor.scsc.connect(noSensor.manufacturer).reportEmissions(1, 1, "ipfs://report"), /connected to sensors/i);

  const outsiderCertificate = await setupManufacturer();
  await expectRevert(
    async () => outsiderCertificate.scsc.connect(outsiderCertificate.outsider).issueCertificate(await outsiderCertificate.manufacturer.getAddress()),
    /Only regulator/i
  );
});
