export function genConversion(gen: string | number) {
    const gens = {
        'SV': 9,
        'SS': 8,
        'SM': 7,
        'XY': 6,
        'BW': 5,
        'DP': 4,
        'RS': 3,
        'GS': 2,
        'RB': 1,
    };

    for (const [k, v] of Object.entries(gens)) {
        if (gen === k) {
            return v.toString();
        }
        else if (gen === v) {
            return k;
        }
    }
    return '';
}