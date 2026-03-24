// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract GhostEthProceedsSplitter is ReentrancyGuard {

    address[] private _recipients;
    uint256[] private _bps;

    event EthProceedsSplit(uint256 total, address[] recipients, uint256[] amounts);

    constructor(address[] memory recipients_, uint256[] memory bps_) {
        require(recipients_.length == bps_.length && recipients_.length > 0, "GhostEthSplitter: length");
        uint256 sum;
        for (uint256 i = 0; i < recipients_.length; i++) {
            require(recipients_[i] != address(0), "GhostEthSplitter: zero recipient");
            require(bps_[i] > 0, "GhostEthSplitter: zero bps");
            sum += bps_[i];
        }
        require(sum == 10_000, "GhostEthSplitter: bps sum");

        _recipients = recipients_;
        _bps = bps_;
    }

    function recipientCount() external view returns (uint256) {
        return _recipients.length;
    }

    function recipientAt(uint256 i) external view returns (address) {
        return _recipients[i];
    }

    function bpsAt(uint256 i) external view returns (uint256) {
        return _bps[i];
    }

    receive() external payable nonReentrant {
        uint256 amount = msg.value;
        if (amount == 0) {
            return;
        }

        uint256 n = _recipients.length;
        uint256 allocated = 0;
        uint256[] memory amounts = new uint256[](n);

        for (uint256 i = 0; i < n; i++) {
            uint256 share;
            if (i == n - 1) {
                share = amount - allocated;
            } else {
                share = (amount * _bps[i]) / 10_000;
                allocated += share;
            }
            amounts[i] = share;
            (bool ok,) = payable(_recipients[i]).call{value: share}("");
            require(ok, "GhostEthSplitter: transfer failed");
        }

        emit EthProceedsSplit(amount, _recipients, amounts);
    }
}
