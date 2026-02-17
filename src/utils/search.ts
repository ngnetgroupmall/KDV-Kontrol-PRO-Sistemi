const normalizeSearchValue = (value: string | number | null | undefined): string => {
    return String(value ?? '').toLocaleLowerCase('tr-TR').trim();
};

const escapeRegExp = (value: string): string => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const matchesToken = (field: string, token: string): boolean => {
    if (!token) return true;
    if (!field) return false;

    if (!token.includes('*')) {
        return field.includes(token);
    }

    const pattern = token
        .split('*')
        .map((part) => escapeRegExp(part))
        .join('.*');
    const regex = new RegExp(`^${pattern}$`, 'i');
    return regex.test(field);
};

export const matchesSearchAcrossFields = (
    query: string,
    fields: Array<string | number | null | undefined>
): boolean => {
    const tokens = normalizeSearchValue(query).split(/\s+/).filter(Boolean);
    if (!tokens.length) return true;

    const normalizedFields = fields.map((value) => normalizeSearchValue(value));
    return tokens.every((token) => normalizedFields.some((field) => matchesToken(field, token)));
};

