export type ForexOverrideMap = Record<string, boolean>;

export interface ForexDetectionResult {
    inferredIsForex: boolean;
    inferredCurrency?: string;
    reason: string;
}

export interface ResolvedForexAccountType extends ForexDetectionResult {
    isForex: boolean;
    source: 'INFERRED' | 'MANUAL';
}

const normalizeAccountName = (name: string): string => {
    return String(name || '')
        .toLocaleUpperCase('tr-TR')
        .replace(/\s+/g, ' ');
};

export const detectForexFromAccountName = (accountName: string): ForexDetectionResult => {
    const normalized = normalizeAccountName(accountName);
    const hasUsdToken = normalized.includes(' USD ');
    const hasEuroToken = normalized.includes(' EURO ');

    if (hasUsdToken && hasEuroToken) {
        return {
            inferredIsForex: true,
            inferredCurrency: 'USD/EURO',
            reason: 'Hesap adinda " USD " ve " EURO " kaliplari bulundu.',
        };
    }

    if (hasUsdToken) {
        return {
            inferredIsForex: true,
            inferredCurrency: 'USD',
            reason: 'Hesap adinda " USD " kalibi bulundu.',
        };
    }

    if (hasEuroToken) {
        return {
            inferredIsForex: true,
            inferredCurrency: 'EURO',
            reason: 'Hesap adinda " EURO " kalibi bulundu.',
        };
    }

    return {
        inferredIsForex: false,
        reason: 'Hesap adinda " USD " veya " EURO " kalibi bulunmadi.',
    };
};

export const resolveForexAccountType = (
    accountCode: string,
    accountName: string,
    overrides?: ForexOverrideMap
): ResolvedForexAccountType => {
    const detection = detectForexFromAccountName(accountName);
    const hasManualOverride = !!overrides && Object.prototype.hasOwnProperty.call(overrides, accountCode);
    const manualValue = hasManualOverride ? !!overrides?.[accountCode] : undefined;

    return {
        ...detection,
        isForex: hasManualOverride ? !!manualValue : detection.inferredIsForex,
        source: hasManualOverride ? 'MANUAL' : 'INFERRED',
    };
};
