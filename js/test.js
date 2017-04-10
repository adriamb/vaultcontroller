import ethConnector from "ethconnector";
import async from "async";
import VaultController from "../js/vaultcontroller";

let owner;
let escapeHatchCaller;
let escapeHatchDestination;
let parentVault;
let admin;
let vaultController;

ethConnector.init("testrpc", (err) => {
    if (err) {
        console.log(err);
        return;
    }
    owner = ethConnector.accounts[ 0 ];
    escapeHatchCaller = ethConnector.accounts[ 1 ];
    escapeHatchDestination = ethConnector.accounts[ 2 ];
    parentVault = ethConnector.accounts[ 3 ];
    admin = ethConnector.accounts[ 4 ];
    async.series([
        (cb) => {
            VaultController.deploy(ethConnector.web3, {
                from: owner,
                name: "Main Vault",
                baseToken: 0,
                escapeHatchCaller,
                escapeHatchDestination,
                parentProjectController: 0,
                parentVault,
                maxDailyLimit: ethConnector.web3.toWei(100),
                maxDailyTransactions: 5,
                maxTransactionLimit: ethConnector.web3.toWei(50),
                maxTopThreshold: ethConnector.web3.toWei(500),
                minWhiteListTimelock: 86400,
                verbose: true,
            }, (err2, _vaultController) => {
                if (err2) {
                    console.log(err2);
                    cb(err2);
                    return;
                }
                vaultController = _vaultController;
                console.log(_vaultController.contract.address);
                cb();
            });
        },
        (cb) => {
            vaultController.createProject({
                name: "Project 1",
                admin,
                maxDailyLimit: ethConnector.web3.toWei(100),
                maxDailyTransactions: 5,
                maxTransactionLimit: ethConnector.web3.toWei(10),
                maxTopThreshold: ethConnector.web3.toWei(500),
                minWhiteListTimelock: 86400,
                verbose: true,
            }, (err2) => {
                if (err2) {
                    console.log(err2);
                    cb(err2);
                    return;
                }
                console.log("Project Created!");
                cb();
            });
        },
        (cb) => {
            vaultController.getState((err, st) => {
                console.log(JSON.stringify(st,null,2));
                cb();
            });
        }
    ]);
});
