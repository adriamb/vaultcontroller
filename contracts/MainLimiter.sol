

// The owner should be the vault

contract MainLimiter is Owned {
    uint public dailyLimit;
    uint public dailyTransactions;
    uint public transactionLimit;
    uint public startTime;   // UTC second in the day that are allowed payments
    uint public windowTimeLength;  // Payment window lenth in seconds

    mapping(address => uint) whiteListedAddress;

    function MainLimiter(
        uint dailyLimit,
        uint dailyTransactions,
        uint transactionLimit,
        uint startTime,
        uint windowTimeLength
    }

    /// @notice This function is called from the vault when a new
    ///  payment is authorized. This function shoud throw if this payment
    ///  is not allowed.
    function onPaymentAuthorization(
        int _idPayment,
        address _spender,
        address _recipient,
        uint _amount,
        bytes _params
    ) onlyOwner {

// Absolute Limits

        uint actualDay = now / 86400;
        uint actualHour = now % actualDay;

        if (actualHour < startTime) actualDay--;

        uint timeSinceStart = now - (actualDay * 86400 + startTime);

        if (lastTxDay < actualDay) {
            dayAmount = 0;
            dayTransactions = 0;
            lastTxDay = actualDay;
        }

        dayAmount += _amount;
        lastTxDay ++;

        if (dayAmount > dailyLimit) throw;
        if (dayTransactions > dailyTransactions) throw;
        if (_amount > transactionLimit) throw;
        if (timeSinceStart > windowTimeLength) throw;

// Check that the destination vault does not exceed its limit.


    }

    /// @notice This function is called from the vault when a new
    ///  payment is collected. This function shoud throw if this collection
    ///  is not allowed.
    function onPaymentCollection(
        int _idPayment,
        address _spender,
        address _recipient,
        uint _amount,
        bytes _params
    ) onlyOwner {
    }
}
