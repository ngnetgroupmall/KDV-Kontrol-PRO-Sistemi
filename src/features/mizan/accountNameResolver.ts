import { getMainAccountCode } from './accountingRules';
import { STANDARD_ACCOUNT_NAMES } from './accountNames';

const MOJIBAKE_REPLACEMENTS: Array<[RegExp, string]> = [
    [/Ã‡/g, 'C'],
    [/Ã§/g, 'c'],
    [/Äž/g, 'G'],
    [/ÄŸ/g, 'g'],
    [/Ä°/g, 'I'],
    [/Ä±/g, 'i'],
    [/Ã–/g, 'O'],
    [/Ã¶/g, 'o'],
    [/Åž/g, 'S'],
    [/ÅŸ/g, 's'],
    [/Ãœ/g, 'U'],
    [/Ã¼/g, 'u'],
    [/Â/g, ''],
    [/â€“/g, '-'],
    [/â€”/g, '-'],
    [/â€˜/g, "'"],
    [/â€™/g, "'"],
    [/â€œ/g, '"'],
    [/â€/g, '"'],
];

const normalizeWhitespace = (value: string): string => {
    return value.replace(/\s+/g, ' ').trim();
};

export const normalizeAccountDisplayName = (value: string | undefined): string => {
    let normalized = String(value || '').trim();
    if (!normalized) return '';

    MOJIBAKE_REPLACEMENTS.forEach(([pattern, replacement]) => {
        normalized = normalized.replace(pattern, replacement);
    });

    return normalizeWhitespace(normalized);
};

const NORMALIZED_STANDARD_ACCOUNT_NAMES: Record<string, string> = Object.fromEntries(
    Object.entries(STANDARD_ACCOUNT_NAMES).map(([code, name]) => [code, normalizeAccountDisplayName(name)])
);

export const resolveMainAccountStandardName = (accountCode: string, fallbackName = ''): string => {
    const mainCode = getMainAccountCode(accountCode);
    const standardName = NORMALIZED_STANDARD_ACCOUNT_NAMES[mainCode];
    if (standardName) return standardName;
    return normalizeAccountDisplayName(fallbackName);
};

const getCodeDepth = (accountCode: string): number => {
    const code = String(accountCode || '').trim();
    if (!code) return 0;

    if (code.includes('.')) {
        return code
            .split('.')
            .map((part) => part.trim())
            .filter(Boolean).length;
    }

    const digits = code.replace(/\D/g, '');
    if (!digits) return 1;
    if (digits.length <= 3) return 1;
    return 2;
};

export const resolveMainOrIntermediateAccountName = (accountCode: string, fallbackName = ''): string => {
    const depth = getCodeDepth(accountCode);
    const mainName = resolveMainAccountStandardName(accountCode, fallbackName);

    if (depth <= 1) {
        return mainName || 'Tanimsiz Ana Hesap';
    }

    if (depth === 2) {
        if (mainName) return `${mainName} Ara Hesap`;
        return normalizeAccountDisplayName(fallbackName) || 'Tanimsiz Ara Hesap';
    }

    const normalizedFallback = normalizeAccountDisplayName(fallbackName);
    if (normalizedFallback) return normalizedFallback;
    if (mainName) return `${mainName} Alt Hesap`;
    return 'Tanimsiz Alt Hesap';
};

