// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IGhostPresaleForBonus {
    function buyerInfo(address buyer)
        external
        view
        returns (
            uint256 ethContributed,
            uint256 ghostAllocated,
            bool hasClaimed,
            bool hasRefunded
        );
}

contract GhostPresaleBonusRegistry {

    IGhostPresaleForBonus public immutable presale;
    uint256 public immutable bonusBps;
    bytes32 private immutable credentialDomainSeparator;

    mapping(address => bool) public registered;
    mapping(address => uint256) public ghostPurchased;
    mapping(address => bool) public credentialBindingConsumed;

    event EligibilityRecorded(address indexed buyer, uint256 ghostPurchasedWei, bytes32 indexed credentialId);
    event CredentialBindingConsumed(address indexed buyer, bytes32 credentialId);

    error GhostPresaleBonusRegistry__NotEligible();
    error GhostPresaleBonusRegistry__AlreadyRegistered();
    error GhostPresaleBonusRegistry__NotRegistered();
    error GhostPresaleBonusRegistry__BindingAlreadyConsumed();

    constructor(address presale_, uint256 bonusBps_, bytes32 credentialDomainSeparator_) {
        require(presale_ != address(0), "GhostPresaleBonus: presale zero");
        require(bonusBps_ <= 10_000, "GhostPresaleBonus: bps too high");
        presale = IGhostPresaleForBonus(presale_);
        bonusBps = bonusBps_;
        credentialDomainSeparator = credentialDomainSeparator_;
    }

    function recordEligibility(address buyer) external {
        if (registered[buyer]) revert GhostPresaleBonusRegistry__AlreadyRegistered();

        (uint256 ethContrib, uint256 ghostAlloc, bool hasClaimed, bool hasRefunded) = presale.buyerInfo(buyer);

        if (hasRefunded || ethContrib == 0) revert GhostPresaleBonusRegistry__NotEligible();
        if (!hasClaimed || ghostAlloc == 0) revert GhostPresaleBonusRegistry__NotEligible();

        registered[buyer] = true;
        ghostPurchased[buyer] = ghostAlloc;

        bytes32 cid = _credentialId(buyer, ghostAlloc);
        emit EligibilityRecorded(buyer, ghostAlloc, cid);
    }

    function bonusGhostAmount(address buyer) external view returns (uint256) {
        if (!registered[buyer]) return 0;
        return (ghostPurchased[buyer] * bonusBps) / 10_000;
    }

    function credentialIdOf(address buyer) external view returns (bytes32) {
        if (!registered[buyer]) return bytes32(0);
        return _credentialId(buyer, ghostPurchased[buyer]);
    }

    function consumeCredentialBinding() external {
        address buyer = msg.sender;
        if (!registered[buyer]) revert GhostPresaleBonusRegistry__NotRegistered();
        if (credentialBindingConsumed[buyer]) revert GhostPresaleBonusRegistry__BindingAlreadyConsumed();

        credentialBindingConsumed[buyer] = true;
        bytes32 cid = _credentialId(buyer, ghostPurchased[buyer]);
        emit CredentialBindingConsumed(buyer, cid);
    }

    function _credentialId(address buyer, uint256 ghostAmt) internal view returns (bytes32) {
        return keccak256(
            abi.encodePacked(buyer, ghostAmt, address(presale), block.chainid, credentialDomainSeparator)
        );
    }
}
