// This test suite corresponds to the old Vault test suite

/* global artifacts */
/* global contract */
/* global web3 */
/* global assert */

const filterCoverageTopics = require("./helpers/filterCoverageTopics.js");

const VaultControllerFactory = artifacts.require("../contracts/VaultControllerFactory.sol");
const VaultFactory = artifacts.require("../contracts/VaultFactory.sol");
const VaultController = artifacts.require("../contracts/VaultController.sol");

contract("VaultController", (accounts) => {
    const {
     //   0: owner,
        1: escapeHatchCaller,
        2: escapeHatchDestination,
     //   3: securityGuard,
     //   4: spender,
     //   5: recipient,
    } = accounts;

    let vcf;
    let vf;
    let vc;

    beforeEach(async () => {
        vcf = await VaultControllerFactory.new();
        vf = await VaultFactory.new();
        vc = await VaultController.new(
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
        assert.equal("rootvaultcrtl", await vc.name());
        assert.equal(false, await vc.canceled());
        assert.equal(0, await vc.parentVaultController());
        assert.equal(0, await vc.parentVault());
        assert.equal(vf.address, await vc.vaultFactory());
        assert.equal(vcf.address, await vc.vaultControllerFactory());
        assert.equal(0, await vc.baseToken());
        assert.equal(escapeHatchCaller, await vc.escapeHatchCaller());
        assert.equal(escapeHatchDestination, await vc.escapeHatchDestination());
        assert.equal(0, await vc.dailyAmountLimit());
        assert.equal(0, await vc.dailyTxnLimit());
        assert.equal(0, await vc.txnAmountLimit());
        assert.equal(0, await vc.openingTime());
        assert.equal(86400, await vc.closingTime());
        assert.equal(0, await vc.whiteListTimelock());
        assert.equal(0, await vc.accTxsInDay());
        assert.equal(0, await vc.accAmountInDay());
        assert.equal(0, await vc.dayOfLastTx());

        assert.equal(0, await vc.lowestAcceptableBalance());
        assert.equal(0, await vc.highestAcceptableBalance());
    });

    it("Initialization sets parameters and generates authorization log", async () => {
        await vc.initializeVault(
            1, // _dailyAmountLimit,
            2, // _dailyTxnLimit,
            3, // _txnAmountLimit,
            5, // _highestAcceptableBalance,
            4, // _lowestAcceptableBalance,
            6, // _whiteListTimelock,
            7, // _openingTime,
            8,  // _closingTime
        );

        assert.equal(false, await vc.canceled());
        assert.equal(1, await vc.dailyAmountLimit());
        assert.equal(2, await vc.dailyTxnLimit());
        assert.equal(3, await vc.txnAmountLimit());
        assert.equal(4, await vc.lowestAcceptableBalance());
        assert.equal(5, await vc.highestAcceptableBalance());
        assert.equal(6, await vc.whiteListTimelock());
        assert.equal(7, await vc.openingTime());
        assert.equal(8, await vc.closingTime());
    });

    it("Vault limits are changed and logged", async () => {
        await vc.initializeVault(
            1, // _dailyAmountLimit,
            2, // _dailyTxnLimit,
            3, // _txnAmountLimit,
            5, // _highestAcceptableBalance,
            4, // _lowestAcceptableBalance,
            6, // _whiteListTimelock,
            7, // _openingTime,
            8,  // _closingTime
        );

        const result = await vc.setVaultLimits(
            11, // _dailyAmountLimit,
            12, // _dailyTxnLimit,
            13, // _txnAmountLimit,
            17, // _openingTime,
            18, // _closingTime,
            16, // _whiteListTimelock,
            15, // _highestAcceptableBalance,
            14,  // _lowestAcceptableBalance
        );

        assert.equal(11, (await vc.dailyAmountLimit()).toNumber());
        assert.equal(12, (await vc.dailyTxnLimit()).toNumber());
        assert.equal(13, (await vc.txnAmountLimit()).toNumber());
        assert.equal(14, (await vc.lowestAcceptableBalance()).toNumber());
        assert.equal(15, (await vc.highestAcceptableBalance()).toNumber());
        assert.equal(16, (await vc.whiteListTimelock()).toNumber());
        assert.equal(17, (await vc.openingTime()).toNumber());
        assert.equal(18, (await vc.closingTime()).toNumber());

        const logs = filterCoverageTopics(result.logs);
        assert.equal(logs.length, 1);
        assert.equal(logs[ 0 ].event, "VaultsLimitChanged");
        assert.equal(logs[ 0 ].args.dailyAmountLimit, "11");
        assert.equal(logs[ 0 ].args.dailyTxnLimit, "12");
        assert.equal(logs[ 0 ].args.txnAmountLimit, "13");
        assert.equal(logs[ 0 ].args.openingTime, "17");
        assert.equal(logs[ 0 ].args.closingTime, "18");
        assert.equal(logs[ 0 ].args.whiteListTimelock, "16");
        assert.equal(logs[ 0 ].args.highestAcceptableBalance, "15");
        assert.equal(logs[ 0 ].args.lowestAcceptableBalance, "14");
    });
});
