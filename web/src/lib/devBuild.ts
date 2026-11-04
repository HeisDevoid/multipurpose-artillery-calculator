/**
 * Сборка для разработки: `npm run dev` или `npm run build:dev`. Только в ней
 * видны экспериментальные функции (ввод по координатам сетки, метки с экрана
 * игры). В обычной сборке (сайт, программа для ПК) их нет.
 */
export const DEV_BUILD: boolean = import.meta.env.DEV || import.meta.env.MODE === 'devbuild'
