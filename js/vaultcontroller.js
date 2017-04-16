const async = require("async");
const _ = require("lodash");
const Vault = require("vaultcontract");
const { deploy, sendContractTx, asyncfunc } = require("runethtx");
const { VaultControllerAbi, VaultControllerByteCode, VaultControllerFactoryAbi, VaultControllerFactoryByteCode, VaultFactoryAbi, VaultFactoryByteCode } = require("../contracts/VaultController.sol.js");

module.exports = class VaultController {

    constructor(web3, address) {
        this.web3 = web3;
        this.contract = this.web3.eth.contract(VaultControllerAbi).at(address);
    }

    getSpenderStatus(idSpender, _cb) {
        return asyncfunc((cb) => {
            let nRecipients;
            let spender;
            async.series([
                (cb1) => {
                    this.contract.spenders(idSpender, (err, res) => {
                        if (err) {
                            cb1(err);
                            return;
                        }
                        if (res[ 0 ]) {  // Is active
                            spender = {
                                name: res[ 1 ],
                                addr: res[ 2 ],
                                dailyAmountLimit: res[ 3 ],
                                dailyTxnLimit: res[ 4 ],
                                txnAmountLimit: res[ 5 ],
                                openingTime: res[ 6 ],
                                closingTime: res[ 7 ],
                                recipients: [],
                            };
                        }
                        cb1();
                    });
                },
                (cb1) => {
                    this.contract.numberOfRecipients(idSpender, (err, res) => {
                        if (err) {
                            cb1(err);
                            return;
                        }
                        nRecipients = res.toNumber();
                        cb1();
                    });
                },
                (cb1) => {
                    async.eachSeries(_.range(0, nRecipients), (recipientId, cb2) => {
                        this.contract.recipients(idSpender, recipientId, (err, res) => {
                            if (err) { cb2(err); return; }
                            spender.recipients.push({
                                activationTime: res[ 0 ].toNumber(),
                                name: res[ 1 ],
                                addr: res[ 2 ],
                            });
                            cb2();
                        });
                    }, cb1);
                },
            ], (err) => {
                if (err) {
                    cb(err);
                    return;
                }
                cb(null, spender);
            });
        }, _cb);
    }

    getState(_cb) {
        return asyncfunc((cb) => {
            const st = {
                address: this.contract.address,
            };
            let nChildVaults;
            let nSpenders;
            const extractProp = (prop, opts) => (cb1) => {
                const params = Object.assign({ addr: false }, opts);
                let dest = prop;
                if (params.addr) dest += "Addr";
                this.contract[ prop ]((err, _prop) => {
                    if (err) { cb1(err); return; }
                    st[ dest ] = _prop;
                    cb1();
                });
            };
            async.series([
                extractProp("name"),
                extractProp("owner"),
                extractProp("primaryVault", { addr: true }),
                extractProp("vaultFactory", { addr: true }),
                extractProp("vaultControllerFactory", { addr: true }),
                extractProp("highestAcceptableBalance"),
                extractProp("lowestAcceptableBalance"),
                extractProp("canceled"),
                extractProp("parentVaultController"),
                extractProp("escapeHatchCaller"),
                extractProp("escapeHatchDestination"),
                extractProp("baseToken"),
                extractProp("parentVault"),
                extractProp("dailyAmountLimit"),
                extractProp("dailyTxnLimit"),
                extractProp("txnAmountLimit"),
                extractProp("highestAcceptableBalance"),
                extractProp("lowestAcceptableBalance"),
                extractProp("whiteListTimelock"),
                extractProp("openingTime"),
                extractProp("closingTime"),
                extractProp("accTxsInDay"),
                extractProp("accAmountInDay"),
                extractProp("dayOfLastTx"),
                (cb1) => {
                    this.contract.primaryVault((err, _primaryVaultAddr) => {
                        if (err) { cb1(err); return; }
                        st.primaryVaultAddr = _primaryVaultAddr;
                        cb1();
                    });
                },
                (cb1) => {
                    const vault = new Vault(this.web3, st.primaryVaultAddr);
                    vault.getState((err, _st) => {
                        if (err) { cb1(err); return; }
                        st.primaryVault = _st;
                        cb1();
                    });
                },
                (cb1) => {
                    this.contract.numberOfChildVaults((err, res) => {
                        if (err) { cb1(err); return; }
                        nChildVaults = res.toNumber();
                        st.childVaults = [];
                        cb1();
                    });
                },
                (cb1) => {
                    async.eachSeries(_.range(0, nChildVaults), (childVaultId, cb2) => {
                        this.contract.childVaultControllers(childVaultId,
                            (err, addrChildVaultController) => {
                                if (err) { cb1(err); return; }
                                const childVaultController =
                                    new VaultController(this.web3, addrChildVaultController);
                                childVaultController.getState((err2, _st) => {
                                    if (err2) { cb2(err2); return; }
                                    st.childVaults.push(_st);
                                    cb2();
                                });
                            });
                    }, cb1);
                },
                (cb1) => {
                    this.contract.numberOfSpenders((err, res) => {
                        if (err) { cb1(err); return; }
                        nSpenders = res.toNumber();
                        st.spenders = [];
                        cb1();
                    });
                },
                (cb1) => {
                    async.eachSeries(_.range(0, nSpenders), (spenderId, cb2) => {
                        this.getSpenderStatus(spenderId, (err, spender) => {
                            if (err) {
                                cb2(err);
                                return;
                            }
                            st.spenders.push(spender);
                            cb2();
                        });
                    }, cb1);
                },
            ], (err) => {
                if (err) { cb(err); return; }
                cb(null, st);
            });
        }, _cb);
    }

    initializeVault(opts, cb) {
        return sendContractTx(
            this.web3,
            this.contract,
            "initializeVault",
            Object.assign({}, opts, {
                extraGas: 250000,
            }),
            cb);
    }

    authorizeSpender(opts, cb) {
        return sendContractTx(
            this.web3,
            this.contract,
            "authorizeSpender",
            Object.assign({}, opts, {
                extraGas: 25000,
            }),
            cb);
    }

    authorizeRecipient(opts, cb) {
        return sendContractTx(
            this.web3,
            this.contract,
            "authorizeRecipient",
            Object.assign({}, opts, {
                extraGas: 25000,
            }),
            cb);
    }

    sendToAuthorizedRecipient(opts, cb) {
        return sendContractTx(
            this.web3,
            this.contract,
            "sendToAuthorizedRecipient",
            Object.assign({}, opts, {
                gas: 4000000,
            }),
            cb);
    }

    createChildVault(opts, _cb) {
        return asyncfunc((cb) => {
            const params = Object.assign({}, opts);
            params.gas = 3500000;
            async.series([
                (cb1) => {
                    sendContractTx(
                        this.web3,
                        this.contract,
                        "createChildVault",
                        params,
                        (err, txId) => {
                            if (err) {
                                cb1(err);
                            }
                            this.web3.eth.getTransactionReceipt(txId, (err2, receipt) => {
                                if (err2) {
                                    cb1(err2);
                                }
                                // log 0 -> NewOwner
                                // log 1 -> NewProject
                                //      topic 0 -> Event Name
                                //      topic 1 -> childProjectId
                                params.childVaultId = receipt.logs[ 1 ].topics[ 1 ];
                                cb1();
                            });
                        });
                },
                (cb1) => {
                    sendContractTx(
                        this.web3,
                        this.contract,
                        "initializeChildVault",
                        params,
                        cb1);
                },
            ], cb);
        }, _cb);
    }

    static deploy(web3, opts, _cb) {
        return asyncfunc((cb) => {
            let vaultController;
            const params = Object.assign({}, opts);
            async.series([
                (cb1) => {
                    params.abi = VaultFactoryAbi;
                    params.byteCode = VaultFactoryByteCode;
                    deploy(web3, params, (err, _vaultFactory) => {
                        if (err) {
                            cb1(err);
                            return;
                        }
                        params.vaultFactory = _vaultFactory.address;
                        cb1();
                    });
                },
                (cb1) => {
                    params.abi = VaultControllerFactoryAbi;
                    params.byteCode = VaultControllerFactoryByteCode;
                    deploy(web3, params, (err, _vaultControllerFactory) => {
                        if (err) {
                            cb1(err);
                            return;
                        }
                        params.vaultControllerFactory = _vaultControllerFactory.address;
                        cb1();
                    });
                },
                (cb1) => {
                    params.abi = VaultControllerAbi;
                    params.byteCode = VaultControllerByteCode;
                    deploy(web3, params, (err, _vaultController) => {
                        if (err) {
                            cb1(err);
                            return;
                        }
                        vaultController = new VaultController(web3, _vaultController.address);
                        cb1();
                    });
                },
                (cb1) => {
                    vaultController.initializeVault(params, cb1);
                },
            ],
            (err) => {
                if (err) {
                    cb(err);
                    return;
                }
                cb(null, vaultController);
            });
        }, _cb);
    }
};
