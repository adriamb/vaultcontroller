import ethConnector from "ethconnector";
import async from "async";
import ProjectController from "../js/projectcontroller";

let owner;
let escapeHatchCaller;
let escapeHatchDestination;
let parentVault;
let admin;
let projectController;

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
                maxTransactionLimit: ethConnector.web3.toWei(50),
                maxTopThreshold: ethConnector.web3.toWei(500),
                minWhiteListTimelock: 86400,
                verbose: true,
            }, (err2, _ProjectController) => {
                if (err2) {
                    console.log(err2);
                    cb(err2);
                    return;
                }
                projectController = _ProjectController;
                console.log(_ProjectController.contract.address);
                cb();
            });
        },
        (cb) => {
            projectController.createProject({
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
    ]);
});
