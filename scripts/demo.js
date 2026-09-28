const { createChain, deploy, parsedEvents } = require("../test/helpers");

async function main() {
  const chain = await createChain();
  try {
    const [regulator, manufacturer, auditor] = chain.signers;
    const scsc = await deploy("SCSC", regulator);
    const audit = await deploy("AuditSC", regulator);
    const manufacturerAddress = await manufacturer.getAddress();
    const auditorAddress = await auditor.getAddress();

    await (await scsc.connect(manufacturer).register("Demo Cement", "Local VM", "ipfs://demo-registration")).wait();
    await (await scsc.connect(regulator).approveRegistration(manufacturerAddress)).wait();
    await (await scsc.connect(manufacturer).connectSensors()).wait();
    await (await scsc.connect(manufacturer).reportEmissions(1200, 300, "ipfs://demo-report")).wait();
    const cycleReceipt = await (await scsc.connect(regulator).calculateAverageAndEmissionFactor(manufacturerAddress)).wait();
    const emissionFactor = parsedEvents(scsc, cycleReceipt, "ReportingCycleCompleted")[0].args.emissionFactor;

    await (await audit.connect(regulator).requestAudit(manufacturerAddress)).wait();
    await (await audit.connect(auditor).applyForAudit(0)).wait();
    await (await audit.connect(regulator).acceptAuditor(0, auditorAddress)).wait();
    await (await audit.connect(auditor).submitAuditReport(0, "ipfs://demo-audit", true)).wait();
    await (await audit.connect(regulator).approveAuditResult(0, true)).wait();

    await (await scsc.connect(regulator).issueCertificate(manufacturerAddress)).wait();
    await (await scsc.connect(regulator).approveCertificate(0)).wait();

    const certificate = await scsc.certifications(0);
    const auditRequest = await audit.auditRequests(0);
    console.log(JSON.stringify({
      chainId: 1337,
      manufacturer: manufacturerAddress,
      reportingCycleEmissionFactor: emissionFactor.toString(),
      certificateSustainabilityScore: certificate.sustainabilityScore.toString(),
      certificateRegulatorApproved: certificate.regulatorApproved,
      auditApproved: auditRequest.isApproved
    }, null, 2));
  } finally {
    await chain.connection.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
