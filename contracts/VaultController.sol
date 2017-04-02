


contract VaultController is Owned {

    VaultController parentVaultController;
    Vault public vault;
    mapping(address => bool) public authorizedChildControllers;

    uint dailyLimit;


    function newPayment(
        string _name,
        bytes32 _reference,
        address _recipient,
        uint _amount,
        uint _paymentDelay
    ) returns(uint) onlyOwner {

    }

    function cancelPayment(uint _idPayment) onlyOwner {

    }

    function askForMoreFunds(uint _amount) onlyOwner {

    }
}
