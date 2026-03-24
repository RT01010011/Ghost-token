// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IPresaleBuyRefund {
    function buy() external payable;
    function refund() external;
}

/**
 * @title ReentrantRefundAttacker
 * @notice Contrat de test : achat puis tentative de réentrance sur `refund()`.
 */
contract ReentrantRefundAttacker {
    IPresaleBuyRefund public immutable presale;

    constructor(address _presale) {
        presale = IPresaleBuyRefund(_presale);
    }

    function buyOnPresale() external payable {
        presale.buy{value: msg.value}();
    }

    function refundOnce() external {
        presale.refund();
    }

    receive() external payable {
        try presale.refund() {} catch {}
    }
}
