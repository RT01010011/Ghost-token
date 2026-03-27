/**
 * Ghost Protocol SDK
 * ==================
 * Version  : 1.0.0-beta
 * Auteur   : RayTech R&D — Rayane Hila
 * Licence  : MIT
 *
 * SDK unifié pour Ghost Protocol V2.
 * Couvre trois domaines :
 *   1. Lecture et décodage on-chain (GhostProtocolV2Client)
 *   2. Connexion aux contrats externes avec preuves Schnorr (GhostSDK)
 *   3. Calcul des identifiants de bonus presale (GhostPresaleBonusRegistry)
 * Prévente GhostPresale (lib Schnorr séparée) : ghost-schnorr-libz.js — prepareBuyPresaleGhost, prepareClaimPresaleGhost.
 *
 * Dépendances : ethers ^6.x
 */

'use strict';

const { ethers } = require('ethers');

// =============================================================================
// SECTION 1 — CONSTANTES ET ABI
// =============================================================================

/**
 * ABI minimal de GhostProtocolV2.
 * Couvre les fonctions publiques utilisées par le SDK.
 */
const GHOST_PROTOCOL_V2_ABI = [
    // Ecriture
    "function createAccount(string pseudo1, bytes32 pseudo2Commit, bytes32 key1Commit, bytes32 key2Commit) external",
    "function sendToPseudo1(string pseudo1, address token, uint256 amount) external payable",
    "function approveReceive(string pseudo1, uint256 transferIndex, tuple(uint256 Px, uint256 Py, uint256 Rx, uint256 Ry, uint256 s) proofPseudo2, tuple(uint256 Px, uint256 Py, uint256 Rx, uint256 Ry, uint256 s) proofKey1) external",
    "function rejectReceive(string pseudo1, uint256 transferIndex, tuple(uint256 Px, uint256 Py, uint256 Rx, uint256 Ry, uint256 s) proofPseudo2, tuple(uint256 Px, uint256 Py, uint256 Rx, uint256 Ry, uint256 s) proofKey1) external",
    "function sendFromHash1(string pseudo1, tuple(address stealthAddress, uint256 stealthRx, uint256 stealthRy, address token, uint256 amount, uint256 deadline) p, tuple(uint256 Px, uint256 Py, uint256 Rx, uint256 Ry, uint256 s) proofPseudo2, tuple(uint256 Px, uint256 Py, uint256 Rx, uint256 Ry, uint256 s) proofKey2, tuple(uint256 Px, uint256 Py, uint256 Rx, uint256 Ry, uint256 s) proofKey1) external",
    "function claimETH(string pseudo1, address recipient, uint256 amount, uint256 deadline, tuple(uint256 Px, uint256 Py, uint256 Rx, uint256 Ry, uint256 s) proofPseudo2, tuple(uint256 Px, uint256 Py, uint256 Rx, uint256 Ry, uint256 s) proofKey2, tuple(uint256 Px, uint256 Py, uint256 Rx, uint256 Ry, uint256 s) proofKey1) external",
    "function sendERC20ToExternal(string pseudo1, address recipient, address token, uint256 amount, uint256 deadline, tuple(uint256 Px, uint256 Py, uint256 Rx, uint256 Ry, uint256 s) proofPseudo2, tuple(uint256 Px, uint256 Py, uint256 Rx, uint256 Ry, uint256 s) proofKey2, tuple(uint256 Px, uint256 Py, uint256 Rx, uint256 Ry, uint256 s) proofKey1) external",
    "function autoRejectExpired(string pseudo1, uint256 transferIndex) external",
    "function deactivateAccount(string pseudo1, tuple(uint256 Px, uint256 Py, uint256 Rx, uint256 Ry, uint256 s) proofPseudo2, tuple(uint256 Px, uint256 Py, uint256 Rx, uint256 Ry, uint256 s) proofKey1) external",

    // Lecture
    "function pseudo1ToCommit(string pseudo1) external view returns (bytes32)",
    "function accountExistsFor(string pseudo1) external view returns (bool)",
    "function getAccountInfo(string pseudo1) external view returns (string name, uint256 createdAt, bool active)",
    "function getNonce(string pseudo1) external view returns (uint256)",
    "function getPendingCount(string pseudo1) external view returns (uint256)",
    "function isSenderBlocked(string pseudo1, address sender, address token) external view returns (bool)",
    "function VERSION() external view returns (uint256)",
    "function PROTOCOL_NAME() external view returns (string)",
    "function PROTOCOL_VERSION() external view returns (string)",
    "function TIMEOUT() external view returns (uint256)",

    // Evenements
    "event AccountCreated(string indexed pseudo1, uint256 timestamp)",
    "event AccountDeactivated(string indexed pseudo1, uint256 timestamp)",
    "event TransferPending(string indexed pseudo1, bytes32 indexed key2Commit, address indexed from, address token, uint256 amount, uint256 timestamp)",
    "event TransferApproved(string indexed pseudo1, address indexed from, address indexed token, uint256 amount)",
    "event TransferRejected(string indexed pseudo1, address indexed from, address indexed token, uint256 amount)",
    "event SentFromHash1(string indexed pseudo1, address indexed stealthAddress, uint256 stealthRx, uint256 stealthRy, address token, uint256 amount)",
    "event EscrowTransfer(string indexed fromPseudo1, string indexed toPseudo1, address indexed token, uint256 amount)"
];

/**
 * ABI minimal de GhostVerifier.
 * Interface que tout contrat Ghost-compatible doit implementer.
 */
const GHOST_VERIFIER_ABI = [
    {
        name: 'verifyGhostProof',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'commitment', type: 'bytes32' },
            {
                name: 'proof',
                type: 'tuple',
                components: [
                    { name: 'Px', type: 'uint256' },
                    { name: 'Py', type: 'uint256' },
                    { name: 'Rx', type: 'uint256' },
                    { name: 'Ry', type: 'uint256' },
                    { name: 's',  type: 'uint256' }
                ]
            },
            { name: 'challenge', type: 'bytes32' }
        ],
        outputs: [{ name: 'valid', type: 'bool' }]
    },
    {
        name: 'ghostSDKVersion',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: 'version', type: 'string' }]
    }
];

/**
 * Adresses des contrats Ghost Protocol par reseau.
 */
const GHOST_PROTOCOL_ADDRESSES = {
    8453: {
        v1: '0x747bb06a40F3f895F7d7BB8764C9B23a4bC11929',
        v2: '0x4ae6Aa27aB7c822970D2cb7575bF8e6F5cea00aB'
    },
    84532: {
        v1: null,
        v2: null
    }
};

/**
 * Registre des contrats Ghost Verified par reseau.
 * Contrats audites et compatibles Ghost Protocol.
 */
const GHOST_VERIFIED_CONTRACTS = {
    8453: {
        GhostProtocolV1: {
            address:     '0x747bb06a40F3f895F7d7BB8764C9B23a4bC11929',
            version:     '1.0.0',
            audited:     false,
            description: 'Ghost Protocol V1 — ECDSA secp256k1'
        },
        GhostProtocolV2: {
            address:     '0x4ae6Aa27aB7c822970D2cb7575bF8e6F5cea00aB',
            version:     '2.0.0',
            audited:     false,
            description: 'Ghost Protocol V2 — Schnorr BN256'
        }
    },
    84532: {},
    1:     {}
};

/**
 * Domain separator par defaut pour le registre de bonus presale.
 */
const DEFAULT_BONUS_CREDENTIAL_DOMAIN = ethers.keccak256(
    ethers.toUtf8Bytes('GhostPresaleBonusRegistry.v1')
);

const GHOST_SDK_VERSION = '1.0.0-beta';

// =============================================================================
// SECTION 2 — CLIENT DE LECTURE ON-CHAIN (GhostProtocolV2Client)
// =============================================================================

/**
 * Client lecture et encodage autour de GhostProtocolV2.
 * Permet d'indexer, decoder et interagir en lecture avec le contrat.
 */
class GhostProtocolV2Client {

    /**
     * @param {string}         protocolAddress  Adresse du contrat GhostProtocolV2
     * @param {ContractRunner} runner           ethers.js provider ou signer
     */
    constructor(protocolAddress, runner) {
        this.address  = protocolAddress;
        this.contract = new ethers.Contract(
            protocolAddress,
            GHOST_PROTOCOL_V2_ABI,
            runner
        );
        this._interface = new ethers.Interface(GHOST_PROTOCOL_V2_ABI);
    }

    // -------------------------------------------------------------------------
    // Lecture
    // -------------------------------------------------------------------------

    /**
     * Retourne le commitment associe a un pseudo1.
     * @param {string} pseudo1
     * @returns {Promise<string>} bytes32 hex
     */
    async pseudo1ToCommit(pseudo1) {
        return this.contract.pseudo1ToCommit(pseudo1);
    }

    /**
     * Verifie si un compte Ghost Protocol existe et est actif.
     * @param {string} pseudo1
     * @returns {Promise<boolean>}
     */
    async accountExistsFor(pseudo1) {
        return this.contract.accountExistsFor(pseudo1);
    }

    /**
     * Retourne les informations publiques d'un compte.
     * @param {string} pseudo1
     * @returns {Promise<{ name: string, createdAt: bigint, active: boolean }>}
     */
    async getAccountInfo(pseudo1) {
        const [name, createdAt, active] = await this.contract.getAccountInfo(pseudo1);
        return { name, createdAt, active };
    }

    /**
     * Retourne le nonce actuel d'un compte.
     * @param {string} pseudo1
     * @returns {Promise<bigint>}
     */
    async getNonce(pseudo1) {
        return this.contract.getNonce(pseudo1);
    }

    /**
     * Retourne le nombre de transferts en attente pour un compte.
     * @param {string} pseudo1
     * @returns {Promise<bigint>}
     */
    async getPendingCount(pseudo1) {
        return this.contract.getPendingCount(pseudo1);
    }

    /**
     * Verifie si un expediteur est bloque pour un token donne.
     * @param {string}  pseudo1
     * @param {string}  sender
     * @param {string}  token
     * @returns {Promise<boolean>}
     */
    async isSenderBlocked(pseudo1, sender, token) {
        return this.contract.isSenderBlocked(pseudo1, sender, token);
    }

    /**
     * Retourne la version du contrat.
     * @returns {Promise<bigint>}
     */
    async getVersion() {
        return this.contract.VERSION();
    }

    // -------------------------------------------------------------------------
    // Encodage des calldata
    // -------------------------------------------------------------------------

    /**
     * Encode les calldata pour createAccount.
     * @param {{ pseudo1, pseudo2Commit, key1Commit, key2Commit }} params
     * @returns {string} calldata hex
     */
    encodeCreateAccount(params) {
        return this._interface.encodeFunctionData('createAccount', [
            params.pseudo1,
            params.pseudo2Commit,
            params.key1Commit,
            params.key2Commit
        ]);
    }

    // -------------------------------------------------------------------------
    // Decodage des transactions
    // -------------------------------------------------------------------------

    /**
     * Decode les calldata d'une transaction createAccount.
     * @param {string} data  calldata hex
     * @returns {{ pseudo1, pseudo2Commit, key1Commit, key2Commit } | null}
     */
    static decodeCreateAccountCalldata(data) {
        try {
            const iface  = new ethers.Interface(GHOST_PROTOCOL_V2_ABI);
            const parsed = iface.parseTransaction({ data });
            if (!parsed || parsed.name !== 'createAccount') return null;
            const [pseudo1, pseudo2Commit, key1Commit, key2Commit] = parsed.args;
            return { pseudo1, pseudo2Commit, key1Commit, key2Commit };
        } catch {
            return null;
        }
    }

    /**
     * Decode les parametres de createAccount depuis une TransactionResponse.
     * @param {TransactionResponse} tx
     * @returns {{ pseudo1, pseudo2Commit, key1Commit, key2Commit } | null}
     */
    static decodeCreateAccountFromTx(tx) {
        if (!tx || !tx.data) return null;
        return GhostProtocolV2Client.decodeCreateAccountCalldata(tx.data);
    }

    /**
     * Decode les parametres de createAccount depuis un TransactionReceipt.
     * Recupere la transaction complete via le provider.
     * @param {TransactionReceipt} receipt
     * @param {Provider}           provider
     * @returns {Promise<{ pseudo1, pseudo2Commit, key1Commit, key2Commit } | null>}
     */
    static async decodeCreateAccountFromReceipt(receipt, provider) {
        try {
            if (!receipt || !receipt.hash) return null;
            const tx = await provider.getTransaction(receipt.hash);
            if (!tx) return null;
            return GhostProtocolV2Client.decodeCreateAccountFromTx(tx);
        } catch {
            return null;
        }
    }

    /**
     * Scanne les evenements AccountCreated dans une plage de blocs.
     * @param {number} fromBlock
     * @param {number} toBlock
     * @returns {Promise<Array>}
     */
    async scanAccountCreated(fromBlock, toBlock = 'latest') {
        const filter = this.contract.filters.AccountCreated();
        const events = await this.contract.queryFilter(filter, fromBlock, toBlock);
        return events.map(e => ({
            pseudo1:     e.args.pseudo1,
            timestamp:   e.args.timestamp,
            blockNumber: e.blockNumber,
            txHash:      e.transactionHash
        }));
    }

    /**
     * Scanne les evenements TransferPending pour un pseudo1 donne.
     * @param {string} pseudo1
     * @param {number} fromBlock
     * @param {number} toBlock
     * @returns {Promise<Array>}
     */
    async scanPendingTransfers(pseudo1, fromBlock, toBlock = 'latest') {
        const filter = this.contract.filters.TransferPending(pseudo1);
        const events = await this.contract.queryFilter(filter, fromBlock, toBlock);
        return events.map(e => ({
            pseudo1:     e.args.pseudo1,
            key2Commit:  e.args.key2Commit,
            from:        e.args.from,
            token:       e.args.token,
            amount:      e.args.amount,
            timestamp:   e.args.timestamp,
            blockNumber: e.blockNumber,
            txHash:      e.transactionHash
        }));
    }
}

// =============================================================================
// SECTION 3 — BONUS PRESALE (GhostPresaleBonusRegistry)
// =============================================================================

/**
 * Calcule l'identifiant unique d'un acheteur presale.
 * Reproduit exactement le calcul effectue on-chain dans GhostPresaleBonusRegistry.
 *
 * @param {{
 *   buyer:                    string,   Adresse EVM de l'acheteur
 *   ghostPurchasedWei:        bigint,   Montant achete en wei
 *   presaleAddress:           string,   Adresse du contrat presale
 *   chainId:                  bigint,   Chain ID
 *   credentialDomainSeparator: string   Domain separator (DEFAULT_BONUS_CREDENTIAL_DOMAIN par defaut)
 * }} params
 * @returns {string} credentialId bytes32
 */
function computePresaleBonusCredentialId(params) {
    const domainSeparator = params.credentialDomainSeparator
        || DEFAULT_BONUS_CREDENTIAL_DOMAIN;

    const packed = ethers.solidityPacked(
        ['address', 'uint256', 'address', 'uint256', 'bytes32'],
        [
            params.buyer,
            params.ghostPurchasedWei,
            params.presaleAddress,
            params.chainId,
            domainSeparator
        ]
    );

    return ethers.keccak256(packed);
}

/**
 * Verifie si l'adresse `buyer` est enregistree sur GhostPresaleBonusRegistry
 * (apres `recordEligibility` — coherent avec GhostPresaleBonusRegistry.sol).
 *
 * @param {string}   registryAddress
 * @param {string}   buyer            Adresse EVM acheteur / claim presale
 * @param {Provider} provider
 * @returns {Promise<boolean>}
 */
async function checkPresaleBonusRegistered(registryAddress, buyer, provider) {
    const REGISTRY_ABI = ['function registered(address buyer) external view returns (bool)'];
    const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, provider);
    try {
        return await registry.registered(buyer);
    } catch {
        return false;
    }
}

/**
 * @deprecated Utiliser checkPresaleBonusRegistered — le contrat n'expose pas isEligible(bytes32).
 * Compat : si `secondArg` ressemble a une adresse (42 chars), traite comme buyer.
 */
async function checkPresaleBonus(registryAddress, credentialIdOrBuyer, provider) {
    const a = credentialIdOrBuyer;
    if (typeof a === 'string' && a.length === 42 && a.startsWith('0x')) {
        return checkPresaleBonusRegistered(registryAddress, a, provider);
    }
    console.warn(
        'checkPresaleBonus: GhostPresaleBonusRegistry n\'a pas isEligible(bytes32). ' +
            'Utilisez checkPresaleBonusRegistered(registry, buyer, provider).'
    );
    return false;
}

/**
 * Basis points du bonus sur le contrat (ex. 500 = 5 %). Public sur GhostPresaleBonusRegistry.
 */
async function getPresaleBonusBps(registryAddress, provider) {
    const REGISTRY_ABI = ['function bonusBps() external view returns (uint256)'];
    const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, provider);
    try {
        return await registry.bonusBps();
    } catch {
        return 0n;
    }
}

/**
 * Montant GHOST (wei) du bonus pour un buyer enregistre.
 */
async function getPresaleBonusGhostAmount(registryAddress, buyer, provider) {
    const REGISTRY_ABI = ['function bonusGhostAmount(address buyer) external view returns (uint256)'];
    const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, provider);
    try {
        return await registry.bonusGhostAmount(buyer);
    } catch {
        return 0n;
    }
}

/**
 * credentialId on-chain pour un buyer deja enregistre (0x0 si non enregistre).
 */
async function getPresaleCredentialIdOnChain(registryAddress, buyer, provider) {
    const REGISTRY_ABI = ['function credentialIdOf(address buyer) external view returns (bytes32)'];
    const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, provider);
    try {
        return await registry.credentialIdOf(buyer);
    } catch {
        return ethers.ZeroHash;
    }
}

/**
 * @deprecated Le registre n'a pas getBonusPercent(bytes32). Utiliser getPresaleBonusBps.
 */
async function getPresaleBonusPercent(registryAddress, credentialId, provider) {
    console.warn(
        'getPresaleBonusPercent: utilisez getPresaleBonusBps(registry, provider) — bonus global en bps.'
    );
    return getPresaleBonusBps(registryAddress, provider);
}

// =============================================================================
// SECTION 4 — CONNEXION AUX CONTRATS EXTERNES (GhostSDK)
// =============================================================================

/**
 * SDK de connexion aux contrats externes EVM.
 * Permet a l'UX Ghost Protocol d'interagir avec n'importe quel contrat
 * en preservant l'identite cryptographique Schnorr BN256 de l'utilisateur.
 *
 * Principe :
 *   L'adresse du contrat externe est incluse dans le challenge Schnorr.
 *   Chaque connexion est unique et non rejouable sur un autre contrat.
 */
class GhostSDK {

    /**
     * @param {object} ghostSchnorr  Instance de GhostSchnorr (ghost-schnorr-libz.js)
     * @param {object} provider      ethers.js JsonRpcProvider
     */
    constructor(ghostSchnorr, provider) {
        this.GhostSchnorr = ghostSchnorr;
        this.provider     = provider;
        this.connections  = new Map();
        this.chainId      = null;
        this._initChainId();
    }

    async _initChainId() {
        try {
            const network = await this.provider.getNetwork();
            this.chainId  = Number(network.chainId);
        } catch (e) {
            console.warn('GhostSDK: impossible de recuperer le chainId', e.message);
        }
    }

    // -------------------------------------------------------------------------
    // Registre
    // -------------------------------------------------------------------------

    /**
     * Verifie si un contrat est dans le registre Ghost Verified.
     * @param {string} contractAddress
     * @returns {{ verified: boolean, name: string|null, info: object|null }}
     */
    isVerified(contractAddress) {
        const chainContracts = GHOST_VERIFIED_CONTRACTS[this.chainId] || {};
        const addr           = contractAddress.toLowerCase();

        for (const [name, info] of Object.entries(chainContracts)) {
            if (info.address.toLowerCase() === addr) {
                return { verified: true, name, info };
            }
        }
        return { verified: false, name: null, info: null };
    }

    /**
     * Retourne tous les contrats verifies pour le reseau actuel.
     * @returns {object}
     */
    getVerifiedContracts() {
        return GHOST_VERIFIED_CONTRACTS[this.chainId] || {};
    }

    /**
     * Ajoute un contrat verifie au registre (session uniquement).
     * @param {string} name
     * @param {string} address
     * @param {string} description
     */
    addVerifiedContract(name, address, description = '') {
        if (!GHOST_VERIFIED_CONTRACTS[this.chainId]) {
            GHOST_VERIFIED_CONTRACTS[this.chainId] = {};
        }
        GHOST_VERIFIED_CONTRACTS[this.chainId][name] = {
            address,
            version:     'custom',
            audited:     false,
            description: description || `Contrat personnalise : ${name}`
        };
    }

    // -------------------------------------------------------------------------
    // Connexion
    // -------------------------------------------------------------------------

    /**
     * Connecte l'UX a un contrat externe.
     * @param {string} contractAddress
     * @param {Array}  abi
     * @returns {Promise<{ contract, verified, ghostNative, warning }>}
     */
    async connect(contractAddress, abi) {
        if (!ethers.isAddress(contractAddress)) {
            throw new Error('GhostSDK: adresse de contrat invalide');
        }

        const { verified, name, info } = this.isVerified(contractAddress);

        const contract = new ethers.Contract(
            contractAddress,
            abi,
            this.provider
        );

        let ghostNative = false;
        try {
            await contract.ghostSDKVersion();
            ghostNative = true;
        } catch {
            // Contrat non Ghost-native — comportement normal
        }

        this.connections.set(contractAddress.toLowerCase(), {
            contract,
            verified,
            ghostNative,
            name: name || 'Inconnu',
            info: info || null
        });

        return {
            contract,
            verified,
            ghostNative,
            warning: !verified
                ? 'Ce contrat ne figure pas dans le registre Ghost Verified. Verifiez sa fiabilite avant de soumettre des fonds.'
                : null
        };
    }

    /**
     * Recupere une connexion existante.
     * @param {string} contractAddress
     * @returns {object|null}
     */
    getConnection(contractAddress) {
        return this.connections.get(contractAddress.toLowerCase()) || null;
    }

    // -------------------------------------------------------------------------
    // Challenges et preuves Schnorr
    // -------------------------------------------------------------------------

    /**
     * Construit un challenge unique pour une action sur un contrat externe.
     * L'adresse du contrat est incluse — non rejouable ailleurs.
     *
     * @param {string} action           Nom de l'action
     * @param {string} pseudo1          Pseudo Ghost de l'utilisateur
     * @param {string} contractAddress  Adresse du contrat cible
     * @param {bigint} nonce            Nonce actuel
     * @param {object} params           Parametres additionnels
     * @returns {string} challenge bytes32
     */
    buildExternalChallenge(action, pseudo1, contractAddress, nonce, params = {}) {
        const paramsStr = Object.values(params)
            .map(v => String(v))
            .join('|');

        const chain = this.chainId != null ? BigInt(this.chainId) : 0n;

        // bytes32 déterministe — aligné sur un packing explicite (ne pas passer un tableau à keccakPacked)
        return ethers.keccak256(
            ethers.solidityPacked(
                ['string', 'string', 'address', 'uint256', 'uint256', 'string'],
                [
                    `ghost_sdk_${action}`,
                    pseudo1,
                    ethers.getAddress(contractAddress),
                    nonce,
                    chain,
                    paramsStr
                ]
            )
        );
    }

    /**
     * Genere les preuves Schnorr pour une action sur un contrat externe.
     *
     * @param {string}   action           Nom de l'action
     * @param {string}   pseudo1          Pseudo Ghost
     * @param {string}   contractAddress  Contrat cible
     * @param {bigint}   nonce            Nonce actuel
     * @param {object}   keys             { pseudo2, key1, key2 } avec { K, Px, Py }
     * @param {object}   params           Parametres de l'action
     * @param {string[]} requiredKeys     Cles requises ex: ['pseudo2', 'key1']
     * @returns {{ challenge, proofs, contractAddress, pseudo1, nonce, action, params }}
     */
    prepareExternalAction(
        action,
        pseudo1,
        contractAddress,
        nonce,
        keys,
        params       = {},
        requiredKeys = ['pseudo2', 'key1']
    ) {
        const challenge = this.buildExternalChallenge(
            action, pseudo1, contractAddress, nonce, params
        );

        const proofs = {};

        for (const keyName of requiredKeys) {
            if (!keys[keyName]) {
                throw new Error(`GhostSDK: cle manquante — ${keyName}`);
            }

            const { K, Px, Py } = keys[keyName];
            const rawProof      = this.GhostSchnorr.sign(K, Px, Py, challenge);
            const commitment    = this.GhostSchnorr.deriveCommitment(Px, Py);
            const valid         = this.GhostSchnorr.verifyLocally(
                commitment, rawProof, challenge
            );

            if (!valid) {
                throw new Error(`GhostSDK: preuve locale invalide pour ${keyName}`);
            }

            proofs[`proof_${keyName}`] = this.GhostSchnorr.encodeProof(rawProof);
        }

        return {
            challenge,
            proofs,
            contractAddress,
            pseudo1,
            nonce,
            action,
            params
        };
    }

    // -------------------------------------------------------------------------
    // Execution des transactions
    // -------------------------------------------------------------------------

    /**
     * Execute une transaction vers un contrat externe
     * via un wallet de gas ephemere (pattern Ghost Protocol).
     *
     * @param {string} contractAddress
     * @param {string} functionName
     * @param {Array}  functionArgs
     * @param {Wallet} gasWallet       Wallet ephemere pour payer le gas
     * @param {object} options         { value, gasLimit }
     * @returns {Promise<{ hash, blockNumber, gasUsed, status, contract, function, verified }>}
     */
    async executeExternal(contractAddress, functionName, functionArgs, gasWallet, options = {}) {
        const conn = this.getConnection(contractAddress);
        if (!conn) {
            throw new Error('GhostSDK: contrat non connecte — appelez connect() au prealable');
        }

        if (!conn.verified) {
            console.warn(`GhostSDK: interaction avec contrat non verifie : ${contractAddress}`);
        }

        const connectedContract = conn.contract.connect(
            gasWallet.connect(this.provider)
        );

        let gasEstimate;
        try {
            gasEstimate = await connectedContract[functionName].estimateGas(
                ...functionArgs,
                options.value ? { value: options.value } : {}
            );
            gasEstimate = gasEstimate * BigInt(120) / BigInt(100);
        } catch {
            gasEstimate = BigInt(options.gasLimit || 300000);
        }

        const tx = await connectedContract[functionName](
            ...functionArgs,
            {
                gasLimit: gasEstimate,
                ...(options.value ? { value: options.value } : {})
            }
        );

        const receipt = await tx.wait();

        return {
            hash:        tx.hash,
            blockNumber: receipt.blockNumber,
            gasUsed:     receipt.gasUsed.toString(),
            status:      receipt.status === 1 ? 'success' : 'failed',
            contract:    contractAddress,
            function:    functionName,
            verified:    conn.verified
        };
    }

    /**
     * Appel en lecture seule sur un contrat externe.
     * @param {string} contractAddress
     * @param {string} functionName
     * @param {Array}  args
     * @returns {Promise<any>}
     */
    async readExternal(contractAddress, functionName, args = []) {
        const conn = this.getConnection(contractAddress);
        if (!conn) {
            throw new Error('GhostSDK: contrat non connecte');
        }
        return conn.contract[functionName](...args);
    }

    // -------------------------------------------------------------------------
    // Wallets ephemeres
    // -------------------------------------------------------------------------

    /**
     * Genere un wallet de gas ephemere.
     * Pattern Ghost Protocol — utilise une seule fois puis supprime.
     * @returns {{ wallet, address, privateKey }}
     */
    generateEphemeralGasWallet() {
        const wallet = ethers.Wallet.createRandom();
        return {
            wallet,
            address:    wallet.address,
            privateKey: wallet.privateKey
        };
    }

    /**
     * Verifie si le solde d'un wallet ephemere est suffisant pour le gas.
     * @param {string} walletAddress
     * @param {bigint} estimatedGasUnits
     * @returns {Promise<{ sufficient, balance, needed, balanceETH, neededETH }>}
     */
    async checkGasBalance(walletAddress, estimatedGasUnits) {
        const balance  = await this.provider.getBalance(walletAddress);
        const gasPrice = (await this.provider.getFeeData()).gasPrice || BigInt(0);
        const needed   = estimatedGasUnits * gasPrice;

        return {
            sufficient: balance >= needed,
            balance,
            needed,
            balanceETH: ethers.formatEther(balance),
            neededETH:  ethers.formatEther(needed)
        };
    }

    // -------------------------------------------------------------------------
    // Statut des connexions
    // -------------------------------------------------------------------------

    /**
     * Retourne le statut complet d'une connexion.
     * @param {string} contractAddress
     * @returns {object}
     */
    getConnectionStatus(contractAddress) {
        const conn = this.getConnection(contractAddress);
        if (!conn) {
            return {
                connected:   false,
                verified:    false,
                ghostNative: false,
                status:      'Non connecte'
            };
        }

        return {
            connected:   true,
            verified:    conn.verified,
            ghostNative: conn.ghostNative,
            name:        conn.name,
            info:        conn.info,
            status:      conn.verified
                ? 'Ghost Verified'
                : conn.ghostNative
                    ? 'Ghost Compatible'
                    : 'Non verifie',
            warning:     !conn.verified
                ? 'Contrat non verifie — procédez avec prudence'
                : null
        };
    }

    /**
     * Deconnecte un contrat specifique.
     * @param {string} contractAddress
     */
    disconnect(contractAddress) {
        this.connections.delete(contractAddress.toLowerCase());
    }

    /**
     * Deconnecte tous les contrats.
     */
    disconnectAll() {
        this.connections.clear();
    }
}

// =============================================================================
// SECTION 5 — CONTRAT SOLIDITY : GhostVerifier.sol
// =============================================================================

/**
 * Code source Solidity de GhostVerifier.
 * A deployer par les developpeurs tiers qui souhaitent
 * accepter les preuves Schnorr Ghost Protocol dans leurs contrats.
 *
 * Usage :
 *   import "./GhostVerifier.sol";
 *   contract MonContrat is GhostVerifier { ... }
 */
const GHOST_VERIFIER_SOLIDITY = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  GhostVerifier
 * @author RayTech R&D — Rayane Hila
 * @notice Verification Schnorr BN256 reutilisable pour contrats tiers.
 *         Importez ce contrat pour accepter les preuves Ghost Protocol.
 */
contract GhostVerifier {

    uint256 private constant BN256_GX    = 1;
    uint256 private constant BN256_GY    = 2;
    uint256 private constant BN256_ORDER =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    struct SchnorrProof {
        uint256 Px;
        uint256 Py;
        uint256 Rx;
        uint256 Ry;
        uint256 s;
    }

    string public constant ghostSDKVersion = "1.0.0";

    /**
     * @notice Verifie une preuve Schnorr BN256.
     * @param commitment  keccak256(abi.encodePacked(Px, Py))
     * @param proof       Preuve Schnorr
     * @param challenge   Challenge genere par le contrat appelant
     * @return valid      True si la preuve est valide
     */
    function verifyGhostProof(
        bytes32              commitment,
        SchnorrProof calldata proof,
        bytes32              challenge
    ) public view returns (bool valid) {
        if (keccak256(abi.encodePacked(proof.Px, proof.Py)) != commitment) {
            return false;
        }
        (uint256 sGx, uint256 sGy) = _ecMul(BN256_GX, BN256_GY, proof.s);
        (uint256 ePx, uint256 ePy) = _ecMul(proof.Px, proof.Py, uint256(challenge));
        (uint256 rhsx, uint256 rhsy) = _ecAdd(proof.Rx, proof.Ry, ePx, ePy);
        return (sGx == rhsx && sGy == rhsy);
    }

    /**
     * @notice Construit un challenge lie a ce contrat.
     * @dev    L'inclusion de address(this) rend la preuve non rejouable ailleurs.
     */
    function buildGhostChallenge(
        string  calldata action,
        string  calldata pseudo1,
        uint256          nonce,
        bytes   calldata params
    ) public view returns (bytes32) {
        return keccak256(abi.encodePacked(
            "ghost_sdk_",
            action,
            pseudo1,
            address(this),
            block.chainid,
            nonce,
            params
        ));
    }

    function _ecMul(
        uint256 x, uint256 y, uint256 scalar
    ) internal view returns (uint256 rx, uint256 ry) {
        scalar = scalar % BN256_ORDER;
        if (scalar == 0) return (0, 0);
        uint256[3] memory input  = [x, y, scalar];
        uint256[2] memory result;
        bool ok;
        assembly { ok := staticcall(gas(), 0x07, input, 0x60, result, 0x40) }
        require(ok, "GhostVerifier: ecMul failed");
        return (result[0], result[1]);
    }

    function _ecAdd(
        uint256 x1, uint256 y1, uint256 x2, uint256 y2
    ) internal view returns (uint256 rx, uint256 ry) {
        uint256[4] memory input  = [x1, y1, x2, y2];
        uint256[2] memory result;
        bool ok;
        assembly { ok := staticcall(gas(), 0x06, input, 0x80, result, 0x40) }
        require(ok, "GhostVerifier: ecAdd failed");
        return (result[0], result[1]);
    }
}
`;

// =============================================================================
// EXPORTS
// =============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // Constantes
        GHOST_SDK_VERSION,
        GHOST_PROTOCOL_V2_ABI,
        GHOST_VERIFIER_ABI,
        GHOST_PROTOCOL_ADDRESSES,
        GHOST_VERIFIED_CONTRACTS,
        DEFAULT_BONUS_CREDENTIAL_DOMAIN,
        GHOST_VERIFIER_SOLIDITY,

        // Client lecture on-chain
        GhostProtocolV2Client,

        // Connexion contrats externes
        GhostSDK,

        // Bonus presale (aligne GhostPresaleBonusRegistry.sol)
        computePresaleBonusCredentialId,
        checkPresaleBonusRegistered,
        checkPresaleBonus,
        getPresaleBonusBps,
        getPresaleBonusGhostAmount,
        getPresaleCredentialIdOnChain,
        getPresaleBonusPercent
    };
}

/*
 * =============================================================================
 * EXEMPLE D'UTILISATION
 * =============================================================================
 *
 * const {
 *     GhostProtocolV2Client,
 *     GhostSDK,
 *     computePresaleBonusCredentialId,
 *     DEFAULT_BONUS_CREDENTIAL_DOMAIN,
 *     GHOST_PROTOCOL_ADDRESSES
 * } = require('./ghost-sdk');
 *
 * // 1. Lecture on-chain
 * const client = new GhostProtocolV2Client(
 *     GHOST_PROTOCOL_ADDRESSES[8453].v2,
 *     provider
 * );
 * const exists = await client.accountExistsFor('monPseudo');
 * const nonce  = await client.getNonce('monPseudo');
 *
 * // 2. Decodage de transaction
 * const params = GhostProtocolV2Client.decodeCreateAccountFromTx(tx);
 * // { pseudo1, pseudo2Commit, key1Commit, key2Commit }
 *
 * // 3. Bonus presale
 * const credentialId = computePresaleBonusCredentialId({
 *     buyer:                    '0xAcheteur...',
 *     ghostPurchasedWei:        ethers.parseEther('0.5'),
 *     presaleAddress:           '0xContratPresale...',
 *     chainId:                  8453n,
 *     credentialDomainSeparator: DEFAULT_BONUS_CREDENTIAL_DOMAIN
 * });
 *
 * // 4. Connexion contrat externe
 * const sdk = new GhostSDK(GhostSchnorr, provider);
 * const { verified, warning } = await sdk.connect('0xContratExterne...', monABI);
 *
 * const { challenge, proofs } = sdk.prepareExternalAction(
 *     'monAction',
 *     'monPseudo',
 *     '0xContratExterne...',
 *     nonce,
 *     { pseudo2: keys.pseudo2, key1: keys.key1 },
 *     { montant: '1000', token: '0x...' },
 *     ['pseudo2', 'key1']
 * );
 *
 * const { wallet: gasWallet } = sdk.generateEphemeralGasWallet();
 * // Financer gasWallet, puis :
 * const result = await sdk.executeExternal(
 *     '0xContratExterne...',
 *     'monAction',
 *     ['monPseudo', proofs.proof_pseudo2, proofs.proof_key1, challenge],
 *     gasWallet
 * );
 */
