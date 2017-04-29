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

contract("VaultController:Suite1b:spenders", (accounts) => {
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

    it("Cannot authorize an spender with _openingTime >= 86400", async () => {
        await initializeVault();
        try {
            await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, 86400, 6);
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Cannot authorize an spender with _closingTime > 86400", async () => {
        await initializeVault();
        try {
            await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, 7, 86401);
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

    it("If an existing spender is added, data is updated", async () => {
        await initializeVault();

        await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, 7, 6);

        const startingNumberOfSpenders = (await vc.numberOfSpenders()).toNumber();
        await vc.authorizeSpender("SPENDER", spender, 9, 1, 7, 6, 7);
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

    it("An existing spender cannot be removed twice", async () => {
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
