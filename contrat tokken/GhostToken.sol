// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/utils/Nonces.sol";

contract GhostToken is ERC20, ERC20Permit, ERC20Votes {

    uint256 public constant TOTAL_SUPPLY       = 33_000_000 * 1e18;
    uint256 public constant AIRDROP_ALLOC      =  6_600_000 * 1e18;
    uint256 public constant TREASURY_ALLOC     =  5_940_000 * 1e18;
    uint256 public constant TEAM_ALLOC         =  5_610_000 * 1e18;
    uint256 public constant REWARDS_ALLOC      =  6_600_000 * 1e18;
    uint256 public constant LIQUIDITY_ALLOC    =  3_300_000 * 1e18;
    uint256 public constant PRIVATE_SALE_ALLOC =  4_950_000 * 1e18;

    constructor()
        ERC20("Ghost Protocol", "GHOST")
        ERC20Permit("Ghost Protocol")
    {
        _mint(msg.sender, TOTAL_SUPPLY);
    }

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}
