// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

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

    function _ecMul(uint256 x, uint256 y, uint256 scalar) internal view returns (uint256 rx, uint256 ry) {
        scalar = scalar % BN256_ORDER;
        if (scalar == 0) return (0, 0);
        uint256[3] memory input = [x, y, scalar];
        uint256[2] memory result;
        bool ok;
        assembly {
            ok := staticcall(gas(), 0x07, input, 0x60, result, 0x40)
        }
        require(ok, "GhostVerifier: ecMul failed");
        return (result[0], result[1]);
    }

    function _ecAdd(
        uint256 x1,
        uint256 y1,
        uint256 x2,
        uint256 y2
    ) internal view returns (uint256 rx, uint256 ry) {
        uint256[4] memory input = [x1, y1, x2, y2];
        uint256[2] memory result;
        bool ok;
        assembly {
            ok := staticcall(gas(), 0x06, input, 0x80, result, 0x40)
        }
        require(ok, "GhostVerifier: ecAdd failed");
        return (result[0], result[1]);
    }
}
