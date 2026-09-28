const { createHash } = require("node:crypto");
const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const solc = require("solc");

const ROOT = path.join(__dirname, "..");
const SOURCE_NAME = "CSF_vLatest.sol";
const SOURCE_FILE = path.join(ROOT, SOURCE_NAME);
const ARTIFACTS_DIR = path.join(ROOT, "artifacts");

// Explicit deterministic build settings for the local VM artefacts.
const COMPILER_SETTINGS = {
  optimizer: { enabled: true, runs: 200 },
  viaIR: true,
  evmVersion: "paris"
};

function compileCSF() {
  const source = readFileSync(SOURCE_FILE, "utf8");
  const input = {
    language: "Solidity",
    sources: { [SOURCE_NAME]: { content: source } },
    settings: {
      ...COMPILER_SETTINGS,
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"]
        }
      }
    }
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((diagnostic) => diagnostic.severity === "error");
  if (errors.length > 0) {
    throw new Error(errors.map((diagnostic) => diagnostic.formattedMessage).join("\n"));
  }
  return { source, output };
}

function writeArtifacts() {
  const { source, output } = compileCSF();
  const sourceSHA256 = createHash("sha256").update(Buffer.from(source)).digest("hex");
  const contracts = output.contracts[SOURCE_NAME];
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  for (const contractName of ["SCSC", "AuditSC"]) {
    const contract = contracts[contractName];
    const artifact = {
      contractName,
      sourceName: SOURCE_NAME,
      compiler: solc.version(),
      sourceSHA256,
      settings: COMPILER_SETTINGS,
      abi: contract.abi,
      bytecode: `0x${contract.evm.bytecode.object}`,
      deployedBytecode: `0x${contract.evm.deployedBytecode.object}`
    };
    writeFileSync(path.join(ARTIFACTS_DIR, `${contractName}.json`), `${JSON.stringify(artifact, null, 2)}\n`);
  }
  writeFileSync(
    path.join(ARTIFACTS_DIR, "compilation-settings.json"),
    `${JSON.stringify({ compiler: solc.version(), sourceName: SOURCE_NAME, sourceSHA256, settings: COMPILER_SETTINGS }, null, 2)}\n`
  );
  return contracts;
}

if (require.main === module) {
  writeArtifacts();
  console.log(`Compiled ${SOURCE_NAME} with ${solc.version()} (optimizer runs=${COMPILER_SETTINGS.optimizer.runs}, viaIR=${COMPILER_SETTINGS.viaIR}).`);
}

module.exports = { COMPILER_SETTINGS, SOURCE_NAME, compileCSF, writeArtifacts };
