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

contract("VaultController:Suite1e:childs", (accounts) => {
    const {
        0: owner,
        1: escapeHatchCaller,
        2: escapeHatchDestination,
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

    // / -- child initialization --------------------------------------------------

    it("When a child vault is created an event is generated", async () => {
        await initializeVault();

        const result = await vc.createChildVault("child1");
        const logs = filterCoverageTopics(result.logs);
        assert.equal(logs.length, 1);
        assert.equal(logs[ 0 ].event, "NewVault");
    });

    it("Cannot initialize child vault with bigger dailyAmountLimit whan parent ", async () => {
        await initializeVault();

        const result = await vc.createChildVault("child");
        const logs = filterCoverageTopics(result.logs);
        const vaultControllerId = logs[ 0 ].args.vaultControllerId.toNumber();
        try {
            await vc.initializeChildVault(
                vaultControllerId, owner, 11, 2, 8, 20, 5, days(1), 6, 7,
            );
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Cannot initialize child vault with bigger dailyTxnLimit whan parent ", async () => {
        await initializeVault();

        const result = await vc.createChildVault("child");
        const logs = filterCoverageTopics(result.logs);
        const vaultControllerId = logs[ 0 ].args.vaultControllerId.toNumber();
        try {
            await vc.initializeChildVault(
                vaultControllerId, owner, 10, 3, 8, 20, 5, days(1), 6, 7,
            );
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Cannot initialize child vault with bigger txnAmountLimit whan parent", async () => {
        await initializeVault();

        const result = await vc.createChildVault("child");
        const logs = filterCoverageTopics(result.logs);
        const vaultControllerId = logs[ 0 ].args.vaultControllerId.toNumber();
        try {
            await vc.initializeChildVault(
                vaultControllerId, owner, 10, 2, 9, 20, 5, days(1), 6, 7,
            );
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Cannot initialize child vault with bigger highestAcceptableBalance whan parent", async () => {
        await initializeVault();

        const result = await vc.createChildVault("child");
        const logs = filterCoverageTopics(result.logs);
        const vaultControllerId = logs[ 0 ].args.vaultControllerId.toNumber();
        try {
            await vc.initializeChildVault(
                vaultControllerId, owner, 10, 2, 8, 21, 5, days(1), 6, 7,
            );
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Cannot initialize child vault with lowestAcceptableBalance>highestAcceptableBalance whan parent", async () => {
        await initializeVault();

        const result = await vc.createChildVault("child");
        const logs = filterCoverageTopics(result.logs);
        const vaultControllerId = logs[ 0 ].args.vaultControllerId.toNumber();
        try {
            await vc.initializeChildVault(
                vaultControllerId, owner, 10, 2, 8, 20, 21, days(1), 6, 7,
            );
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Cannot initialize child vault with openingTime >= 86400 whan parent", async () => {
        await initializeVault();

        const result = await vc.createChildVault("child");
        const logs = filterCoverageTopics(result.logs);
        const vaultControllerId = logs[ 0 ].args.vaultControllerId.toNumber();
        try {
            await vc.initializeChildVault(
                vaultControllerId, owner, 10, 2, 8, 20, 5, days(1), 86400, 7,
            );
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Cannot initialize child vault with closingTime > 86400 whan parent", async () => {
        await initializeVault();

        const result = await vc.createChildVault("child");
        const logs = filterCoverageTopics(result.logs);
        const vaultControllerId = logs[ 0 ].args.vaultControllerId.toNumber();
        try {
            await vc.initializeChildVault(
                vaultControllerId, owner, 10, 2, 8, 20, 5, days(1), 6, 86401,
            );
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Cannot initialize child vault with whiteListTimelock smaller whan parent", async () => {
        await initializeVault();

        const result = await vc.createChildVault("child");
        const logs = filterCoverageTopics(result.logs);
        const vaultControllerId = logs[ 0 ].args.vaultControllerId.toNumber();
        try {
            await vc.initializeChildVault(
                vaultControllerId, owner, 10, 2, 8, 20, 5, days(1) - 1, 6, 7,
            );
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    // / --- child set vault limits --------------------------------------------------

    it("Cannot setlimits child vault with bigger dailyAmountLimit whan parent ", async () => {
        await initializeVault();

        const result = await vc.createChildVault("child");
        const logs = filterCoverageTopics(result.logs);
        const vaultControllerId = logs[ 0 ].args.vaultControllerId.toNumber();

        await vc.initializeChildVault(vaultControllerId, owner, 10, 2, 8, 20, 5, days(1), 6, 7);
        try {
            await vc.setChildVaultLimits(
                vaultControllerId, 11, 2, 8, 6, 7, days(1), 20, 5,
            );
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Cannot setlimits child vault with bigger dailyTxnLimit whan parent ", async () => {
        await initializeVault();

        const result = await vc.createChildVault("child");
        const logs = filterCoverageTopics(result.logs);
        const vaultControllerId = logs[ 0 ].args.vaultControllerId.toNumber();
        await vc.initializeChildVault(vaultControllerId, owner, 10, 2, 8, 20, 5, days(1), 6, 7);

        try {
            await vc.setChildVaultLimits(
                vaultControllerId, 10, 3, 8, 6, 7, days(1), 20, 5,
            );
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Cannot setlimits child vault with bigger txnAmountLimit whan parent", async () => {
        await initializeVault();

        const result = await vc.createChildVault("child");
        const logs = filterCoverageTopics(result.logs);
        const vaultControllerId = logs[ 0 ].args.vaultControllerId.toNumber();
        await vc.initializeChildVault(vaultControllerId, owner, 10, 2, 8, 20, 5, days(1), 6, 7);

        try {
            await vc.setChildVaultLimits(
                vaultControllerId, 10, 2, 9, 6, 7, days(1), 20, 5,
            );
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Cannot setlimits child vault with bigger highestAcceptableBalance whan parent", async () => {
        await initializeVault();

        const result = await vc.createChildVault("child");
        const logs = filterCoverageTopics(result.logs);
        const vaultControllerId = logs[ 0 ].args.vaultControllerId.toNumber();
        await vc.initializeChildVault(vaultControllerId, owner, 10, 2, 8, 20, 5, days(1), 6, 7);

        try {
            await vc.setChildVaultLimits(
                vaultControllerId, 10, 2, 8, 6, 7, days(1), 21, 5,
            );
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Cannot setlimits child vault with lowestAcceptableBalance>highestAcceptableBalance whan parent", async () => {
        await initializeVault();

        const result = await vc.createChildVault("child");
        const logs = filterCoverageTopics(result.logs);
        const vaultControllerId = logs[ 0 ].args.vaultControllerId.toNumber();
        await vc.initializeChildVault(vaultControllerId, owner, 10, 2, 8, 20, 5, days(1), 6, 7);

        try {
            await vc.setChildVaultLimits(
                vaultControllerId, 10, 2, 8, 6, 7, days(1), 20, 21,
            );
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Cannot setlimits child vault with openingTime >= 86400 whan parent", async () => {
        await initializeVault();

        const result = await vc.createChildVault("child");
        const logs = filterCoverageTopics(result.logs);
        const vaultControllerId = logs[ 0 ].args.vaultControllerId.toNumber();
        await vc.initializeChildVault(vaultControllerId, owner, 10, 2, 8, 20, 5, days(1), 6, 7);

        try {
            await vc.setChildVaultLimits(
                vaultControllerId, 10, 2, 8, 86400, 7, days(1), 20, 5,
            );
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Cannot setlimits child vault with closingTime > 86400 whan parent", async () => {
        await initializeVault();

        const result = await vc.createChildVault("child");
        const logs = filterCoverageTopics(result.logs);
        const vaultControllerId = logs[ 0 ].args.vaultControllerId.toNumber();
        await vc.initializeChildVault(vaultControllerId, owner, 10, 2, 8, 20, 5, days(1), 6, 7);

        try {
            await vc.setChildVaultLimits(
                vaultControllerId, 10, 2, 8, 6, 86401, days(1), 20, 5,
            );
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Cannot setlimits child vault with whiteListTimelock smaller whan parent", async () => {
        await initializeVault();

        const result = await vc.createChildVault("child");
        const logs = filterCoverageTopics(result.logs);
        const vaultControllerId = logs[ 0 ].args.vaultControllerId.toNumber();
        await vc.initializeChildVault(vaultControllerId, owner, 10, 2, 8, 20, 5, days(1), 6, 7);
        try {
            await vc.setChildVaultLimits(
                vaultControllerId, 10, 2, 8, 6, 7, days(1) - 1, 20, 5,
            );
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });
});
