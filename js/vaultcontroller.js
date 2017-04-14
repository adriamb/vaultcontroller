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

    getState(_cb) {
        return asyncfunc((cb) => {
            const st = {
                address: this.contract.address,
            };
            let nChildVaults;
            async.series([
                (cb1) => {
                    this.contract.name((err, _name) => {
                        if (err) { cb1(err); return; }
                        st.name = _name;
                        cb1();
                    });
                },
                (cb1) => {
                    this.contract.owner((err, _owner) => {
                        if (err) { cb1(err); return; }
                        st.owner = _owner;
                        cb1();
                    });
                },
                (cb1) => {
                    this.contract.primaryVault((err, _primaryVaultAddr) => {
                        if (err) { cb1(err); return; }
                        st.primaryVaultAddr = _primaryVaultAddr;
                        cb1();
                    });
                },
                (cb1) => {
                    this.contract.vaultFactory((err, _vaultFactoryAddr) => {
                        if (err) { cb1(err); return; }
                        st.vaultFactoryAddr = _vaultFactoryAddr;
                        cb1();
                    });
                },
                (cb1) => {
                    this.contract.vaultControllerFactory((err, _vaultControllerFactoryAddr) => {
                        if (err) { cb1(err); return; }
                        st.vaultControllerFactoryAddr = _vaultControllerFactoryAddr;
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
                    this.contract.highestAcceptableBalance((err, _highestAcceptableBalance) => {
                        if (err) { cb1(err); return; }
                        st.highestAcceptableBalance = _highestAcceptableBalance;
                        cb1();
                    });
                },
                (cb1) => {
                    this.contract.lowestAcceptableBalance((err, _lowestAcceptableBalance) => {
                        if (err) { cb1(err); return; }
                        st.lowestAcceptableBalance = _lowestAcceptableBalance;
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
