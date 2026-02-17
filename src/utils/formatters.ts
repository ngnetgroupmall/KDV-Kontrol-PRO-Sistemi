/**
 * Centralized formatter utilities.
 * All formatting helpers live here to avoid duplication across components.
 */

/** Format a number as Turkish Lira currency string */
export const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
};

/** Format a date as dd.MM.yyyy Turkish locale string */
export const formatDate = (value: Date | null | undefined): string => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('tr-TR');
};

/** Format a number with tr-TR locale, no currency symbol */
export const formatAmount = (value: number): string => {
    return new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
};

/** Format a forex number (2-4 decimal places) */
export const formatFxNumber = (value: number | undefined): string => {
    if (typeof value !== 'number') return '';
    return new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
    }).format(value);
};
