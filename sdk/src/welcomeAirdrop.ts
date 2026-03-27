import {
    ONE_HUNDRED_GHOST_WEI,
    WEI_PER_GHOST,
    WELCOME_CAMPAIGN_MAX_BUDGET_WEI,
} from "./constants";

export type WelcomeCampaignParams = {
    airdropWalletBalanceWei: bigint;
    reservePercentBps: number;
    amountPerUserWei: bigint;
};

export type WelcomeCampaignPlan = {
    reservePercentBps: number;
    budgetWei: bigint;
    amountPerUserWei: bigint;
    maxFullPayouts: bigint;
    remainderWei: bigint;
};

export function budgetFromWalletPercent(balanceWei: bigint, reservePercentBps: number): bigint {
    if (reservePercentBps < 0 || reservePercentBps > 10_000) {
        throw new Error("reservePercentBps doit être entre 0 et 10_000");
    }
    return (balanceWei * BigInt(reservePercentBps)) / 10_000n;
}

export function fivePercentOfAirdropAllocationWei(): bigint {
    return WELCOME_CAMPAIGN_MAX_BUDGET_WEI;
}

export function planWelcomeCampaign(params: WelcomeCampaignParams): WelcomeCampaignPlan {
    const { airdropWalletBalanceWei, reservePercentBps, amountPerUserWei } = params;
    if (amountPerUserWei <= 0n) {
        throw new Error("amountPerUserWei doit être > 0");
    }
    const budgetWei = budgetFromWalletPercent(airdropWalletBalanceWei, reservePercentBps);
    const maxFullPayouts = budgetWei / amountPerUserWei;
    const remainderWei = budgetWei - maxFullPayouts * amountPerUserWei;
    return {
        reservePercentBps,
        budgetWei,
        amountPerUserWei,
        maxFullPayouts,
        remainderWei,
    };
}

export function defaultWelcomeCampaignPlan(airdropWalletBalanceWei: bigint): WelcomeCampaignPlan {
    return planWelcomeCampaign({
        airdropWalletBalanceWei,
        reservePercentBps: 500,
        amountPerUserWei: ONE_HUNDRED_GHOST_WEI,
    });
}

export function ghostToWei(wholeGhost: bigint): bigint {
    return wholeGhost * WEI_PER_GHOST;
}
