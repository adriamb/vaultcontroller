"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _async = require("async");

var _async2 = _interopRequireDefault(_async);

var _lodash = require("lodash");

var _lodash2 = _interopRequireDefault(_lodash);

var _runethtx = require("runethtx");

var _ProjectControllerSol = require("../contracts/ProjectController.sol.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ProjectController = function () {
    function ProjectController(web3, address) {
        _classCallCheck(this, ProjectController);

        this.web3 = web3;
        this.contract = this.web3.eth.contract(_ProjectControllerSol.ProjectControllerAbi).at(address);
    }

    _createClass(ProjectController, [{
        key: "getState",
        value: function getState(_cb) {
            var _this = this;

            return (0, _runethtx.asyncfunc)(function (cb) {
                var st = {};
                var nProjects = void 0;
                _async2.default.series([function (cb1) {
                    _this.contract.owner(function (err, _owner) {
                        if (err) {
                            cb(err);return;
                        }
                        st.owner = _owner;
                        cb1();
                    });
                }, function (cb1) {
                    _this.contract.mainVault(function (err, _mainVault) {
                        if (err) {
                            cb(err);return;
                        }
                        st.mainVault = _mainVault;
                        cb1();
                    });
                }, function (cb1) {
                    _this.contract.numberOfProjects(function (err, res) {
                        if (err) {
                            cb(err);return;
                        }
                        nProjects = res.toNumber();
                        st.projects = [];
                        cb1();
                    });
                }, function (cb1) {
                    _async2.default.eachSeries(_lodash2.default.range(0, nProjects), function (idProject, cb2) {
                        _this.contract.getProject(idProject, function (err, res) {
                            if (err) {
                                cb(err);return;
                            }
                            st.projects.push({
                                idProject: idProject,
                                name: res[0],
                                admin: res[1],
                                vault: res[2],
                                balance: res[3]
                            });
                            cb2();
                        });
                    }, cb1);
                }], function (err) {
                    if (err) {
                        cb(err);return;
                    }
                    cb(null, st);
                });
            }, _cb);
        }
    }, {
        key: "createProject",
        value: function createProject(opts, cb) {
            return (0, _runethtx.sendContractTx)(this.web3, this.contract, "createProject", opts, cb);
        }
    }, {
        key: "initialize",
        value: function initialize(opts, cb) {
            return (0, _runethtx.sendContractTx)(this.web3, this.contract, "initialize", Object.assign({}, opts, {
                extraGas: 250000
            }), cb);
        }
    }], [{
        key: "deploy",
        value: function deploy(web3, opts, _cb) {
            return (0, _runethtx.asyncfunc)(function (cb) {
                var projectController = void 0;
                var params = Object.assign({}, opts);
                _async2.default.series([function (cb1) {
                    params.abi = _ProjectControllerSol.VaultFactoryAbi;
                    params.byteCode = _ProjectControllerSol.VaultFactoryByteCode;
                    (0, _runethtx.deploy)(web3, params, function (err, _vaultFactory) {
                        if (err) {
                            cb1(err);
                            return;
                        }
                        params.vaultFactory = _vaultFactory.address;
                        cb1();
                    });
                }, function (cb1) {
                    params.abi = _ProjectControllerSol.ProjectControllerFactoryAbi;
                    params.byteCode = _ProjectControllerSol.ProjectControllerFactoryByteCode;
                    (0, _runethtx.deploy)(web3, params, function (err, _projectControllerFactory) {
                        if (err) {
                            cb1(err);
                            return;
                        }
                        params.projectControllerFactory = _projectControllerFactory.address;
                        cb1();
                    });
                }, function (cb1) {
                    params.abi = _ProjectControllerSol.ProjectControllerAbi;
                    params.byteCode = _ProjectControllerSol.ProjectControllerByteCode;
                    (0, _runethtx.deploy)(web3, params, function (err, _projectController) {
                        if (err) {
                            cb1(err);
                            return;
                        }
                        projectController = new ProjectController(web3, _projectController.address);
                        cb1();
                    });
                }, function (cb1) {
                    projectController.initialize({}, cb1);
                }], function (err) {
                    if (err) {
                        cb(err);
                        return;
                    }
                    cb(null, projectController);
                });
            }, _cb);
        }
    }]);

    return ProjectController;
}();

exports.default = ProjectController;
module.exports = exports["default"];
