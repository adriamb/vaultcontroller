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

contract("VaultController:Suite1b", (accounts) => {
    const {
        1: escapeHatchCaller,
        2: escapeHatchDestination,
        4: spender,
        5: recipient,
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

    // / -- recipients --------------------------------------------------

    it("Cannot authorize a recipient from non-existent spender", async () => {
        await initializeVault();

        try {
            await vc.authorizeRecipient(spender, recipient, "RECIPIENT");
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Cannot authorize a recipient from a removed spender", async () => {
        await initializeVault();

        await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, 7, 6);
        await vc.removeAuthorizedSpender(spender);
        try {
            await vc.authorizeRecipient(spender, recipient, "RECIPIENT");
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Authorizing a recipient generates a log", async () => {
        await initializeVault();

        let result = await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, 7, 6);
        let logs = filterCoverageTopics(result.logs);
        const idSpender = logs[ 0 ].args.idSpender.toNumber();

        result = await vc.authorizeRecipient(spender, recipient, "RECIPIENT");
        logs = filterCoverageTopics(result.logs);

        assert.equal(logs.length, 1);
        assert.equal(logs[ 0 ].event, "RecipientAuthorized");
        assert.equal(logs[ 0 ].args.idSpender, idSpender);
        assert.equal(logs[ 0 ].args.idRecipient, "0");
        assert.equal(logs[ 0 ].args.recipient, recipient);
    });

    it("Authorizing a non-existent recipient increments numberOfRecipients()", async () => {
        await initializeVault();

        const result = await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, 7, 6);
        const logs = filterCoverageTopics(result.logs);
        const idSpender = logs[ 0 ].args.idSpender.toNumber();

        const startRecipientsCount = (await vc.numberOfRecipients(idSpender)).toNumber();
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");
        const endRecipientsCount = (await vc.numberOfRecipients(idSpender)).toNumber();
        assert.equal(1, endRecipientsCount - startRecipientsCount);
    });

    it("Authorizing a existent recipient does not increment numberOfRecipients()", async () => {
        await initializeVault();

        const result = await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, 7, 6);
        const logs = filterCoverageTopics(result.logs);
        const idSpender = logs[ 0 ].args.idSpender.toNumber();

        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");
        const startRecipientsCount = (await vc.numberOfRecipients(idSpender)).toNumber();
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");
        const endRecipientsCount = (await vc.numberOfRecipients(idSpender)).toNumber();
        assert.equal(0, endRecipientsCount - startRecipientsCount);
    });

    xit("Authorizing a existent recipient with a different name fails", async () => {
        await initializeVault();

        await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, 7, 6);

        await vc.authorizeRecipient(spender, recipient, "RECIPIENT1");
        try {
            await vc.authorizeRecipient(spender, recipient, "RECIPIENT2");
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Removing from a non-existing spender fails", async () => {
        await initializeVault();

        try {
            await vc.removeAuthorizedRecipient(spender, recipient);
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    xit("Removing from a non-existing recipient fails", async () => {
        await initializeVault();

        await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, 7, 6);

        try {
            await vc.removeAuthorizedRecipient(spender, recipient);
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Recipients can be accessed trough recipients() function", async () => {
        await initializeVault();

        let result = await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, 7, 6);
        let logs = filterCoverageTopics(result.logs);
        const idSpender = logs[ 0 ].args.idSpender.toNumber();

        result = await vc.authorizeRecipient(spender, recipient, "RECIPIENT");
        logs = filterCoverageTopics(result.logs);
        const idRecipient = logs[ 0 ].args.idRecipient.toNumber();

        const [ _activationTime, _name, _addr ] = await vc.recipients(idSpender, idRecipient);

        assert.notEqual(0, _activationTime);
        assert.equal("RECIPIENT", _name);
        assert.equal(recipient, _addr);
    });

    it("An existing recipient can be removed", async () => {
        await initializeVault();

        let result = await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, 7, 6);
        let logs = filterCoverageTopics(result.logs);
        const idSpender = logs[ 0 ].args.idSpender.toNumber();

        result = await vc.authorizeRecipient(spender, recipient, "RECIPIENT");
        logs = filterCoverageTopics(result.logs);
        const idRecipient = logs[ 0 ].args.idRecipient.toNumber();

        await vc.removeAuthorizedRecipient(spender, recipient);

        const [ _activationTime,, ] = await vc.recipients(idSpender, idRecipient);

        assert.equal(0, _activationTime);
    });

    it("An existing recipient cannot be removed from a removed spender", async () => {
        await initializeVault();

        await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, 7, 6);
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");
        await vc.removeAuthorizedSpender(spender);
        try {
            await vc.removeAuthorizedRecipient(spender, recipient);
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Log is generated on removing a recipient", async () => {
        await initializeVault();

        let result = await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, 7, 6);
        let logs = filterCoverageTopics(result.logs);
        const idSpender = logs[ 0 ].args.idSpender.toNumber();

        result = await vc.authorizeRecipient(spender, recipient, "RECIPIENT");
        logs = filterCoverageTopics(result.logs);
        const idRecipient = logs[ 0 ].args.idRecipient.toNumber();

        result = await vc.removeAuthorizedRecipient(spender, recipient);

        logs = filterCoverageTopics(result.logs);
        assert.equal(logs.length, 1);
        assert.equal(logs[ 0 ].event, "RecipientRemoved");
        assert.equal(logs[ 0 ].args.idSpender.toNumber(), idSpender);
        assert.equal(logs[ 0 ].args.idRecipient.toNumber(), idRecipient);
        assert.equal(logs[ 0 ].args.recipient, recipient);
    });

    xit("An existing recipient cannot be removed twice", async () => {
        await initializeVault();

        await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, 7, 6);
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");
        await vc.removeAuthorizedRecipient(spender, recipient);

        try {
            await vc.removeAuthorizedRecipient(spender, recipient);
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });
});
