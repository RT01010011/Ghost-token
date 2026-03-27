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
    function allocationFromGhostPurchase(address buyer) external view returns (bool);
    function ghostPurchasePseudo1Hash(address buyer) external view returns (bytes32);
}

contract GhostPresaleBonusRegistry {

    IGhostPresaleForBonus public immutable presale;
    uint256 public immutable bonusBps;
    bytes32 private immutable credentialDomainSeparator;

    mapping(address => bool) public registered;
    mapping(address => uint256) public ghostPurchased;
    mapping(address => bool) public credentialBindingConsumed;

    string[] private _pseudo1BonusList;
    mapping(bytes32 => bool) public pseudo1HashBonusListed;

    event EligibilityRecorded(address indexed buyer, uint256 ghostPurchasedWei, bytes32 indexed credentialId);
    event PresaleBonusPseudo1Listed(bytes32 indexed pseudo1Hash, string pseudo1);
    event CredentialBindingConsumed(address indexed buyer, bytes32 credentialId);

    error GhostPresaleBonusRegistry__NotEligible();
    error GhostPresaleBonusRegistry__AlreadyRegistered();
    error GhostPresaleBonusRegistry__NotRegistered();
    error GhostPresaleBonusRegistry__BindingAlreadyConsumed();
    error GhostPresaleBonusRegistry__PseudoMismatch();
    error GhostPresaleBonusRegistry__PseudoMustBeEmpty();

    constructor(address presale_, uint256 bonusBps_, bytes32 credentialDomainSeparator_) {
        require(presale_ != address(0), "GhostPresaleBonus: presale zero");
        require(bonusBps_ <= 10_000, "GhostPresaleBonus: bps too high");
        presale = IGhostPresaleForBonus(presale_);
        bonusBps = bonusBps_;
        credentialDomainSeparator = credentialDomainSeparator_;
    }

    function _requireEligibleUnregistered(address buyer) internal view returns (uint256 ghostAlloc) {
        if (registered[buyer]) revert GhostPresaleBonusRegistry__AlreadyRegistered();

        (uint256 ethContrib, uint256 ghostAlloc_, bool hasClaimed, bool hasRefunded) = presale.buyerInfo(buyer);

        if (hasRefunded || ethContrib == 0) revert GhostPresaleBonusRegistry__NotEligible();
        if (!hasClaimed || ghostAlloc_ == 0) revert GhostPresaleBonusRegistry__NotEligible();

        return ghostAlloc_;
    }

    function _finalizeRegistration(address buyer, uint256 ghostAlloc) internal {
        registered[buyer] = true;
        ghostPurchased[buyer] = ghostAlloc;

        bytes32 cid = _credentialId(buyer, ghostAlloc);
        emit EligibilityRecorded(buyer, ghostAlloc, cid);
    }

    function recordEligibility(address buyer) external {
        uint256 ghostAlloc = _requireEligibleUnregistered(buyer);
        _finalizeRegistration(buyer, ghostAlloc);
    }

    function recordEligibilityWithPseudo(address buyer, string calldata pseudo1) external {
        uint256 ghostAlloc = _requireEligibleUnregistered(buyer);

        bool ghost = presale.allocationFromGhostPurchase(buyer);
        bytes32 submitted = keccak256(bytes(pseudo1));

        if (ghost) {
            bytes32 onPresale = presale.ghostPurchasePseudo1Hash(buyer);
            if (onPresale == bytes32(0) || onPresale != submitted) {
                revert GhostPresaleBonusRegistry__PseudoMismatch();
            }
            if (!pseudo1HashBonusListed[submitted]) {
                pseudo1HashBonusListed[submitted] = true;
                _pseudo1BonusList.push(pseudo1);
                emit PresaleBonusPseudo1Listed(submitted, pseudo1);
            }
        } else {
            if (bytes(pseudo1).length != 0) revert GhostPresaleBonusRegistry__PseudoMustBeEmpty();
        }

        _finalizeRegistration(buyer, ghostAlloc);
    }

    function pseudo1BonusListLength() external view returns (uint256) {
        return _pseudo1BonusList.length;
    }

    function pseudo1BonusListAt(uint256 index) external view returns (string memory) {
        return _pseudo1BonusList[index];
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
