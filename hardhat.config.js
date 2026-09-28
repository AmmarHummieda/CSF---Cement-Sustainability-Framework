const { defineConfig } = require("hardhat/config");

module.exports = defineConfig({
  networks: {
    local: {
      type: "edr-simulated",
      chainType: "l1",
      chainId: 1337,
      hardfork: "shanghai"
    }
  }
});
