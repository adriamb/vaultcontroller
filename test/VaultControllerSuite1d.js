// This test suite corresponds to the old Vault test suite

/* global artifacts */
/* global contract */
/* global web3 */
/* global assert */

const wei = require("./helpers/wei.js");
const days = require("./helpers/days.js");
const hours = require("./helpers/hours.js");
const assertJump = require("./helpers/assertJump.js");
const timeTravel = require("./helpers/timeTravel.js");

const VaultControllerFactory = artifacts.require("../contracts/VaultControllerFactory.sol");
const VaultFactory = artifacts.require("../contracts/VaultFactory.sol");
const VaultController = artifacts.require("../contracts/VaultController.sol");

contract("VaultController:Suite1d", (accounts) => {
    const {
        0: owner,
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

    const initializeVault = async () => vc.initializeVault(
            11, // _dailyAmountLimit,
             3, // _dailyTxnLimit,
             9, // _txnAmountLimit,
            20, // _highestAcceptableBalance,
             5, // _lowestAcceptableBalance,
        days(1), // _whiteListTimelock,
             7, // _openingTime,
             6, // _closingTime
        );

    // / -- transfer --------------------------------------------------

    it("A non spender cannot spend founds", async () => {
        await initializeVault();

        try {
            await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(1));
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Transfer is done if all conditions are met", async () => {
        await initializeVault();

        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 11, 3, 9, 0, 86400);
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");

        const beginRecipientBalance = web3.eth.getBalance(recipient);
        await timeTravel(days(1));
        await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(8), { from: spender });
        const endRecipientBalance = web3.eth.getBalance(recipient);

        assert.equal(8, endRecipientBalance.minus(beginRecipientBalance).toNumber());
    });

    it("A cancelled vault cannot transfer founds", async () => {
        await initializeVault();

        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 11, 3, 9, 0, 86400);
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");

        await vc.cancelVault();
        assert.equal(true, await vc.canceled());

        await timeTravel(days(1));
        try {
            await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(8), { from: spender });
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Cannot transfer if whiteListTimelock is not reached", async () => {
        await initializeVault();

        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 11, 3, 9, 0, 86400);
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");

        try {
            await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(8), { from: spender });
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Cannot transfer if whiteListTimelock if spender is unauthorized", async () => {
        await initializeVault();

        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 11, 3, 9, 0, 86400);
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");
        await vc.removeAuthorizedSpender(spender);

        try {
            await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(8), { from: spender });
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Cannot transfer if whiteListTimelock if recipient is unauthorized", async () => {
        await initializeVault();

        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 11, 3, 9, 0, 86400);
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");
        await vc.removeAuthorizedRecipient(spender, recipient);

        try {
            await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(8), { from: spender });
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    // / -- spender limits & time windows

    it("Check transfer cannot be done if spender dailyAmountLimit is reached", async () => {
        await initializeVault();

        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, 0, 86400);
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");

        await timeTravel(days(1));
        await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(8), { from: spender });
        try {
            await vc.sendToAuthorizedRecipient("TRNF1", "REF2", recipient, wei(3), { from: spender });
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Check transfer can be done when spender dailyAmountLimit is reset", async () => {
        await initializeVault();
        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, 0, 86400);
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");

        await timeTravel(days(1));
        await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(8), { from: spender });

        await timeTravel(days(1));
        await vc.sendToAuthorizedRecipient("TRNF1", "REF2", recipient, wei(3), { from: spender });
    });

    it("Check transfer cannot be done if spender dailyTxnLimit is reached", async () => {
        await initializeVault();

        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, 0, 86400);
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");

        await timeTravel(days(1));

        await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(1), { from: spender });
        await vc.sendToAuthorizedRecipient("TRNF1", "REF2", recipient, wei(1), { from: spender });
        try {
            await vc.sendToAuthorizedRecipient("TRNF1", "REF3", recipient, wei(1), { from: spender });
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Check transfer can be done when spender dailyTxnLimit is reset", async () => {
        await initializeVault();

        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, 0, 86400);
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");

        await timeTravel(days(1));
        await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(1), { from: spender });
        await vc.sendToAuthorizedRecipient("TRNF1", "REF2", recipient, wei(1), { from: spender });

        await timeTravel(days(1));
        await vc.sendToAuthorizedRecipient("TRNF1", "REF3", recipient, wei(1), { from: spender });
    });

    it("Check transfer cannot be done if spender txnAmountLimit is reached", async () => {
        await initializeVault();

        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, 0, 86400);
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");

        await timeTravel(days(1));
        try {
            await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(9), { from: spender });
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Check transfer with narrow spender time window {openingTime<closingTime}", async () => {
        const result = await initializeVault();
        const actualTime = web3.eth.getBlock(result.receipt.blockNumber).timestamp % 86400;

        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, hours(11), hours(13));
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");

        await timeTravel((hours(48) - actualTime) + hours(12)); // next next day, 12pm
        await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(1), { from: spender });
    });

    it("Check cannot transfer after narrow spender time window  {openingTime<closingTime}", async () => {
        const result = await initializeVault();
        const actualTime = web3.eth.getBlock(result.receipt.blockNumber).timestamp % 86400;

        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, hours(11), hours(13));
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");

        await timeTravel((hours(48) - actualTime) + hours(14)); // next next day, 12pm
        try {
            await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(1), { from: spender });
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Check cannot transfer before spender narrow time window {openingTime<closingTime}", async () => {
        const result = await initializeVault();
        const actualTime = web3.eth.getBlock(result.receipt.blockNumber).timestamp % 86400;

        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, hours(11), hours(13));
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");

        await timeTravel((hours(48) - actualTime) + hours(10)); // next next day, 10am
        try {
            await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(1), { from: spender });
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Check transfer with spender narrow time window {openingTime>closingTime}", async () => {
        const result = await initializeVault();
        const actualTime = web3.eth.getBlock(result.receipt.blockNumber).timestamp % 86400;

        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, hours(22), hours(2));
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");

        await timeTravel((hours(48) - actualTime) + hours(23)); // next next day, 23pm
        await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(1), { from: spender });
    });

    it("Check cannot transfer after spender narrow time window {openingTime>closingTime}", async () => {
        const result = await initializeVault();
        const actualTime = web3.eth.getBlock(result.receipt.blockNumber).timestamp % 86400;

        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, hours(22), hours(2));
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");

        await timeTravel((hours(48) - actualTime) + hours(3)); // next next day, 3am
        try {
            await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(1), { from: spender });
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Check cannot transfer before spender narrow time window {openingTime>closingTime}", async () => {
        const result = await initializeVault();
        const actualTime = web3.eth.getBlock(result.receipt.blockNumber).timestamp % 86400;

        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 10, 2, 8, hours(22), hours(2));
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");

        await timeTravel((hours(48) - actualTime) + hours(21)); // next next day, 2am
        try {
            await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(1), { from: spender });
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    // / -- vaultcontroller limits & time windows

    it("Check transfer cannot be done if vaultcontroller dailyAmountLimit is reached", async () => {
        await initializeVault();

        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 11, 3, 9, 0, 86400);
        await vc.setVaultLimits(10, 2, 8, 0, 86400, days(1), 20, 5);
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");

        await timeTravel(days(1));
        await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(8), { from: spender });
        try {
            await vc.sendToAuthorizedRecipient("TRNF1", "REF2", recipient, wei(3), { from: spender });
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Check transfer can be done when vaultcontroller dailyAmountLimit is reset", async () => {
        await initializeVault();
        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 11, 3, 9, 0, 86400);
        await vc.setVaultLimits(10, 2, 8, 0, 86400, days(1), 20, 5);
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");

        await timeTravel(days(1));
        await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(8), { from: spender });

        await timeTravel(days(1));
        await vc.sendToAuthorizedRecipient("TRNF1", "REF2", recipient, wei(3), { from: spender });
    });

    it("Check transfer cannot be done if vaultcontroller dailyTxnLimit is reached", async () => {
        await initializeVault();

        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 11, 3, 9, 0, 86400);
        await vc.setVaultLimits(10, 2, 8, 0, 86400, days(1), 20, 5);
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");

        await timeTravel(days(1));
        await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(1), { from: spender });
        await vc.sendToAuthorizedRecipient("TRNF1", "REF2", recipient, wei(1), { from: spender });
        try {
            await vc.sendToAuthorizedRecipient("TRNF1", "REF3", recipient, wei(1), { from: spender });
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Check transfer can be done when vaultcontroller dailyTxnLimit is reset", async () => {
        await initializeVault();

        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 11, 3, 9, 0, 86400);
        await vc.setVaultLimits(10, 2, 8, 0, 86400, days(1), 20, 5);
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");

        await timeTravel(days(1));
        await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(1), { from: spender });
        await vc.sendToAuthorizedRecipient("TRNF1", "REF2", recipient, wei(1), { from: spender });

        await timeTravel(days(1));
        await vc.sendToAuthorizedRecipient("TRNF1", "REF3", recipient, wei(1), { from: spender });
    });

    it("Check transfer cannot be done if vaultcontroller txnAmountLimit is reached", async () => {
        await initializeVault();

        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 11, 3, 9, 0, 86400);
        await vc.setVaultLimits(10, 2, 8, 0, 86400, days(1), 20, 5);
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");

        await timeTravel(days(1));
        try {
            await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(9), { from: spender });
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Check transfer with narrow vaultcontroller time window {openingTime<closingTime}", async () => {
        const result = await initializeVault();
        const actualTime = web3.eth.getBlock(result.receipt.blockNumber).timestamp % 86400;

        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 11, 3, 9, 0, 86400);
        await vc.setVaultLimits(10, 2, 8, hours(11), hours(13), days(1), 20, 5);
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");

        await timeTravel((hours(48) - actualTime) + hours(12)); // next next day, 12pm
        await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(1), { from: spender });
    });

    it("Check cannot transfer after narrow vaultcontroller time window  {openingTime<closingTime}", async () => {
        const result = await initializeVault();
        const actualTime = web3.eth.getBlock(result.receipt.blockNumber).timestamp % 86400;

        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 11, 3, 9, 0, 86400);
        await vc.setVaultLimits(10, 2, 8, hours(11), hours(13), days(1), 20, 5);
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");

        await timeTravel((hours(48) - actualTime) + hours(14)); // next next day, 12pm
        try {
            await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(1), { from: spender });
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Check cannot transfer before vaultcontroller narrow time window {openingTime<closingTime}", async () => {
        const result = await initializeVault();
        const actualTime = web3.eth.getBlock(result.receipt.blockNumber).timestamp % 86400;

        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 11, 3, 9, 0, 86400);
        await vc.setVaultLimits(10, 2, 8, hours(11), hours(13), days(1), 20, 5);
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");

        await timeTravel((hours(48) - actualTime) + hours(10)); // next next day, 10am
        try {
            await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(1), { from: spender });
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Check transfer with vaultcontroller narrow time window {openingTime>closingTime}", async () => {
        const result = await initializeVault();
        const actualTime = web3.eth.getBlock(result.receipt.blockNumber).timestamp % 86400;

        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 11, 3, 9, 0, 86400);
        await vc.setVaultLimits(10, 2, 8, hours(22), hours(2), days(1), 20, 5);
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");

        await timeTravel((hours(48) - actualTime) + hours(23)); // next next day, 23pm

        await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(1), { from: spender });
    });

    it("Check cannot transfer after vaultcontroller narrow time window {openingTime>closingTime}", async () => {
        const result = await initializeVault();
        const actualTime = web3.eth.getBlock(result.receipt.blockNumber).timestamp % 86400;

        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 11, 3, 9, 0, 86400);
        await vc.setVaultLimits(10, 2, 8, hours(22), hours(2), days(1), 20, 5);
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");

        await timeTravel((hours(48) - actualTime) + hours(3)); // next next day, 3am

        try {
            await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(1), { from: spender });
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Check cannot transfer before vaultcontroller narrow time window {openingTime>closingTime}", async () => {
        const result = await initializeVault();
        const actualTime = web3.eth.getBlock(result.receipt.blockNumber).timestamp % 86400;

        const vaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: vaultAddr, value: wei(1000) });

        await vc.authorizeSpender("SPENDER", spender, 11, 3, 9, 0, 86400);
        await vc.setVaultLimits(10, 2, 8, hours(22), hours(2), days(1), 20, 5);
        await vc.authorizeRecipient(spender, recipient, "RECIPIENT");

        await timeTravel((hours(48) - actualTime) + hours(21)); // next next day, 2am

        try {
            await vc.sendToAuthorizedRecipient("TRNF1", "REF1", recipient, wei(1), { from: spender });
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });
});
