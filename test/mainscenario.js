import ethConnector from "ethconnector";
import assert from "assert"; // node.js core module
import async from "async";
import path from "path";

import ProjectController from "../js/projectcontroller";

describe("Normal Scenario Vault test", () => {
    let projecBalancer;
    let owner;
    let escapeHatchCaller;
    let escapeHatchDestination;
    let securityGuard;
    let spender;
    let recipient;
    let parentVault;

    before((done) => {
        ethConnector.init("testrpc", (err) => {
            if (err) { done(err); return; }
            owner = ethConnector.accounts[ 0 ];
            escapeHatchCaller = ethConnector.accounts[ 1 ];
            escapeHatchDestination = ethConnector.accounts[ 2 ];
            securityGuard = ethConnector.accounts[ 3 ];
            spender = ethConnector.accounts[ 4 ];
            recipient = ethConnector.accounts[ 5 ];
            parentVault = ethConnector.accounts[ 6 ];
            done();
        });
    });
/*    it("should compile contracts", (done) => {
        ethConnector.compile(
            path.join(__dirname, "../contracts/ProjectBalancer.sol"),
            path.join(__dirname, "../contracts/ProjectBalancer.sol.js"),
            done,
        );
    }).timeout(20000); */
    it("should deploy all the contracts ", (done) => {
        ProjectController.deploy(ethConnector.web3, {
            from: owner,
            name: "Main Vault",
            baseToken: 0,
            escapeHatchCaller,
            escapeHatchDestination,
            parentProjectController: 0,
            parentVault,
            maxDailyLimit: ethConnector.web3.toWei(100),
            maxDailyTransactions: 5,
            maxTransactionLimit: ethConnector.web3.toWei(10),
            maxTopThreshold: ethConnector.web3.toWei(500),
            mintWhitelistTimelock: 86400,
            verbose: false,
        }, (err, _projecBalancer) => {
            assert.ifError(err);
            assert.ok(_projecBalancer.contract.address);
            projecBalancer = _projecBalancer;
            done();
        });
    }).timeout(20000);
    it("Should check main ", (done) => {
        projecBalancer.getState((err, st) => {
            assert.ifError(err);
            assert.equal(owner, st.owner);
            done();
        });
    }).timeout(6000);
});
