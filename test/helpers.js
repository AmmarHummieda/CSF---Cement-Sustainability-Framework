const assert = require("node:assert/strict");
const { BrowserProvider, ContractFactory } = require("ethers");
const { compileCSF, SOURCE_NAME } = require("../scripts/compile");

let contracts;

function compiledContracts() {
  if (!contracts) {
    contracts = compileCSF().output.contracts[SOURCE_NAME];
  }
  return contracts;
}

async function createChain() {
  const { network } = await import("hardhat");
  const connection = await network.create("local");
  const ethersProvider = new BrowserProvider(connection.provider, undefined, {
    cacheTimeout: -1,
    pollingInterval: 10
  });
  const signers = await Promise.all(Array.from({ length: 10 }, (_, index) => ethersProvider.getSigner(index)));
  return { connection, ethersProvider, signers };
}

async function deploy(contractName, signer) {
  const contract = compiledContracts()[contractName];
  const factory = new ContractFactory(contract.abi, `0x${contract.evm.bytecode.object}`, signer);
  const deployed = await factory.deploy();
  await deployed.waitForDeployment();
  return deployed;
}

function parsedEvents(contract, receipt, eventName) {
  return receipt.logs
    .map((log) => {
      try {
        return contract.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .filter((event) => event && event.name === eventName);
}

async function expectRevert(action, message) {
  try {
    await action();
  } catch (error) {
    assert.match(`${error.shortMessage || ""} ${error.message || ""}`, message);
    return;
  }
  assert.fail("expected transaction to revert");
}

async function expectPanic(action, code) {
  const expected = `0x4e487b71${code.toString(16).padStart(64, "0")}`;
  try {
    await action();
  } catch (error) {
    const values = [];
    const visited = new Set();
    const collect = (value) => {
      if (value === null || value === undefined || visited.has(value)) return;
      if (typeof value === "string") {
        values.push(value);
      } else if (typeof value === "object") {
        visited.add(value);
        Object.values(value).forEach(collect);
      }
    };
    collect(error);
    assert.ok(values.some((value) => value.toLowerCase().includes(expected)), `expected ABI panic ${expected}`);
    return;
  }
  assert.fail(`expected ABI panic ${expected}`);
}

module.exports = { createChain, deploy, expectPanic, expectRevert, parsedEvents };
