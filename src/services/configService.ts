import { SCRIPT_URL as FALLBACK_URL } from '../config';

const SCRIPT_URL_KEY = 'google_script_url';

/**
 * Haalt de actieve SCRIPT_URL op. Geeft prioriteit aan de URL die door de
 * gebruiker is opgeslagen in localStorage. Als die niet bestaat, wordt de
 * fallback-URL uit config.ts gebruikt.
 * @returns De te gebruiken SCRIPT_URL.
 */
export const getScriptUrl = (): string => {
    const storedUrl = localStorage.getItem(SCRIPT_URL_KEY);
    // Controleer of de opgeslagen URL een geldige-lijkt te zijn (eindigt op /exec)
    if (storedUrl && storedUrl.trim().endsWith('/exec')) {
        return storedUrl.trim();
    }
    return FALLBACK_URL;
};

/**
 * Slaat de door de gebruiker opgegeven SCRIPT_URL op in localStorage.
 * @param url De te opslaan URL.
 */
export const saveScriptUrl = (url: string): void => {
    localStorage.setItem(SCRIPT_URL_KEY, url.trim());
};

/**
 * Verwijdert de opgeslagen SCRIPT_URL uit localStorage, waardoor de app
 * terugvalt op de waarde in config.ts.
 */
export const clearScriptUrl = (): void => {
    localStorage.removeItem(SCRIPT_URL_KEY);
};
