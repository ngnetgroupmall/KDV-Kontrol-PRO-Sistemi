import { ACCOUNT_CHARACTER_BY_MAIN_CODE } from './accountCharacterMap';

export type ExpectedBalanceSide = 'BORC' | 'ALACAK' | 'FARK_ETMEZ';
export type BalanceSection = 'AKTIF' | 'PASIF' | 'GELIR' | 'GIDER' | 'NAZIM' | 'DIGER';

export interface AccountBalanceRule {
    expectedBalance: ExpectedBalanceSide;
    section: BalanceSection;
    label: string;
}

const CLASS_RULES: Record<string, AccountBalanceRule> = {
    '1': { expectedBalance: 'BORC', section: 'AKTIF', label: 'Donen Varliklar' },
    '2': { expectedBalance: 'BORC', section: 'AKTIF', label: 'Duran Varliklar' },
    '3': { expectedBalance: 'ALACAK', section: 'PASIF', label: 'Kisa Vadeli Yabanci Kaynaklar' },
    '4': { expectedBalance: 'ALACAK', section: 'PASIF', label: 'Uzun Vadeli Yabanci Kaynaklar' },
    '5': { expectedBalance: 'ALACAK', section: 'PASIF', label: 'Oz Kaynaklar' },
    '6': { expectedBalance: 'ALACAK', section: 'GELIR', label: 'Gelir Hesaplari' },
    '7': { expectedBalance: 'BORC', section: 'GIDER', label: 'Maliyet ve Gider Hesaplari' },
    '8': { expectedBalance: 'FARK_ETMEZ', section: 'DIGER', label: 'Serbest Hesaplar' },
    '9': { expectedBalance: 'FARK_ETMEZ', section: 'NAZIM', label: 'Nazim Hesaplar' },
};

const MAIN_CODE_OVERRIDES: Record<string, AccountBalanceRule> = {
    '690': { expectedBalance: 'FARK_ETMEZ', section: 'GELIR', label: 'Donem Kari veya Zarari' },
};

export const getMainAccountCode = (accountCode: string): string => {
    const digitsOnly = accountCode.replace(/\D/g, '');
    if (!digitsOnly) return '';
    return digitsOnly.slice(0, 3);
};

export const resolveAccountBalanceRule = (accountCode: string): AccountBalanceRule | null => {
    const mainCode = getMainAccountCode(accountCode);
    if (!mainCode) return null;

    const overrideRule = MAIN_CODE_OVERRIDES[mainCode];
    if (overrideRule) return overrideRule;

    const classCode = mainCode.slice(0, 1);
    const classRule = CLASS_RULES[classCode];
    if (!classRule) return null;

    const characterFromSheet = ACCOUNT_CHARACTER_BY_MAIN_CODE[mainCode];
    if (!characterFromSheet) return classRule;

    return {
        ...classRule,
        expectedBalance: characterFromSheet,
    };
};
