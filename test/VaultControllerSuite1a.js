// This test suite corresponds to the old Vault test suite

/* global artifacts */
/* global contract */
/* global web3 */
/* global assert */

const filterCoverageTopics = require("./helpers/filterCoverageTopics.js");
const days = require("./helpers/days.js");
const assertJump = require("./helpers/assertJump.js");

const VaultControllerFactory = artifacts.require("../contracts/VaultControllerFactory.sol");
const VaultFactory = artifacts.require("../contracts/VaultFactory.sol");
const VaultController = artifacts.require("../contracts/VaultController.sol");

contract("VaultController", (accounts) => {
    const {
        1: escapeHatchCaller,
        2: escapeHatchDestination,
        4: spender,
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

    const initializeVault = () => vc.initializeVault(
            10, // _dailyAmountLimit,
             2, // _dailyTxnLimit,
             8, // _txnAmountLimit,
            20, // _highestAcceptableBalance,
             5, // _lowestAcceptableBalance,
        days(1), // _whiteListTimelock,
             7, // _openingTime,
             6, // _closingTime
        );

    // / -- construction --------------------------------------------------

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

    // / -- initialization --------------------------------------------------

    it("Non-owner cannot initialize the vault", async () => {
        try {
            await vc.initializeVault(
                10, // _dailyAmountLimit,
                 2, // _dailyTxnLimit,
                 8, // _txnAmountLimit,
                20, // _highestAcceptableBalance,
                 5, // _lowestAcceptableBalance,
            days(1), // _whiteListTimelock,
                 7, // _openingTime,
                 6, // _closingTime
                { from: escapeHatchCaller },
            );
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Initialization sets parameters", async () => {
        await initializeVault();

        assert.equal(false, await vc.canceled());
        assert.equal(10, await vc.dailyAmountLimit());
        assert.equal(2, await vc.dailyTxnLimit());
        assert.equal(8, await vc.txnAmountLimit());
        assert.equal(5, await vc.lowestAcceptableBalance());
        assert.equal(20, await vc.highestAcceptableBalance());
        assert.equal(days(1), await vc.whiteListTimelock());
        assert.equal(7, await vc.openingTime());
        assert.equal(6, await vc.closingTime());
    });

    // / -- setVaultLimits --------------------------------------------------

    it("Vault limits are changed and logged", async () => {
        await initializeVault();

        const result = await vc.setVaultLimits(
            11, // _dailyAmountLimit,
            12, // _dailyTxnLimit,
            13, // _txnAmountLimit,
            17, // _openingTime,
            18, // _closingTime,
            16, // _whiteListTimelock,
            15, // _highestAcceptableBalance,
            14, // _lowestAcceptableBalance
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

    it("Non-owner cannot setVaultLimits of root vault", async () => {
        await initializeVault();

        try {
            await vc.setVaultLimits(
                11, // _dailyAmountLimit,
                12, // _dailyTxnLimit,
                13, // _txnAmountLimit,
                17, // _openingTime,
                18, // _closingTime,
                16, // _whiteListTimelock,
                15, // _highestAcceptableBalance,
                14, // _lowestAcceptableBalance
               { from: escapeHatchCaller },
            );
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    // / -- cancelVault --------------------------------------------------

    it("Initialized vault can be cancelled", async () => {
        await initializeVault();
        await vc.cancelVault();
        assert.equal(true, await vc.canceled());
    });

    it("Vault limits cannot be changed when cancelled", async () => {
        await initializeVault();
        await vc.cancelVault();

        try {
            await vc.setVaultLimits(
                11, // _dailyAmountLimit,
                12, // _dailyTxnLimit,
                13, // _txnAmountLimit,
                17, // _openingTime,
                18, // _closingTime,
                16, // _whiteListTimelock,
                15, // _highestAcceptableBalance,
                14, // _lowestAcceptableBalance
            );
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    xit("A cancelled with founds are returned to xxxxxxxx and log is generated", async () => {
    });

    // / -- spenders --------------------------------------------------

    it("Cannot authorize an spender with more dailyAmountLimit than vault", async () => {
        await initializeVault();
        try {
            await vc.authorizeSpender("SPENDER", spender, 11, 2, 8, 7, 6);
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Cannot authorize an spender with more dailyTxnLimit than vault", async () => {
        await initializeVault();
        try {
            await vc.authorizeSpender("SPENDER", spender, 10, 3, 8, 7, 6);
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Cannot authorize an spender with more txnAmountLimit than vault", async () => {
        await initializeVault();
        try {
            await vc.authorizeSpender("SPENDER", spender, 10, 2, 9, 7, 6);
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("When an spender is authorized, numberOfSpenders is incremented", async () => {
        await initializeVault();

        const startingNumberOfSpenders = (await vc.numberOfSpenders()).toNumber();

        await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, 7, 6);

        const endingNumberOfSpenders = (await vc.numberOfSpenders()).toNumber();

        assert.equal(1, endingNumberOfSpenders - startingNumberOfSpenders);
    });

    it("When an spender is authorized, event is logged", async () => {
        await initializeVault();

        const result = await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, 7, 6);

        const logs = filterCoverageTopics(result.logs);
        assert.equal(logs.length, 1);
        assert.equal(logs[ 0 ].event, "SpenderAuthorized");
        assert.equal(logs[ 0 ].args.idSpender, "0");
        assert.equal(logs[ 0 ].args.spender, spender);
    });

    xit("If an existing spender is added, data is updated", async () => {
        await initializeVault();

        await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, 7, 6);

        const startingNumberOfSpenders = (await vc.numberOfSpenders()).toNumber();
        await vc.authorizeSpender("SPENDER", spender, 9, 1, 7, 6, 7);
        const endingNumberOfSpenders = (await vc.numberOfSpenders()).toNumber();

        assert.equal(0, endingNumberOfSpenders - startingNumberOfSpenders);
    });

    xit("An existing spender can be removed", async () => {
        await initializeVault();

        const startingNumberOfSpenders = (await vc.numberOfSpenders()).toNumber();
        await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, 7, 6);
        await vc.removeAuthorizedSpender(spender);
        const endingNumberOfSpenders = (await vc.numberOfSpenders()).toNumber();

        assert.equal(0, endingNumberOfSpenders - startingNumberOfSpenders);
    });

    it("Log is generated on removing an spender", async () => {
        await initializeVault();

        await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, 7, 6);
        const result = await vc.removeAuthorizedSpender(spender);

        const logs = filterCoverageTopics(result.logs);
        assert.equal(logs.length, 1);
        assert.equal(logs[ 0 ].event, "SpenderRemoved");
        assert.equal(logs[ 0 ].args.spender, spender);
    });

    xit("An existing spender cannot be removed twice", async () => {
        await initializeVault();

        await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, 7, 6);
        await vc.removeAuthorizedSpender(spender);
        try {
            await vc.removeAuthorizedSpender(spender);
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });
});