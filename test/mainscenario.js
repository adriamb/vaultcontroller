const ethConnector = require("ethconnector");
const assert = require("assert"); // node.js core module
const async = require("async");
const path = require("path");

const VaultController = require("../js/vaultcontroller");

describe("Normal Scenario test for VaultController", () => {
    let vaultController;
    let owner;
    let escapeHatchCaller;
    let escapeHatchDestination;
    let securityGuard;
    let spender;
    let recipient;
    let parentVault;
    let admin;
    const web3 = ethConnector.web3;

    let primaryVaultAddr;

    before((done) => {
        const opts = { accounts: [
            { index: 0, balance: `0x${ (new web3.BigNumber(web3.toWei(1000))).toString(16) }` },
            { index: 1, balance: `0x${ (new web3.BigNumber(web3.toWei(1000))).toString(16) }` },
            { index: 2, balance: `0x${ (new web3.BigNumber(web3.toWei(1000))).toString(16) }` },
            { index: 3, balance: `0x${ (new web3.BigNumber(web3.toWei(1000))).toString(16) }` },
            { index: 4, balance: `0x${ (new web3.BigNumber(web3.toWei(1000))).toString(16) }` },
            { index: 5, balance: `0x${ (new web3.BigNumber(web3.toWei(1000))).toString(16) }` },
            { index: 6, balance: `0x${ (new web3.BigNumber(web3.toWei(1000))).toString(16) }` },
            { index: 7, balance: `0x${ (new web3.BigNumber(web3.toWei(1000))).toString(16) }` },
            { index: 8, balance: `0x${ (new web3.BigNumber(web3.toWei(1000))).toString(16) }` },
            { index: 9, balance: `0x${ (new web3.BigNumber(web3.toWei(1000))).toString(16) }` },
        ] };
        ethConnector.init("testrpc", opts, (err) => {
            if (err) { done(err); return; }
            owner = ethConnector.accounts[ 0 ];
            escapeHatchCaller = ethConnector.accounts[ 1 ];
            escapeHatchDestination = ethConnector.accounts[ 2 ];
            securityGuard = ethConnector.accounts[ 3 ];
            spender = ethConnector.accounts[ 4 ];
            recipient = ethConnector.accounts[ 5 ];
            parentVault = ethConnector.accounts[ 6 ];
            admin = ethConnector.accounts[ 7 ];
            done();
        });
    });
    it("should deploy all the contracts ", (done) => {
        VaultController.deploy(ethConnector.web3, {
            from: owner,
            name: "Main Vault",
            baseToken: 0,
            escapeHatchCaller,
            escapeHatchDestination,
            parentVaultController: 0,
            parentVault,
            dailyAmountLimit: ethConnector.web3.toWei(100),
            dailyTxnLimit: 5,
            txnAmountLimit: ethConnector.web3.toWei(50),
            highestAcceptableBalance: ethConnector.web3.toWei(500),
            lowestAcceptableBalance: ethConnector.web3.toWei(50),
            whiteListTimelock: 86400,
            openingTime: 0,
            closingTime: 86400,
            verbose: false,
        }, (err, _vaultController) => {
            assert.ifError(err);
            assert.ok(_vaultController.contract.address);
            vaultController = _vaultController;
            done();
        });
    }).timeout(20000);
    it("Should primary vault be created", (done) => {
        vaultController.getState((err, st) => {
            assert.ifError(err);
            assert.equal(owner, st.owner);
            primaryVaultAddr = st.primaryVault.address;
            done();
        });
    }).timeout(6000);
    it("Should send to the primary vault", (done) => {
        web3.eth.sendTransaction({
            from: owner,
            to: primaryVaultAddr,
            value: web3.toWei(500),
            gas: 200000,
        }, (err) => {
            assert.ifError(err);
            web3.eth.getBalance(primaryVaultAddr, (err2, res) => {
                assert.ifError(err2);
                assert.equal(res, web3.toWei(500));
                done();
            });
        });
    });
    it("Should balance of primary vault be decresed", (done) => {
        vaultController.getState((err, st) => {
            assert.ifError(err);
            assert.equal(st.primaryVault.balance, web3.toWei(500));
            done();
        });
    }).timeout(6000);
    it("Should add a child vault", (done) => {
        vaultController.createChildVault({
            from: owner,
            name: "Project 1",
            admin,
            dailyAmountLimit: ethConnector.web3.toWei(100),
            dailyTxnLimit: 5,
            txnAmountLimit: ethConnector.web3.toWei(10),
            highestAcceptableBalance: ethConnector.web3.toWei(20),
            lowestAcceptableBalance: ethConnector.web3.toWei(2),
            whiteListTimelock: 86400,
            openingTime: 0,
            closingTime: 86400,
            verbose: false,
        }, (err) => {
            assert.ifError(err);
            done();
        });
    }).timeout(20000000);
    it("Should read test", (done) => {
        vaultController.contract.test1((err, res) => {
            assert.ifError(err);
//            console.log("test1: " + res);
            done();
        });
    });
    it("Should project be added ", (done) => {
        vaultController.getState((err, st) => {
//            console.log(JSON.stringify(st,null,2));
            assert.ifError(err);
            assert.equal(st.childVaults.length, 1);
            assert.equal(st.childVaults[ 0 ].name, "Project 1");
            assert.equal(st.childVaults[ 0 ].primaryVault.balance, web3.toWei(20));
            assert.equal(st.primaryVault.balance, web3.toWei(480));
            done();
        });
    }).timeout(10000);
});
