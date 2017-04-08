import ethConnector from "ethconnector";
import { deploy } from "../js/projectcontroller";

let owner;
let escapeHatchCaller;
let escapeHatchDestination;
let parentVault;

ethConnector.init("testrpc", (err) => {
    if (err) {
        console.log(err);
        return;
    }
    owner = ethConnector.accounts[ 0 ];
    escapeHatchCaller = ethConnector.accounts[ 1 ];
    escapeHatchDestination = ethConnector.accounts[ 2 ];
    parentVault = ethConnector.accounts[ 3 ];
    deploy(ethConnector.web3, {
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
            verbose: true,
    }, (err2, _projectBalancer) => {
        if (err2) {
            console.log(err2);
            return;
        }
        console.log(_projectBalancer.contract.address);
    });
});
