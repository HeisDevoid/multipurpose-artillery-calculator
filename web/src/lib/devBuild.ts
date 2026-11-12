/**
 * The development build: `npm run dev` or `npm run build:dev`. Only it shows
 * the experimental features (input by grid coordinates, markers from the game
 * screen). The normal build (the site, the Windows app) does not have them.
 */
export const DEV_BUILD: boolean = import.meta.env.DEV || import.meta.env.MODE === 'devbuild'
