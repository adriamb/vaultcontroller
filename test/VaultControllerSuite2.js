// This test suite corresponds to the old Vault test suite

/* global artifacts */
/* global contract */
/* global web3 */
/* global assert */

const VaultControllerFactory = artifacts.require("../contracts/VaultControllerFactory.sol");
const VaultFactory = artifacts.require("../contracts/VaultFactory.sol");
const VaultController = artifacts.require("../contracts/VaultController.sol");

contract("VaultController:Suite2", (accounts) => {
    const {
     //   0: owner,
        1: escapeHatchCaller,
        2: escapeHatchDestination,
     //   3: securityGuard,
     //   4: spender,
     //   5: recipient,
    } = accounts;

    let vaultcrtl;

    beforeEach(async () => {
        const vcf = await VaultControllerFactory.new();
        const vf = await VaultFactory.new();
        vaultcrtl = await VaultController.new(
            "rootvaultcrtl",
            vf.address,
            vcf.address,
            0,
            escapeHatchCaller,
            escapeHatchDestination,
            0,
            0,
        );
    });

    it("Check initial contruction", async () => {
        assert.equal("rootvaultcrtl", await vaultcrtl.name());
    });
});
