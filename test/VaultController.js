// This test suite corresponds to the old Vault test suite

/* global artifacts */
/* global contract */
/* global web3 */
/* global assert */

const VaultControllerFactory = artifacts.require("../contracts/VaultControllerFactory.sol");
const VaultFactory = artifacts.require("../contracts/VaultFactory.sol");

contract("VaultController", (accounts) => {

    const owner = accounts[ 0 ];
    const escapeHatchCaller = accounts[ 1 ];
    const escapeHatchDestination = accounts[ 2 ];

    let vaultcrtl;

    beforeEach(async () => {

        const vcf = await VaultControllerFactory.new();
        vaultcrtl = await vcf.create(
            "rootvaultcrtl",
            await VaultFactory.new(),
            0, // ethers
            escapeHatchDestination,
            0  // no paent vault
        );

    });

    it("Check initial contruction", async () => {
        assert.equal("rootvaultcrtl", await vaultcrtl.name());
    });

});