import ethConnector from "ethconnector";
import assert from "assert"; // node.js core module
import async from "async";
import path from "path";

import VaultController from "../js/vaultcontroller";

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

    let mainVaultAddr;

    before((done) => {
        const opts = { accounts: [
            { index: 0, balance: "0x" + (new web3.BigNumber(web3.toWei(1000))).toString(16) },
            { index: 1, balance: "0x" + (new web3.BigNumber(web3.toWei(1000))).toString(16) },
            { index: 2, balance: "0x" + (new web3.BigNumber(web3.toWei(1000))).toString(16) },
            { index: 3, balance: "0x" + (new web3.BigNumber(web3.toWei(1000))).toString(16) },
            { index: 4, balance: "0x" + (new web3.BigNumber(web3.toWei(1000))).toString(16) },
            { index: 5, balance: "0x" + (new web3.BigNumber(web3.toWei(1000))).toString(16) },
            { index: 6, balance: "0x" + (new web3.BigNumber(web3.toWei(1000))).toString(16) },
            { index: 7, balance: "0x" + (new web3.BigNumber(web3.toWei(1000))).toString(16) },
            { index: 8, balance: "0x" + (new web3.BigNumber(web3.toWei(1000))).toString(16) },
            { index: 9, balance: "0x" + (new web3.BigNumber(web3.toWei(1000))).toString(16) },
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
    it("should compile contracts", (done) => {
        ethConnector.compile(
            path.join(__dirname, "../contracts/VaultController.sol"),
            path.join(__dirname, "../contracts/VaultController.sol.js"),
            done,
        );
    }).timeout(20000);
    it("should deploy all the contracts ", (done) => {
        VaultController.deploy(ethConnector.web3, {
            from: owner,
            name: "Main Vault",
            baseToken: 0,
            escapeHatchCaller,
            escapeHatchDestination,
            parentVaultController: 0,
            parentVault,
            dailyLimit: ethConnector.web3.toWei(100),
            dailyTransactions: 5,
            transactionLimit: ethConnector.web3.toWei(50),
            topThreshold: ethConnector.web3.toWei(500),
            bottomThreshold: ethConnector.web3.toWei(500),
            whiteListTimelock: 86400,
            verbose: false,
        }, (err, _vaultController) => {
            assert.ifError(err);
            assert.ok(_vaultController.contract.address);
            vaultController = _vaultController;
            done();
        });
    }).timeout(20000);
    it("Should check main ", (done) => {
        vaultController.getState((err, st) => {
            assert.ifError(err);
            assert.equal(owner, st.owner);
            mainVaultAddr = st.mainVault.address;
            done();
        });
    }).timeout(6000);
    it("Should send to the main vault", (done) => {
        web3.eth.sendTransaction({
            from: owner,
            to: mainVaultAddr,
            value: web3.toWei(500),
            gas: 200000,
        }, (err) => {
            assert.ifError(err);
            web3.eth.getBalance(mainVaultAddr, (err2, res) => {
                assert.ifError(err2);
                assert.equal(res, web3.toWei(500));
                done();
            });
        });
    });
    it("Should payed be done ", (done) => {
        vaultController.getState((err, st) => {
            assert.ifError(err);
            assert.equal(st.mainVault.balance, web3.toWei(500));
            done();
        });
    }).timeout(6000);
    it("Should add a project", (done) => {
        vaultController.createProject({
            name: "Project 1",
            admin,
            maxDailyLimit: ethConnector.web3.toWei(100),
            maxDailyTransactions: 5,
            maxTransactionLimit: ethConnector.web3.toWei(10),
            maxTopThreshold: ethConnector.web3.toWei(20),
            minWhiteListTimelock: 86400,
            verbose: false,
        }, (err) => {
            assert.ifError(err);
            done();
        });
    }).timeout(20000);
    it("Should read test", (done) => {
        vaultController.contract.test1((err, res) => {
            assert.ifError(err);
            console.log("test1: " + res);
            done();
        });
    });
    it("Should project be added ", (done) => {
        vaultController.getState((err, st) => {
            console.log(JSON.stringify(st,null,2));
            assert.ifError(err);
            assert.equal(st.childProjects.length, 1);
            assert.equal(st.childProjects[ 0 ].name, "Project 1");
            assert.equal(st.childProjects[ 0 ].mainVault.balance, web3.toWei(20));
            assert.equal(st.mainVault.balance, web3.toWei(480));
            done();
        });
    }).timeout(10000);
});
