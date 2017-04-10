import async from "async";
import _ from "lodash";
import Vault from "vaultcontract";
import { deploy, sendContractTx, asyncfunc } from "runethtx";
import { VaultControllerAbi, VaultControllerByteCode, VaultControllerFactoryAbi, VaultControllerFactoryByteCode, VaultFactoryAbi, VaultFactoryByteCode } from "../contracts/VaultController.sol.js";

export default class VaultController {

    constructor(web3, address) {
        this.web3 = web3;
        this.contract = this.web3.eth.contract(VaultControllerAbi).at(address);
    }

    getState(_cb) {
        return asyncfunc((cb) => {
            const st = {
                address: this.contract.address,
            };
            let nProjects;
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
                    this.contract.mainVault((err, _mainVault) => {
                        if (err) { cb1(err); return; }
                        st.mainVault = _mainVault;
                        cb1();
                    });
                },
                (cb1) => {
                    const vault = new Vault(this.web3, st.mainVault);
                    vault.getState((err, _st) => {
                        if (err) { cb1(err); return; }
                        st.mainVault = _st;
                        cb1();
                    });
                },
                (cb1) => {
                    this.contract.topThreshold((err, _topThreshold) => {
                        if (err) { cb1(err); return; }
                        st.topThreshold = _topThreshold;
                        cb1();
                    });
                },
                (cb1) => {
                    this.contract.bottomThreshold((err, _bottomThreshold) => {
                        if (err) { cb1(err); return; }
                        st.bottomThreshold = _bottomThreshold;
                        cb1();
                    });
                },
                (cb1) => {
                    this.contract.numberOfProjects((err, res) => {
                        if (err) { cb1(err); return; }
                        nProjects = res.toNumber();
                        st.childProjects = [];
                        cb1();
                    });
                },
                (cb1) => {
                    async.eachSeries(_.range(0, nProjects), (idProject, cb2) => {
                        this.contract.childProjects(idProject, (err, addrChildProject) => {
                            if (err) { cb1(err); return; }
                            const childProject = new VaultController(this.web3, addrChildProject);
                            childProject.getState((err2, _st) => {
                                if (err2) { cb2(err2); return; }
                                st.childProjects.push(_st);
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

    initialize(opts, cb) {
        return sendContractTx(
            this.web3,
            this.contract,
            "initialize",
            Object.assign({}, opts, {
                extraGas: 250000,
            }),
            cb);
    }

    createProject(opts, cb) {
        return sendContractTx(
            this.web3,
            this.contract,
            "createProject",
            Object.assign({}, opts, {
                gas: 4700000,
            }),
            cb);
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
                    vaultController.initialize({}, cb1);
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
}
