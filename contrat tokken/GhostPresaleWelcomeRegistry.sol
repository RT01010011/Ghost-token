// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./IGhostPresaleWindow.sol";
import "./IGhostProtocolV2ForWelcome.sol";

contract GhostPresaleWelcomeRegistry is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    IGhostPresaleWindow public immutable presale;
    IGhostProtocolV2ForWelcome public immutable ghostV2;
    address public immutable admin;

    uint256 public immutable welcomeAmountWei;
    uint256 public immutable maxRecipients;
    uint256 public immutable claimOpensAt;

    struct Entry {
        address payout;
        bool claimed;
    }

    mapping(bytes32 => Entry) public entries;
    uint256 public recordedCount;

    event WelcomeRecorded(bytes32 indexed pseudo1Hash, string pseudo1, address indexed payout);
    event WelcomeClaimed(bytes32 indexed pseudo1Hash, address indexed payout, uint256 amountWei);

    error GhostWelcome__NotAdmin();
    error GhostWelcome__ZeroPayout();
    error GhostWelcome__AlreadyRecorded();
    error GhostWelcome__CapReached();
    error GhostWelcome__NoGhostAccount();
    error GhostWelcome__OutsidePresaleWindow();
    error GhostWelcome__Unknown();
    error GhostWelcome__AlreadyClaimed();
    error GhostWelcome__TooEarly();
    error GhostWelcome__NotPayout();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert GhostWelcome__NotAdmin();
        _;
    }

    constructor(
        address token_,
        address presale_,
        address ghostV2_,
        address admin_,
        uint256 welcomeAmountWei_,
        uint256 maxRecipients_,
        uint256 claimOpensAt_
    ) {
        require(token_ != address(0), "GhostWelcome: token zero");
        require(presale_ != address(0), "GhostWelcome: presale zero");
        require(ghostV2_ != address(0), "GhostWelcome: v2 zero");
        require(admin_ != address(0), "GhostWelcome: admin zero");
        require(welcomeAmountWei_ > 0, "GhostWelcome: amount zero");
        require(maxRecipients_ > 0, "GhostWelcome: cap zero");

        token = IERC20(token_);
        presale = IGhostPresaleWindow(presale_);
        ghostV2 = IGhostProtocolV2ForWelcome(ghostV2_);
        admin = admin_;
        welcomeAmountWei = welcomeAmountWei_;
        maxRecipients = maxRecipients_;
        claimOpensAt = claimOpensAt_;
    }

    function recordWelcomeAccount(string calldata pseudo1, address payout) external onlyAdmin {
        if (payout == address(0)) revert GhostWelcome__ZeroPayout();

        bytes32 h = keccak256(bytes(pseudo1));
        if (entries[h].payout != address(0)) revert GhostWelcome__AlreadyRecorded();
        if (recordedCount >= maxRecipients) revert GhostWelcome__CapReached();

        if (ghostV2.pseudo1ToCommit(pseudo1) == bytes32(0)) revert GhostWelcome__NoGhostAccount();

        (, uint256 createdAt, ) = ghostV2.getAccountInfo(pseudo1);
        if (createdAt != 0) {
            uint256 t0 = presale.startTime();
            uint256 t1 = presale.endTime();
            if (createdAt < t0 || createdAt > t1) revert GhostWelcome__OutsidePresaleWindow();
        }

        entries[h] = Entry(payout, false);
        unchecked {
            recordedCount++;
        }

        emit WelcomeRecorded(h, pseudo1, payout);
    }

    function claim(string calldata pseudo1) external nonReentrant {
        if (block.timestamp < claimOpensAt) revert GhostWelcome__TooEarly();

        bytes32 h = keccak256(bytes(pseudo1));
        Entry storage e = entries[h];
        if (e.payout == address(0)) revert GhostWelcome__Unknown();
        if (e.claimed) revert GhostWelcome__AlreadyClaimed();
        if (msg.sender != e.payout) revert GhostWelcome__NotPayout();

        e.claimed = true;
        token.safeTransfer(e.payout, welcomeAmountWei);

        emit WelcomeClaimed(h, e.payout, welcomeAmountWei);
    }
}
