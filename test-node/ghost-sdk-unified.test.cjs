/**
 * Tests ghost-sdk-unified.js — sync UX (ghost-schnorr-libz.js) + sécurité GhostSDK
 *
 * Lancer : npm run test:sdk-unified
 *          node --test test-node/ghost-sdk-unified.test.cjs
 *
 * (Hors `tests/` : évite que Hardhat traite ce fichier comme un test Mocha.)
 */
'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');
const { ethers } = require('ethers');

/** ghost-schnorr-libz.js attend `ethers` en global (comme le renderer Electron) */
globalThis.ethers = ethers;

const GhostSchnorr = require('../ghost-schnorr-libz.js');
const U = require('../ghost-sdk-unified.js');

/** Provider minimal — pas de RPC externe (CI / offline) */
function makeMockProvider(chainId = 8453n) {
    return {
        async getNetwork() {
            return { chainId, name: 'mock' };
        },
    };
}

// ---------------------------------------------------------------------------
// Sync : même domaine bonus que le SDK TypeScript (formule identique)
// ---------------------------------------------------------------------------
describe('Bonus prévente — alignement formule / domaine', () => {
    test('DEFAULT_BONUS_CREDENTIAL_DOMAIN = keccak256("GhostPresaleBonusRegistry.v1")', () => {
        const expected = ethers.keccak256(ethers.toUtf8Bytes('GhostPresaleBonusRegistry.v1'));
        assert.strictEqual(U.DEFAULT_BONUS_CREDENTIAL_DOMAIN.toLowerCase(), expected.toLowerCase());
    });

    test('computePresaleBonusCredentialId identique à un encodage manuel solidityPacked', () => {
        const buyer = '0x1111111111111111111111111111111111111111';
        const presale = '0x2222222222222222222222222222222222222222';
        const ghostWei = 1234567890123456789012n;
        const chainId = 8453n;
        const domain = U.DEFAULT_BONUS_CREDENTIAL_DOMAIN;

        const packed = ethers.solidityPacked(
            ['address', 'uint256', 'address', 'uint256', 'bytes32'],
            [buyer, ghostWei, presale, chainId, domain]
        );
        const manual = ethers.keccak256(packed);

        const fromSdk = U.computePresaleBonusCredentialId({
            buyer,
            ghostPurchasedWei: ghostWei,
            presaleAddress: presale,
            chainId,
            credentialDomainSeparator: domain,
        });

        assert.strictEqual(fromSdk.toLowerCase(), manual.toLowerCase());
    });

    test('credentialId change si buyer ou montant diffère', () => {
        const base = {
            buyer: '0x3333333333333333333333333333333333333333',
            ghostPurchasedWei: 10n ** 18n,
            presaleAddress: '0x4444444444444444444444444444444444444444',
            chainId: 8453n,
            credentialDomainSeparator: U.DEFAULT_BONUS_CREDENTIAL_DOMAIN,
        };
        const a = U.computePresaleBonusCredentialId(base);
        const b = U.computePresaleBonusCredentialId({
            ...base,
            ghostPurchasedWei: base.ghostPurchasedWei + 1n,
        });
        assert.notStrictEqual(a, b);
    });
});

// ---------------------------------------------------------------------------
// Sync UX : GhostSchnorr.prepareCreateAccount ↔ GhostProtocolV2Client encode/decode
// ---------------------------------------------------------------------------
describe('Sync UX — création de compte (même lib que index.html)', () => {
    test('encodeCreateAccount + decodeCreateAccountCalldata roundtrip', () => {
        const client = new U.GhostProtocolV2Client(ethers.ZeroAddress, makeMockProvider());

        const p2 = GhostSchnorr.deriveAll('secret_pseudo2_ux');
        const k1 = GhostSchnorr.deriveAll('0x' + '11'.repeat(20));
        const k2 = GhostSchnorr.deriveAll('key2_pass_test');

        const params = {
            pseudo1: 'testuser_sync',
            pseudo2Commit: p2.commitment,
            key1Commit: k1.commitment,
            key2Commit: k2.commitment,
        };

        const data = client.encodeCreateAccount(params);
        const decoded = U.GhostProtocolV2Client.decodeCreateAccountCalldata(data);

        assert.ok(decoded);
        assert.strictEqual(decoded.pseudo1, params.pseudo1);
        assert.strictEqual(decoded.pseudo2Commit.toLowerCase(), params.pseudo2Commit.toLowerCase());
        assert.strictEqual(decoded.key1Commit.toLowerCase(), params.key1Commit.toLowerCase());
        assert.strictEqual(decoded.key2Commit.toLowerCase(), params.key2Commit.toLowerCase());
    });

    test('prepareCreateAccount (GhostSchnorr) produit les mêmes commits que deriveAll séparés', () => {
        const prep = GhostSchnorr.prepareCreateAccount('alice', 'p2', 'k1', 'k2');
        const p2 = GhostSchnorr.deriveAll('p2');
        const k1 = GhostSchnorr.deriveAll('k1');
        const k2 = GhostSchnorr.deriveAll('k2');
        assert.strictEqual(prep.pseudo2Commit, p2.commitment);
        assert.strictEqual(prep.key1Commit, k1.commitment);
        assert.strictEqual(prep.key2Commit, k2.commitment);
    });

    test('keccakPacked exporté — même résultat que challenge interne approve', () => {
        const pseudo1 = 'bob';
        const transferIndex = 0n;
        const nonce = 5n;
        const contractAddress = '0x4ae6Aa27aB7c822970D2cb7575bF8e6F5cea00aB';
        const chainId = 8453n;

        const c1 = GhostSchnorr.keccakPacked(
            'approve',
            pseudo1,
            transferIndex,
            nonce,
            contractAddress,
            chainId
        );

        const c2 = ethers.keccak256(
            ethers.solidityPacked(
                ['string', 'string', 'uint256', 'uint256', 'address', 'uint256'],
                ['approve', pseudo1, transferIndex, nonce, contractAddress, chainId]
            )
        );

        assert.strictEqual(c1.toLowerCase(), c2.toLowerCase());
    });
});

// ---------------------------------------------------------------------------
// Sécurité — GhostSDK
// ---------------------------------------------------------------------------
describe('Sécurité — GhostSDK challenges & preuves', () => {
    test('buildExternalChallenge lie le contrat (deux adresses → challenges différents)', async () => {
        const sdk = new U.GhostSDK(GhostSchnorr, makeMockProvider(8453n));
        await new Promise((r) => setTimeout(r, 50));
        sdk.chainId = 8453;

        const c1 = sdk.buildExternalChallenge(
            'claim_bonus',
            'pseudo_test',
            '0x1111111111111111111111111111111111111111',
            3n,
            {}
        );
        const c2 = sdk.buildExternalChallenge(
            'claim_bonus',
            'pseudo_test',
            '0x2222222222222222222222222222222222222222',
            3n,
            {}
        );
        assert.notStrictEqual(c1.toLowerCase(), c2.toLowerCase());
    });

    test('buildExternalChallenge : nonce différent → challenge différent', async () => {
        const sdk = new U.GhostSDK(GhostSchnorr, makeMockProvider(8453n));
        await new Promise((r) => setTimeout(r, 50));
        sdk.chainId = 8453;

        const addr = '0x3333333333333333333333333333333333333333';
        const a = sdk.buildExternalChallenge('x', 'p', addr, 1n, {});
        const b = sdk.buildExternalChallenge('x', 'p', addr, 2n, {});
        assert.notStrictEqual(a.toLowerCase(), b.toLowerCase());
    });

    test('prepareExternalAction échoue si clé requise absente', async () => {
        const sdk = new U.GhostSDK(GhostSchnorr, makeMockProvider(1n));
        await new Promise((r) => setTimeout(r, 50));
        sdk.chainId = 1;

        const prep = GhostSchnorr.prepareCreateAccount('u', 'a', 'b', 'c');
        const keys = prep._keys;

        assert.throws(
            () =>
                sdk.prepareExternalAction(
                    'test',
                    'u',
                    '0x4444444444444444444444444444444444444444',
                    0n,
                    { pseudo2: keys.pseudo2 },
                    {},
                    ['pseudo2', 'key1']
                ),
            /cle manquante/
        );
    });

    test('prepareExternalAction rejette K incohérent avec Px/Py (preuve locale invalide)', async () => {
        const sdk = new U.GhostSDK(GhostSchnorr, makeMockProvider(1n));
        await new Promise((r) => setTimeout(r, 50));
        sdk.chainId = 1;

        const prep = GhostSchnorr.prepareCreateAccount('u', 'a', 'b', 'c');
        const keys = prep._keys;
        const badKey1 = {
            K: keys.key1.K + 1n,
            Px: keys.key1.Px,
            Py: keys.key1.Py,
        };

        assert.throws(
            () =>
                sdk.prepareExternalAction(
                    'test',
                    'u',
                    '0x5555555555555555555555555555555555555555',
                    0n,
                    { pseudo2: keys.pseudo2, key1: badKey1 },
                    {},
                    ['pseudo2', 'key1']
                ),
            /preuve locale invalide/
        );
    });

    test('connect() rejette une adresse invalide', async () => {
        const sdk = new U.GhostSDK(GhostSchnorr, makeMockProvider());
        await assert.rejects(
            () => sdk.connect('not_an_address', ['function foo() view returns (uint256)']),
            /adresse de contrat invalide/
        );
    });

    test('executeExternal sans connect() préalable → erreur', async () => {
        const sdk = new U.GhostSDK(GhostSchnorr, makeMockProvider());
        const w = ethers.Wallet.createRandom();
        await assert.rejects(
            () =>
                sdk.executeExternal(
                    '0x6666666666666666666666666666666666666666',
                    'foo',
                    [],
                    w
                ),
            /non connecte/
        );
    });
});

// ---------------------------------------------------------------------------
// API dépréciée / registre bonus (comportement sûr)
// ---------------------------------------------------------------------------
describe('Registre bonus — API obsolète', () => {
    test('checkPresaleBonus(bytes32) ne prétend pas réussir — false + pas de throw', async () => {
        const provider = makeMockProvider();
        const fakeRegistry = '0x0000000000000000000000000000000000000001';
        const credential = ethers.hexlify(ethers.randomBytes(32));
        assert.strictEqual(credential.length, 66);

        const result = await U.checkPresaleBonus(fakeRegistry, credential, provider);
        assert.strictEqual(result, false);
    });
});

// ---------------------------------------------------------------------------
// Exports minimaux (pas de fuite de secrets dans le module)
// ---------------------------------------------------------------------------
describe('Surface du module', () => {
    test('exports attendus présents', () => {
        assert.ok(U.GhostProtocolV2Client);
        assert.ok(U.GhostSDK);
        assert.ok(typeof U.computePresaleBonusCredentialId === 'function');
        assert.ok(typeof U.checkPresaleBonusRegistered === 'function');
        assert.strictEqual(typeof U.GHOST_SDK_VERSION, 'string');
    });
});

// ---------------------------------------------------------------------------
// Audit sécurité — GhostSDK (surface, liaison, détection contrat)
// ---------------------------------------------------------------------------
describe('Audit sécurité — GhostSDK', () => {
    test('buildExternalChallenge : action différente → hash différent', async () => {
        const sdk = new U.GhostSDK(GhostSchnorr, makeMockProvider(8453n));
        await new Promise((r) => setTimeout(r, 20));
        sdk.chainId = 8453;
        const addr = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
        const a = sdk.buildExternalChallenge('action_a', 'p', addr, 0n, {});
        const b = sdk.buildExternalChallenge('action_b', 'p', addr, 0n, {});
        assert.notStrictEqual(a.toLowerCase(), b.toLowerCase());
    });

    test('buildExternalChallenge : pseudo1 différent → hash différent', async () => {
        const sdk = new U.GhostSDK(GhostSchnorr, makeMockProvider(1n));
        await new Promise((r) => setTimeout(r, 20));
        sdk.chainId = 1;
        const addr = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
        const a = sdk.buildExternalChallenge('x', 'alice', addr, 0n, {});
        const b = sdk.buildExternalChallenge('x', 'bob', addr, 0n, {});
        assert.notStrictEqual(a.toLowerCase(), b.toLowerCase());
    });

    test('addVerifiedContract (session) permet de marquer un contrat comme connu', async () => {
        const sdk = new U.GhostSDK(GhostSchnorr, makeMockProvider(8453n));
        await new Promise((r) => setTimeout(r, 20));
        sdk.chainId = 8453;
        const custom = '0xcccccccccccccccccccccccccccccccccccccccc';
        sdk.addVerifiedContract('MonPresaleTest', custom, 'test audit');
        const v = sdk.isVerified(custom);
        assert.strictEqual(v.verified, true);
        assert.strictEqual(v.name, 'MonPresaleTest');
    });

    test('GHOST_VERIFIER_SOLIDITY contient verifyGhostProof (snippet auditable)', () => {
        assert.match(U.GHOST_VERIFIER_SOLIDITY, /verifyGhostProof/);
        assert.match(U.GHOST_VERIFIER_SOLIDITY, /BN256_ORDER/);
    });

    test('adresses registre Base (8453) sont des addresses EVM valides (pas des secrets)', () => {
        const base = U.GHOST_PROTOCOL_ADDRESSES[8453];
        assert.ok(base);
        assert.ok(ethers.isAddress(base.v2));
        assert.ok(ethers.isAddress(base.v1));
    });
});
