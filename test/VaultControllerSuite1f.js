/* global artifacts */
/* global contract */
/* global web3 */
/* global assert */

const filterCoverageTopics = require("./helpers/filterCoverageTopics.js");
const days = require("./helpers/days.js");
const wei = require("./helpers/wei.js");

const VaultControllerFactory = artifacts.require("../contracts/VaultControllerFactory.sol");
const VaultFactory = artifacts.require("../contracts/VaultFactory.sol");
const VaultController = artifacts.require("../contracts/VaultController.sol");

contract("VaultController:Suite1e:topup,sendBackOverflow", (accounts) => {
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
            20, // _dailyAmountLimit,
             2, // _dailyTxnLimit,
            20, // _txnAmountLimit,
            20, // _highestAcceptableBalance,
             5, // _lowestAcceptableBalance,
        days(1), // _whiteListTimelock,
             7, // _openingTime,
             6, // _closingTime
        );

    it("When a contract is initialized is topped from parent vault and event is generated", async () => {
        await initializeVault();

        const rootVaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: rootVaultAddr, value: wei(1000) });

        let result = await vc.createChildVault("child");
        let logs = filterCoverageTopics(result.logs);
        const childVaultControllerId = logs[ 0 ].args.vaultControllerId.toNumber();

        result = await vc.initializeChildVault(
            childVaultControllerId, owner, 10, 2, 8, 20, 5, days(1), 0, 86400,
        );

        logs = filterCoverageTopics(result.logs);
        assert.equal(logs.length, 1);
        assert.equal(logs[ 0 ].event, "TopUpVault");
        assert.equal(logs[ 0 ].args.vaultControllerId.toNumber(), childVaultControllerId);
        assert.equal(logs[ 0 ].args.amount.toNumber(), 20);

        const childVaultController = VaultController.at(
            await vc.childVaultControllers(childVaultControllerId),
        );

        const childVaultAddr = await childVaultController.primaryVault();
        const childVaultBalance = web3.eth.getBalance(childVaultAddr);

        assert.equal(childVaultBalance.toNumber(), 20);
    });

    it("When a contract is initialized and topped up, amount is adjusted to parent balance", async () => {
        await initializeVault();

        const rootVaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: rootVaultAddr, value: wei(18) });

        const result = await vc.createChildVault("child");
        const logs = filterCoverageTopics(result.logs);
        const childVaultControllerId = logs[ 0 ].args.vaultControllerId.toNumber();

        await vc.initializeChildVault(
            childVaultControllerId, owner, 10, 2, 8, 20, 5, days(1), 0, 86400,
        );

        const childVaultController = VaultController.at(
            await vc.childVaultControllers(childVaultControllerId),
        );
        const childVaultAddr = await childVaultController.primaryVault();
        const childVaultBalance = web3.eth.getBalance(childVaultAddr);

        assert.equal(childVaultBalance.toNumber(), 18);
    });

    it("If lowestAcceptableBalance is less or equal to the current balance, vault is not topped up", async () => {
        await initializeVault();

        const rootVaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: rootVaultAddr, value: wei(1000) });

        let result = await vc.createChildVault("child");
        let logs = filterCoverageTopics(result.logs);
        const childVaultControllerId = logs[ 0 ].args.vaultControllerId.toNumber();

        result = await vc.initializeChildVault(
            childVaultControllerId, owner, 10, 2, 8, 20, 0, days(1), 0, 86400,
        );

        logs = filterCoverageTopics(result.logs);
        assert.equal(logs.length, 0);

        const childVaultController = VaultController.at(
            await vc.childVaultControllers(childVaultControllerId),
        );

        const childVaultAddr = await childVaultController.primaryVault();
        const childVaultBalance = web3.eth.getBalance(childVaultAddr);

        assert.equal(childVaultBalance.toNumber(), 0);
    });

    it("Child vault with existing founds are topped up to highestAcceptableBalance", async () => {
        await initializeVault();

        // -- initialize child vault
        let result = await vc.createChildVault("child");
        const logs = filterCoverageTopics(result.logs);
        const childVaultControllerId = logs[ 0 ].args.vaultControllerId.toNumber();

        result = await vc.initializeChildVault(
            childVaultControllerId, owner, 10, 2, 8, 20, 5, days(1), 0, 86400,
        );

        // -- Add 1000 wei to primary vault
        const rootVaultAddr = await vc.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: rootVaultAddr, value: wei(1000) });

        // -- Add 1 wei to child vault
        const childVaultController = VaultController.at(
            await vc.childVaultControllers(childVaultControllerId),
        );

        const childVaultAddr = await childVaultController.primaryVault();
        let childVaultBalance = web3.eth.getBalance(childVaultAddr);
        assert.equal(childVaultBalance.toNumber(), 0);

        web3.eth.sendTransaction({ from: owner, to: rootVaultAddr, value: wei(1) });

        // -- call child setvaultlimits to force top up
        await vc.setChildVaultLimits(
            childVaultControllerId, 10, 2, 8, 0, 86400, days(1), 20, 5,
        );

        // -- check child has 20 wei
        childVaultBalance = web3.eth.getBalance(childVaultAddr);
        assert.equal(childVaultBalance.toNumber(), 20);
    });

    it("sendBackOverflow() exceding amount is transferred to upper vault", async () => {
        await initializeVault();

        // -- initialize child vault
        let result = await vc.createChildVault("child");
        const logs = filterCoverageTopics(result.logs);
        const childVaultControllerId = logs[ 0 ].args.vaultControllerId.toNumber();

        result = await vc.initializeChildVault(
            childVaultControllerId, owner, 10, 2, 8, 20, 5, days(1), 0, 86400,
        );

        // -- Send 30 wei to child vault
        const childVaultController = VaultController.at(
            await vc.childVaultControllers(childVaultControllerId),
        );
        const childVaultAddr = await childVaultController.primaryVault();
        web3.eth.sendTransaction({ from: owner, to: childVaultAddr, value: wei(30) });

        // -- call sendBackOverflow
        await childVaultController.sendBackOverflow();

        // -- check amounts
        const rootVaultAddr = await vc.primaryVault();
        const rootVaultBalance = web3.eth.getBalance(rootVaultAddr);
        const childVaultBalance = web3.eth.getBalance(childVaultAddr);
        assert.equal(rootVaultBalance.toNumber(), 10);
        assert.equal(childVaultBalance.toNumber(), 20);
    });
});
