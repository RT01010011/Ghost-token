// Ghost Protocol V2 — Schnorr BN256 (doc : docs/desktop-readme/README_ghost-schnorr-libz.js.md)
const BN256 = (() => {

    const P = BigInt("21888242871839275222246405745257275088696311157297823662689037894645226208583");
    const N = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
    const GX = 1n;
    const GY = 2n;

    const mod = (a, m = P) => ((a % m) + m) % m;

    function modpow(base, exp, m) {
        base = mod(base, m);
        let result = 1n;
        while (exp > 0n) {
            if (exp & 1n) result = mod(result * base, m);
            base = mod(base * base, m);
            exp >>= 1n;
        }
        return result;
    }

    const modinv = (a, m = P) => modpow(mod(a, m), m - 2n, m);

    function pointAdd(P1, P2) {
        if (P1 === null) return P2;
        if (P2 === null) return P1;

        const [x1, y1] = P1;
        const [x2, y2] = P2;

        if (x1 === x2) {
            if (y1 !== y2) return null;

            const lambda = mod(3n * x1 * x1 * modinv(2n * y1));
            const x3 = mod(lambda * lambda - 2n * x1);
            const y3 = mod(lambda * (x1 - x3) - y1);
            return [x3, y3];
        }

        const lambda = mod((y2 - y1) * modinv(x2 - x1));
        const x3 = mod(lambda * lambda - x1 - x2);
        const y3 = mod(lambda * (x1 - x3) - y1);
        return [x3, y3];
    }

    function scalarMul(k, point = [GX, GY]) {
        k = mod(k, N);
        if (k === 0n) return null;

        let result = null;
        let addend = point;

        while (k > 0n) {
            if (k & 1n) result = pointAdd(result, addend);
            addend = pointAdd(addend, addend);
            k >>= 1n;
        }
        return result;
    }

    return { P, N, GX, GY, mod, modpow, modinv, pointAdd, scalarMul };
})();

const GhostSchnorr = (() => {

    function toBytes32(n) {
        return "0x" + n.toString(16).padStart(64, "0");
    }

    function fromBytes32(hex) {
        return BigInt(hex);
    }

    function keccak256(data) {
        if (typeof data === "string" && !data.startsWith("0x")) {
            return ethers.keccak256(ethers.toUtf8Bytes(data));
        }
        return ethers.keccak256(data);
    }

    function keccakPacked(...args) {
        return ethers.keccak256(ethers.solidityPacked(
            args.map(a => {
                if (typeof a === "bigint") return "uint256";
                if (typeof a === "string" && a.startsWith("0x") && a.length === 66) return "bytes32";
                if (typeof a === "string" && a.startsWith("0x") && a.length === 42) return "address";
                if (typeof a === "string") return "string";
                if (typeof a === "number") return "uint256";
                return "bytes32";
            }),
            args
        ));
    }

    function randomScalar() {
        const bytes = ethers.randomBytes(32);
        const hex = ethers.hexlify(bytes);
        const n = BigInt(hex);
        return BN256.mod(n === 0n ? 1n : n, BN256.N);
    }

    function derivePrivateKey(password) {
        const hash = keccak256(password);
        const K = BN256.mod(BigInt(hash), BN256.N);
        if (K === 0n) throw new Error("Invalid password: produces zero key");
        return K;
    }

    function derivePublicKey(K) {
        const P = BN256.scalarMul(K);
        if (!P) throw new Error("Invalid key: produces point at infinity");
        return { Px: P[0], Py: P[1] };
    }

    function deriveCommitment(Px, Py) {
        return ethers.keccak256(
            ethers.solidityPacked(["uint256", "uint256"], [Px, Py])
        );
    }

    function deriveAll(password) {
        const K = derivePrivateKey(password);
        const { Px, Py } = derivePublicKey(K);
        const commitment = deriveCommitment(Px, Py);
        return { commitment, K, Px, Py };
    }

    function sign(K, Px, Py, challenge) {

        const r = randomScalar();

        const R = BN256.scalarMul(r);
        if (!R) throw new Error("Schnorr: r produced point at infinity");
        const [Rx, Ry] = R;

        const e = BN256.mod(BigInt(challenge), BN256.N);

        const s = BN256.mod(r + BN256.mod(K * e, BN256.N), BN256.N);

        return { Px, Py, Rx, Ry, s };
    }

    function verifyLocally(commitment, proof, challenge) {

        const expectedCommit = deriveCommitment(proof.Px, proof.Py);
        if (expectedCommit.toLowerCase() !== commitment.toLowerCase()) {
            console.warn("Schnorr verify: commitment mismatch");
            return false;
        }

        const e = BN256.mod(BigInt(challenge), BN256.N);

        const sG = BN256.scalarMul(proof.s);

        const eP = BN256.scalarMul(e, [proof.Px, proof.Py]);

        const rhs = BN256.pointAdd([proof.Rx, proof.Ry], eP);

        if (!sG || !rhs) return false;

        return sG[0] === rhs[0] && sG[1] === rhs[1];
    }

    function encodeProof(proof) {
        return {
            Px: toBytes32(proof.Px),
            Py: toBytes32(proof.Py),
            Rx: toBytes32(proof.Rx),
            Ry: toBytes32(proof.Ry),
            s:  toBytes32(proof.s),
        };
    }

    function prepareCreateAccount(pseudo1, pseudo2, key1Pass, key2Pass) {
        const p2 = deriveAll(pseudo2);
        const k1 = deriveAll(key1Pass);
        const k2 = deriveAll(key2Pass);

        return {
            pseudo1,
            pseudo2Commit: p2.commitment,
            key1Commit:    k1.commitment,
            key2Commit:    k2.commitment,

            _keys: { pseudo2: p2, key1: k1, key2: k2 }
        };
    }

    function buildChallengeApprove(action, pseudo1, transferIndex, nonce, contractAddress, chainId) {
        return keccakPacked(action, pseudo1, transferIndex, nonce, contractAddress, chainId);
    }

    function prepareApproveReceive(keys, pseudo1, transferIndex, nonce, contractAddress, chainId) {
        const challengeP2 = buildChallengeApprove(
            "approve", pseudo1, transferIndex, nonce, contractAddress, chainId
        );
        const challengeK1 = buildChallengeApprove(
            "approve_key1", pseudo1, transferIndex, nonce, contractAddress, chainId
        );

        const proofP2Raw = sign(keys.pseudo2.K, keys.pseudo2.Px, keys.pseudo2.Py, challengeP2);
        const proofK1Raw = sign(keys.key1.K,    keys.key1.Px,    keys.key1.Py,    challengeK1);

        console.assert(verifyLocally(keys.pseudo2.commitment, proofP2Raw, challengeP2), "pseudo2 proof invalid!");
        console.assert(verifyLocally(keys.key1.commitment,    proofK1Raw, challengeK1), "key1 proof invalid!");

        return {
            proofPseudo2: encodeProof(proofP2Raw),
            proofKey1:    encodeProof(proofK1Raw),
        };
    }

    function prepareRejectReceive(keys, pseudo1, transferIndex, nonce, contractAddress, chainId) {
        const challengeP2 = keccakPacked(
            "reject", pseudo1, transferIndex, nonce, contractAddress, chainId
        );
        const challengeK1 = keccakPacked(
            "reject_key1", pseudo1, transferIndex, nonce, contractAddress, chainId
        );

        const proofP2Raw = sign(keys.pseudo2.K, keys.pseudo2.Px, keys.pseudo2.Py, challengeP2);
        const proofK1Raw = sign(keys.key1.K,    keys.key1.Px,    keys.key1.Py,    challengeK1);

        return {
            proofPseudo2: encodeProof(proofP2Raw),
            proofKey1:    encodeProof(proofK1Raw),
        };
    }

    function generateStealthAddress(Hash2Px, Hash2Py) {

        const r = randomScalar();

        const R = BN256.scalarMul(r);
        if (!R) throw new Error("Stealth: r produced point at infinity");
        const [Rx, Ry] = R;

        const S = BN256.scalarMul(r, [Hash2Px, Hash2Py]);
        if (!S) throw new Error("Stealth: ECDH produced point at infinity");
        const [Sx, Sy] = S;

        const stealthKeyHash = ethers.keccak256(
            ethers.solidityPacked(["uint256", "uint256"], [Sx, Sy])
        );
        const stealthKey = BN256.mod(BigInt(stealthKeyHash), BN256.N);

        const stealthPrivHex = "0x" + stealthKey.toString(16).padStart(64, "0");
        const stealthAddress = new ethers.Wallet(stealthPrivHex).address;

        return {
            stealthAddress,
            stealthRx:    Rx,
            stealthRy:    Ry,
            stealthPrivKey: stealthKey,
        };
    }

    function scanStealthAddress(Hash2PrivKey, stealthRx, stealthRy, stealthAddress) {

        const S = BN256.scalarMul(Hash2PrivKey, [stealthRx, stealthRy]);
        if (!S) return { match: false, stealthPrivKey: null };
        const [Sx, Sy] = S;

        const stealthKeyHash = ethers.keccak256(
            ethers.solidityPacked(["uint256", "uint256"], [Sx, Sy])
        );
        const stealthKey = BN256.mod(BigInt(stealthKeyHash), BN256.N);

        const stealthPrivHex  = "0x" + stealthKey.toString(16).padStart(64, "0");
        const expectedAddress = new ethers.Wallet(stealthPrivHex).address;

        const match = expectedAddress.toLowerCase() === stealthAddress.toLowerCase();

        return {
            match,

            stealthPrivKey: match ? stealthKey : null,
            stealthPrivHex: match ? stealthPrivHex : null,
        };
    }

    function prepareSendFromHash1Stealth(
        keys, pseudo1, Hash2Px, Hash2Py,
        token, amount, nonce, deadline, contractAddress, chainId
    ) {

        const stealth = generateStealthAddress(Hash2Px, Hash2Py);

        const challengeP2 = keccakPacked(
            "send_pseudo2",
            pseudo1, stealth.stealthAddress,
            stealth.stealthRx, stealth.stealthRy,
            token, amount, nonce, deadline, contractAddress, chainId
        );
        const challengeK2 = keccakPacked(
            "send_key2",
            pseudo1, stealth.stealthAddress,
            stealth.stealthRx, stealth.stealthRy,
            token, amount, nonce, deadline, contractAddress, chainId
        );
        const challengeK1 = keccakPacked(
            "send_key1",
            pseudo1, stealth.stealthAddress,
            stealth.stealthRx, stealth.stealthRy,
            token, amount, nonce, deadline, contractAddress, chainId
        );

        const proofP2Raw = sign(keys.pseudo2.K, keys.pseudo2.Px, keys.pseudo2.Py, challengeP2);
        const proofK2Raw = sign(keys.key2.K,    keys.key2.Px,    keys.key2.Py,    challengeK2);
        const proofK1Raw = sign(keys.key1.K,    keys.key1.Px,    keys.key1.Py,    challengeK1);

        console.assert(verifyLocally(keys.pseudo2.commitment, proofP2Raw, challengeP2), "pseudo2 proof invalid!");
        console.assert(verifyLocally(keys.key2.commitment,    proofK2Raw, challengeK2), "key2 proof invalid!");
        console.assert(verifyLocally(keys.key1.commitment,    proofK1Raw, challengeK1), "key1 proof invalid!");

        return {
            stealthAddress:  stealth.stealthAddress,
            stealthRx:       stealth.stealthRx,
            stealthRy:       stealth.stealthRy,
            stealthPrivKey:  stealth.stealthPrivKey,
            stealthPrivHex:  "0x" + stealth.stealthPrivKey.toString(16).padStart(64, "0"),
            proofPseudo2:    encodeProof(proofP2Raw),
            proofKey2:       encodeProof(proofK2Raw),
            proofKey1:       encodeProof(proofK1Raw),
        };
    }

    function prepareGetBalance(keys, pseudo1, token, contractAddress, chainId, blockNumber) {
        const windowedBlock = Math.floor(blockNumber / 100);
        const challenge = keccakPacked(
            "get_balance", pseudo1, token, contractAddress, chainId, windowedBlock
        );
        const proofRaw = sign(keys.key2.K, keys.key2.Px, keys.key2.Py, challenge);
        return { proofKey2: encodeProof(proofRaw) };
    }

    function prepareGetPendingTransfers(keys, pseudo1, contractAddress, chainId, blockNumber) {
        const windowedBlock = Math.floor(blockNumber / 100);
        const challenge = keccakPacked(
            "get_pending", pseudo1, contractAddress, chainId, windowedBlock
        );

        const proofRaw = sign(keys.key2.K, keys.key2.Px, keys.key2.Py, challenge);
        return { proofKey2: encodeProof(proofRaw) };
    }

    function prepareClaimETH(keys, pseudo1, recipient, amount, nonce, deadline, contractAddress, chainId) {
        const challengeP2 = keccakPacked("claim_eth_pseudo2", pseudo1, recipient, amount, nonce, deadline, contractAddress, chainId);
        const challengeK2 = keccakPacked("claim_eth_key2",    pseudo1, recipient, amount, nonce, deadline, contractAddress, chainId);
        const challengeK1 = keccakPacked("claim_eth_key1",    pseudo1, recipient, amount, nonce, deadline, contractAddress, chainId);

        const proofP2Raw = sign(keys.pseudo2.K, keys.pseudo2.Px, keys.pseudo2.Py, challengeP2);
        const proofK2Raw = sign(keys.key2.K,    keys.key2.Px,    keys.key2.Py,    challengeK2);
        const proofK1Raw = sign(keys.key1.K,    keys.key1.Px,    keys.key1.Py,    challengeK1);

        console.assert(verifyLocally(keys.pseudo2.commitment, proofP2Raw, challengeP2), "claimETH pseudo2 proof invalid!");
        console.assert(verifyLocally(keys.key2.commitment,    proofK2Raw, challengeK2), "claimETH key2 proof invalid!");
        console.assert(verifyLocally(keys.key1.commitment,    proofK1Raw, challengeK1), "claimETH key1 proof invalid!");

        return {
            proofPseudo2: encodeProof(proofP2Raw),
            proofKey2:    encodeProof(proofK2Raw),
            proofKey1:    encodeProof(proofK1Raw),
        };
    }

    function prepareSendFromEscrowToPseudo1(keys, fromPseudo1, toPseudo1, token, amount, nonce, contractAddress, chainId) {
        const challengeP2 = keccakPacked("escrow_p2", fromPseudo1, toPseudo1, token, amount, nonce, contractAddress, chainId);
        const challengeK2 = keccakPacked("escrow_k2", fromPseudo1, toPseudo1, token, amount, nonce, contractAddress, chainId);
        const challengeK1 = keccakPacked("escrow_k1", fromPseudo1, toPseudo1, token, amount, nonce, contractAddress, chainId);

        const proofP2Raw = sign(keys.pseudo2.K, keys.pseudo2.Px, keys.pseudo2.Py, challengeP2);
        const proofK2Raw = sign(keys.key2.K,    keys.key2.Px,    keys.key2.Py,    challengeK2);
        const proofK1Raw = sign(keys.key1.K,    keys.key1.Px,    keys.key1.Py,    challengeK1);

        console.assert(verifyLocally(keys.pseudo2.commitment, proofP2Raw, challengeP2), "escrow pseudo2 proof invalid!");
        console.assert(verifyLocally(keys.key2.commitment,    proofK2Raw, challengeK2), "escrow key2 proof invalid!");
        console.assert(verifyLocally(keys.key1.commitment,    proofK1Raw, challengeK1), "escrow key1 proof invalid!");

        return {
            proofPseudo2: encodeProof(proofP2Raw),
            proofKey2:    encodeProof(proofK2Raw),
            proofKey1:    encodeProof(proofK1Raw),
        };
    }

    function prepareSendERC20ToExternal(keys, pseudo1, recipient, token, amount, nonce, deadline, contractAddress, chainId) {
        const challengeP2 = keccakPacked("ext_erc20_p2", pseudo1, recipient, token, amount, nonce, deadline, contractAddress, chainId);
        const challengeK2 = keccakPacked("ext_erc20_k2", pseudo1, recipient, token, amount, nonce, deadline, contractAddress, chainId);
        const challengeK1 = keccakPacked("ext_erc20_k1", pseudo1, recipient, token, amount, nonce, deadline, contractAddress, chainId);

        const proofP2Raw = sign(keys.pseudo2.K, keys.pseudo2.Px, keys.pseudo2.Py, challengeP2);
        const proofK2Raw = sign(keys.key2.K,    keys.key2.Px,    keys.key2.Py,    challengeK2);
        const proofK1Raw = sign(keys.key1.K,    keys.key1.Px,    keys.key1.Py,    challengeK1);

        console.assert(verifyLocally(keys.pseudo2.commitment, proofP2Raw, challengeP2), "ext_erc20 pseudo2 proof invalid!");
        console.assert(verifyLocally(keys.key2.commitment,    proofK2Raw, challengeK2), "ext_erc20 key2 proof invalid!");
        console.assert(verifyLocally(keys.key1.commitment,    proofK1Raw, challengeK1), "ext_erc20 key1 proof invalid!");

        return {
            proofPseudo2: encodeProof(proofP2Raw),
            proofKey2:    encodeProof(proofK2Raw),
            proofKey1:    encodeProof(proofK1Raw),
        };
    }

    /**
     * Prévente GHOST — aligné sur GhostPresale.buyTokensGhost (challenges buy_presale_p2 / buy_presale_k1).
     * Les commits keys.pseudo2.commitment, keys.key1.commitment, keys.key2.commitment doivent être passés
     * en calldata avant les tuples de preuve (V2 déployé : pas de lecture on-chain des commits individuels).
     * @param keys      Objet _keys de prepareCreateAccount (pseudo2, key1, key2)
     * @param pseudo1   Pseudo public Ghost
     * @param recipient Adresse de réception des GHOST (checksum 0x…)
     * @param ethAmountWei  msg.value en wei (bigint)
     * @param nonce         ghostPresaleNonceByPseudoHash (bigint)
     * @param deadline      timestamp Unix (bigint)
     * @param presaleAddress contrat GhostPresale
     * @param chainId       bigint
     */
    function prepareBuyPresaleGhost(
        keys,
        pseudo1,
        recipient,
        ethAmountWei,
        nonce,
        deadline,
        presaleAddress,
        chainId
    ) {
        const rcpt = ethers.getAddress(recipient);
        const challengeP2 = keccakPacked(
            "buy_presale_p2",
            pseudo1,
            rcpt,
            ethAmountWei,
            nonce,
            deadline,
            presaleAddress,
            chainId
        );
        const challengeK1 = keccakPacked(
            "buy_presale_k1",
            pseudo1,
            rcpt,
            ethAmountWei,
            nonce,
            deadline,
            presaleAddress,
            chainId
        );

        const proofP2Raw = sign(keys.pseudo2.K, keys.pseudo2.Px, keys.pseudo2.Py, challengeP2);
        const proofK1Raw = sign(keys.key1.K, keys.key1.Px, keys.key1.Py, challengeK1);

        console.assert(verifyLocally(keys.pseudo2.commitment, proofP2Raw, challengeP2), "buy presale pseudo2 invalid!");
        console.assert(verifyLocally(keys.key1.commitment, proofK1Raw, challengeK1), "buy presale key1 invalid!");

        return {
            proofPseudo2: encodeProof(proofP2Raw),
            proofKey1: encodeProof(proofK1Raw),
            challengeP2,
            challengeK1,
        };
    }

    /**
     * Prévente GHOST — aligné sur GhostPresale.claimGhost (challenges claim_presale_p2 / claim_presale_k1).
     * Mêmes trois commits qu’à l’achat : les passer en calldata avant les preuves.
     * @param keys      Objet _keys de prepareCreateAccount (pseudo2, key1, key2)
     * @param pseudo1   Pseudo public Ghost
     * @param recipient Adresse dont l'allocation a été créditée à l'achat Ghost (checksum 0x…)
     * @param payout    Adresse qui recevra les GHOST (checksum 0x…)
     * @param nonce     ghostClaimNonceByPseudoHash (bigint)
     * @param deadline  timestamp Unix (bigint)
     * @param presaleAddress contrat GhostPresale
     * @param chainId   bigint
     */
    function prepareClaimPresaleGhost(
        keys,
        pseudo1,
        recipient,
        payout,
        nonce,
        deadline,
        presaleAddress,
        chainId
    ) {
        const rcpt = ethers.getAddress(recipient);
        const pay = ethers.getAddress(payout);
        const challengeP2 = keccakPacked(
            "claim_presale_p2",
            pseudo1,
            rcpt,
            pay,
            nonce,
            deadline,
            presaleAddress,
            chainId
        );
        const challengeK1 = keccakPacked(
            "claim_presale_k1",
            pseudo1,
            rcpt,
            pay,
            nonce,
            deadline,
            presaleAddress,
            chainId
        );

        const proofP2Raw = sign(keys.pseudo2.K, keys.pseudo2.Px, keys.pseudo2.Py, challengeP2);
        const proofK1Raw = sign(keys.key1.K, keys.key1.Px, keys.key1.Py, challengeK1);

        console.assert(verifyLocally(keys.pseudo2.commitment, proofP2Raw, challengeP2), "claim presale pseudo2 invalid!");
        console.assert(verifyLocally(keys.key1.commitment, proofK1Raw, challengeK1), "claim presale key1 invalid!");

        return {
            proofPseudo2: encodeProof(proofP2Raw),
            proofKey1: encodeProof(proofK1Raw),
            challengeP2,
            challengeK1,
        };
    }

    function prepareDeactivateAccount(keys, pseudo1, nonce, contractAddress, chainId) {
        const challengeP2 = keccakPacked("deactivate",      pseudo1, nonce, contractAddress, chainId);
        const challengeK1 = keccakPacked("deactivate_key1", pseudo1, nonce, contractAddress, chainId);

        const proofP2Raw = sign(keys.pseudo2.K, keys.pseudo2.Px, keys.pseudo2.Py, challengeP2);
        const proofK1Raw = sign(keys.key1.K,    keys.key1.Px,    keys.key1.Py,    challengeK1);

        console.assert(verifyLocally(keys.pseudo2.commitment, proofP2Raw, challengeP2), "deactivate pseudo2 proof invalid!");
        console.assert(verifyLocally(keys.key1.commitment,    proofK1Raw, challengeK1), "deactivate key1 proof invalid!");

        return {
            proofPseudo2: encodeProof(proofP2Raw),
            proofKey1:    encodeProof(proofK1Raw),
        };
    }

    return {

        derivePrivateKey,
        derivePublicKey,
        deriveCommitment,
        deriveAll,

        sign,
        verifyLocally,
        encodeProof,

        prepareCreateAccount,
        prepareApproveReceive,
        prepareRejectReceive,
        prepareSendFromHash1Stealth,
        prepareSendFromEscrowToPseudo1,
        prepareSendERC20ToExternal,
        prepareClaimETH,
        prepareGetBalance,
        prepareGetPendingTransfers,
        prepareDeactivateAccount,
        prepareBuyPresaleGhost,
        prepareClaimPresaleGhost,

        generateStealthAddress,
        scanStealthAddress,

        toBytes32,
        fromBytes32,

        /** @public Pour GhostSDK / ghost-sdk-unified.js — même packing que les challenges protocole */
        keccakPacked,

        BN256,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GhostSchnorr;
}

