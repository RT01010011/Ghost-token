// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./GhostVerifier.sol";
import "./IGhostProtocolV2ForPresale.sol";

interface IGhostTokenPresaleCap {
    function PRIVATE_SALE_ALLOC() external view returns (uint256);
}

contract GhostPresale is GhostVerifier, ReentrancyGuard {

    using SafeERC20 for IERC20;

    IERC20  public immutable ghostToken;
    address public immutable admin;
    address payable public immutable ethProceedsReceiver;
    address public immutable ghostProtocolV2;

    uint256 public immutable ghostPerEth;
    uint256 public immutable softCapEth;
    uint256 public immutable hardCapEth;
    uint256 public immutable maxPerWallet;
    uint256 public immutable startTime;
    uint256 public immutable endTime;
    uint256 public immutable maxGhostAllocatable;

    uint256 public totalRaisedEth;
    uint256 public totalTokensSold;

    bool public finalized;
    bool public refundMode;

    mapping(address => uint256) public contributions;
    mapping(address => uint256) public tokenAllocation;
    mapping(address => bool)    public claimed;
    mapping(address => bool)    public refunded;

    mapping(bytes32 => uint256) public ghostPresaleNonceByPseudoHash;
    mapping(bytes32 => uint256) public ghostClaimNonceByPseudoHash;
    mapping(address => bool)    public allocationFromGhostPurchase;

    event Purchase(address indexed buyer, uint256 ethAmount, uint256 ghostAmount);
    event PurchaseViaGhostProtocol(
        bytes32 indexed pseudo1Hash,
        address indexed recipient,
        uint256 ethAmount,
        uint256 ghostAmount
    );
    event Claimed(address indexed buyer, uint256 ghostAmount);
    event ClaimedViaGhostProtocol(
        bytes32 indexed pseudo1Hash,
        address indexed recipient,
        address indexed payout,
        uint256 ghostAmount
    );
    event Refunded(address indexed buyer, uint256 ethAmount);
    event Finalized(uint256 totalEthRaised, uint256 totalTokensSold);
    event RefundModeEnabled();
    event UnsoldTokensRecovered(uint256 amount);
    event ContributionWithdrawn(address indexed buyer, uint256 ethReturned, uint256 ghostAllocationCancelled);

    modifier onlyAdmin() {
        require(msg.sender == admin, "GhostPresale: pas admin");
        _;
    }

    modifier presaleActive() {
        require(block.timestamp >= startTime, "GhostPresale: pas encore commence");
        require(block.timestamp <= endTime,   "GhostPresale: termine");
        require(!finalized,                   "GhostPresale: finalise");
        require(!refundMode,                  "GhostPresale: mode remboursement");
        _;
    }

    constructor(
        address _ghostToken,
        address _admin,
        address payable _ethProceedsReceiver,
        address _ghostProtocolV2,
        uint256 _ghostPerEth,
        uint256 _softCapEth,
        uint256 _hardCapEth,
        uint256 _maxPerWallet,
        uint256 _startTime,
        uint256 _endTime
    ) {
        require(_ghostToken          != address(0), "GhostPresale: token zero");
        require(_admin               != address(0), "GhostPresale: admin zero");
        require(_ethProceedsReceiver != address(0), "GhostPresale: eth receiver zero");
        require(_ghostProtocolV2     != address(0), "GhostPresale: ghost protocol zero");
        require(_ghostPerEth         >  0,          "GhostPresale: taux zero");
        require(_hardCapEth          >= _softCapEth,"GhostPresale: hardcap < softcap");
        require(_maxPerWallet        >  0,          "GhostPresale: maxWallet zero");
        require(_endTime             > _startTime,  "GhostPresale: fin < debut");
        require(_startTime           > block.timestamp, "GhostPresale: debut dans le passe");

        maxGhostAllocatable  = IGhostTokenPresaleCap(_ghostToken).PRIVATE_SALE_ALLOC();
        ghostToken           = IERC20(_ghostToken);
        admin                = _admin;
        ethProceedsReceiver  = _ethProceedsReceiver;
        ghostProtocolV2      = _ghostProtocolV2;
        ghostPerEth          = _ghostPerEth;
        softCapEth           = _softCapEth;
        hardCapEth           = _hardCapEth;
        maxPerWallet         = _maxPerWallet;
        startTime            = _startTime;
        endTime              = _endTime;
    }

    receive() external payable nonReentrant {
        _buy(msg.sender, msg.value);
    }

    function buy() external payable nonReentrant {
        _buy(msg.sender, msg.value);
    }

    function buyTokens() external payable nonReentrant {
        _buy(msg.sender, msg.value);
    }

    function _buy(address buyer, uint256 ethAmount) internal presaleActive {
        require(ethAmount > 0, "GhostPresale: montant zero");
        require(
            contributions[buyer] + ethAmount <= maxPerWallet,
            "GhostPresale: limite wallet depassee"
        );
        require(
            totalRaisedEth + ethAmount <= hardCapEth,
            "GhostPresale: hardcap atteint"
        );

        uint256 ghostAmount = (ethAmount * ghostPerEth) / 1e18;
        require(
            ghostToken.balanceOf(address(this)) >= ghostAmount,
            "GhostPresale: pas assez de tokens"
        );
        require(
            totalTokensSold + ghostAmount <= maxGhostAllocatable,
            "GhostPresale: plafond GHOST vente"
        );

        contributions[buyer]   += ethAmount;
        tokenAllocation[buyer] += ghostAmount;
        totalRaisedEth         += ethAmount;
        totalTokensSold        += ghostAmount;

        emit Purchase(buyer, ethAmount, ghostAmount);
    }

    function buyTokensGhost(
        string    calldata pseudo1,
        address            recipient,
        uint256            deadline,
        bytes32            pseudo2Commit,
        bytes32            key1Commit,
        bytes32            key2Commit,
        SchnorrProof calldata proofPseudo2,
        SchnorrProof calldata proofKey1
    ) external payable nonReentrant presaleActive {
        require(block.timestamp <= deadline, "GhostPresale: TX expiree");
        require(recipient != address(0),     "GhostPresale: recipient zero");
        uint256 ethAmount = msg.value;
        require(ethAmount > 0,               "GhostPresale: montant zero");

        bytes32 accountCommit = IGhostProtocolV2ForPresale(ghostProtocolV2)
            .pseudo1ToCommit(pseudo1);
        require(accountCommit != bytes32(0), "GhostPresale: compte Ghost inexistant");

        bytes32 expectedCommit = keccak256(
            abi.encodePacked(pseudo2Commit, key1Commit, key2Commit)
        );
        require(
            expectedCommit == accountCommit,
            "GhostPresale: commits incompatibles avec le compte Ghost"
        );

        bytes32 pseudoHash = keccak256(bytes(pseudo1));
        uint256 n          = ghostPresaleNonceByPseudoHash[pseudoHash];

        bytes32 cP2 = keccak256(abi.encodePacked(
            "buy_presale_p2",
            pseudo1,
            recipient,
            ethAmount,
            n,
            deadline,
            address(this),
            block.chainid
        ));
        bytes32 cK1 = keccak256(abi.encodePacked(
            "buy_presale_k1",
            pseudo1,
            recipient,
            ethAmount,
            n,
            deadline,
            address(this),
            block.chainid
        ));

        require(
            verifyGhostProof(pseudo2Commit, proofPseudo2, cP2),
            "GhostPresale: preuve pseudo2 invalide"
        );
        require(
            verifyGhostProof(key1Commit, proofKey1, cK1),
            "GhostPresale: preuve key1 invalide"
        );

        ghostPresaleNonceByPseudoHash[pseudoHash] = n + 1;

        _buy(recipient, ethAmount);
        allocationFromGhostPurchase[recipient] = true;

        uint256 ghostAmt = (ethAmount * ghostPerEth) / 1e18;
        emit PurchaseViaGhostProtocol(pseudoHash, recipient, ethAmount, ghostAmt);
    }

    function finalize() external onlyAdmin nonReentrant {
        require(!finalized,  "GhostPresale: deja finalise");
        require(!refundMode, "GhostPresale: mode remboursement");
        require(
            block.timestamp > endTime || totalRaisedEth >= hardCapEth,
            "GhostPresale: prevente en cours"
        );
        require(
            softCapEth == 0 || totalRaisedEth >= softCapEth,
            "GhostPresale: softcap non atteint"
        );

        finalized = true;
        emit Finalized(totalRaisedEth, totalTokensSold);

        (bool ok,) = ethProceedsReceiver.call{value: totalRaisedEth}("");
        require(ok, "GhostPresale: transfer ETH echoue");
    }

    function enableRefundMode() external onlyAdmin {
        require(!finalized,                   "GhostPresale: deja finalise");
        require(!refundMode,                  "GhostPresale: deja en remboursement");
        require(block.timestamp > endTime,    "GhostPresale: prevente encore active");
        require(softCapEth > 0,               "GhostPresale: pas de softcap, utiliser finalize()");
        require(totalRaisedEth < softCapEth,  "GhostPresale: softcap atteint, utiliser finalize()");

        refundMode = true;
        emit RefundModeEnabled();
    }

    function claim() external nonReentrant {
        require(finalized,                       "GhostPresale: pas encore finalise");
        require(!claimed[msg.sender],            "GhostPresale: deja reclame");
        require(tokenAllocation[msg.sender] > 0, "GhostPresale: aucune allocation");

        uint256 amount = tokenAllocation[msg.sender];
        claimed[msg.sender] = true;

        emit Claimed(msg.sender, amount);
        ghostToken.safeTransfer(msg.sender, amount);
    }

    function claimGhost(
        string    calldata pseudo1,
        address            recipient,
        address            payout,
        uint256            deadline,
        bytes32            pseudo2Commit,
        bytes32            key1Commit,
        bytes32            key2Commit,
        SchnorrProof calldata proofPseudo2,
        SchnorrProof calldata proofKey1
    ) external nonReentrant {
        require(finalized,                        "GhostPresale: pas encore finalise");
        require(block.timestamp <= deadline,      "GhostPresale: TX expiree");
        require(payout    != address(0),          "GhostPresale: payout zero");
        require(recipient != address(0),          "GhostPresale: recipient zero");
        require(
            allocationFromGhostPurchase[recipient],
            "GhostPresale: claimGhost reserve achat Ghost"
        );
        require(!claimed[recipient],              "GhostPresale: deja reclame");
        require(tokenAllocation[recipient] > 0,   "GhostPresale: aucune allocation");

        bytes32 accountCommit = IGhostProtocolV2ForPresale(ghostProtocolV2)
            .pseudo1ToCommit(pseudo1);
        require(accountCommit != bytes32(0), "GhostPresale: compte Ghost inexistant");

        bytes32 expectedCommit = keccak256(
            abi.encodePacked(pseudo2Commit, key1Commit, key2Commit)
        );
        require(
            expectedCommit == accountCommit,
            "GhostPresale: commits incompatibles avec le compte Ghost"
        );

        bytes32 pseudoHash = keccak256(bytes(pseudo1));
        uint256 n          = ghostClaimNonceByPseudoHash[pseudoHash];

        bytes32 cP2 = keccak256(abi.encodePacked(
            "claim_presale_p2",
            pseudo1,
            recipient,
            payout,
            n,
            deadline,
            address(this),
            block.chainid
        ));
        bytes32 cK1 = keccak256(abi.encodePacked(
            "claim_presale_k1",
            pseudo1,
            recipient,
            payout,
            n,
            deadline,
            address(this),
            block.chainid
        ));

        require(
            verifyGhostProof(pseudo2Commit, proofPseudo2, cP2),
            "GhostPresale: preuve pseudo2 invalide"
        );
        require(
            verifyGhostProof(key1Commit, proofKey1, cK1),
            "GhostPresale: preuve key1 invalide"
        );

        ghostClaimNonceByPseudoHash[pseudoHash] = n + 1;

        uint256 amount = tokenAllocation[recipient];
        claimed[recipient] = true;

        emit Claimed(recipient, amount);
        emit ClaimedViaGhostProtocol(pseudoHash, recipient, payout, amount);
        ghostToken.safeTransfer(payout, amount);
    }

    function refund() external nonReentrant {
        require(refundMode,                     "GhostPresale: pas en mode remboursement");
        require(!refunded[msg.sender],          "GhostPresale: deja rembourse");
        require(contributions[msg.sender] > 0,  "GhostPresale: aucune contribution");

        uint256 amount = contributions[msg.sender];
        refunded[msg.sender] = true;

        emit Refunded(msg.sender, amount);
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "GhostPresale: remboursement ETH echoue");
    }

    function remboursementVolontaire() external nonReentrant {
        require(!finalized,                    "GhostPresale: deja finalise");
        require(!refundMode,                   "GhostPresale: utiliser refund()");
        require(block.timestamp <= endTime,    "GhostPresale: prevente terminee");

        uint256 ethAmount   = contributions[msg.sender];
        uint256 ghostAmount = tokenAllocation[msg.sender];
        require(ethAmount > 0, "GhostPresale: rien a rembourser");

        contributions[msg.sender]   = 0;
        tokenAllocation[msg.sender] = 0;
        totalRaisedEth              -= ethAmount;
        totalTokensSold             -= ghostAmount;
        allocationFromGhostPurchase[msg.sender] = false;

        emit ContributionWithdrawn(msg.sender, ethAmount, ghostAmount);

        (bool ok,) = msg.sender.call{value: ethAmount}("");
        require(ok, "GhostPresale: transfert ETH echoue");
    }

    function recoverUnsoldTokens() external onlyAdmin {
        require(finalized || refundMode, "GhostPresale: prevente non terminee");

        uint256 balance = ghostToken.balanceOf(address(this));
        require(balance > 0, "GhostPresale: aucun token a recuperer");

        emit UnsoldTokensRecovered(balance);
        ghostToken.safeTransfer(admin, balance);
    }

    function presaleInfo() external view returns (
        uint256 _ghostPerEth,
        uint256 _softCapEth,
        uint256 _hardCapEth,
        uint256 _totalRaisedEth,
        uint256 _totalTokensSold,
        uint256 _tokensRemaining,
        bool    _finalized,
        bool    _refundMode,
        bool    _active
    ) {
        return (
            ghostPerEth,
            softCapEth,
            hardCapEth,
            totalRaisedEth,
            totalTokensSold,
            ghostToken.balanceOf(address(this)),
            finalized,
            refundMode,
            block.timestamp >= startTime &&
            block.timestamp <= endTime   &&
            !finalized && !refundMode
        );
    }

    function buyerInfo(address buyer) external view returns (
        uint256 ethContributed,
        uint256 ghostAllocated,
        bool    hasClaimed,
        bool    hasRefunded
    ) {
        return (
            contributions[buyer],
            tokenAllocation[buyer],
            claimed[buyer],
            refunded[buyer]
        );
    }

    function ethForGhost(uint256 ghostAmount) external view returns (uint256) {
        return (ghostAmount * 1e18) / ghostPerEth;
    }

    function ghostForEth(uint256 ethAmount) external view returns (uint256) {
        return (ethAmount * ghostPerEth) / 1e18;
    }
}
