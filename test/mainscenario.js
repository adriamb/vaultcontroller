import ethConnector from "ethconnector";
import assert from "assert"; // node.js core module
import async from "async";
import path from "path";

import ProjectBalancer from "../js/projectbalancer";

describe("Normal Scenario Vault test", () => {
    let projecBalancer;
    let owner;
    let escapeHatchCaller;
    let escapeHatchDestination;
    let securityGuard;
    let spender;
    let recipient;

    before((done) => {
        ethConnector.init("testrpc", (err) => {
            if (err) { done(err); return; }
            owner = ethConnector.accounts[ 0 ];
            escapeHatchCaller = ethConnector.accounts[ 1 ];
            escapeHatchDestination = ethConnector.accounts[ 2 ];
            securityGuard = ethConnector.accounts[ 3 ];
            spender = ethConnector.accounts[ 4 ];
            recipient = ethConnector.accounts[ 5 ];
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
        ProjectBalancer.deploy(ethConnector.web3, {
            from: owner,
            baseToken: 0,
            escapeHatchCaller,
            escapeHatchDestination,
            mainDailyLimit: ethConnector.web3.toWei(100),
            mainDailyTransactions: 5,
            mainTransactionLimit: ethConnector.web3.toWei(10),
            mainStartHour: 0,
            mainEndHour: 86400,
            mainVaultBottomThreshold: ethConnector.web3.toWei(300),
            mainVaultTopThreshold: ethConnector.web3.toWei(500),
            maxProjectDailyLimit: ethConnector.web3.toWei(10),
            maxProjectDailyTransactions: ethConnector.web3.toWei(10),
            maxProjectTransactionLimit: 5,
            maxProjectTopThreshold: ethConnector.web3.toWei(10),
            minProjectWhitelistTimelock: 86400,
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
