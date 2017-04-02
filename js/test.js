import ethConnector from "ethconnector";
import { deploy } from "../js/projectbalancer";

let owner;
let escapeHatchCaller;
let escapeHatchDestination;

ethConnector.init("testrpc", (err) => {
    if (err) {
        console.log(err);
        return;
    }
    owner = ethConnector.accounts[ 0 ];
    escapeHatchCaller = ethConnector.accounts[ 1 ];
    escapeHatchDestination = ethConnector.accounts[ 2 ];
    deploy(ethConnector.web3, {
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
        verbose: true,
    }, (err2, _projectBalancer) => {
        if (err2) {
            console.log(err2);
            return;
        }
        console.log(_projectBalancer.contract.address);
    });
});
