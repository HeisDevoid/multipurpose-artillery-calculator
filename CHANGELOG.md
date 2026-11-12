# Changelog

All notable changes. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [SemVer](https://semver.org/).

## [0.19.0] - 2026-11-12

### Map
- Pinch to zoom: on a phone or tablet two fingers zoom and drag the map. The + and − buttons are for the mouse and are hidden on touch screens.

### Maps
- 62 new maps in "Mods and DLC": Takistan, Zargabad, Sahrani, Utes, Everon, Kolgujev, Nogova, Lingor, Panthera, Napf, Kunduz, Fallujah, Chernarus 2035, Chernarus Redux, Kujari, Ruha, Anizay, Green Sea and more.
- Cam Lao Nam is no longer in the list.

### Statistics
- Anonymous usage counter: once a day the site and the Windows app download a small file from a GitHub release, and the download counts become the "Daily use" chart in the README. Nothing about the user or the device is sent. The setting "Anonymous statistics" turns it off.
- The stats picture in the README shows installer downloads by version and daily use of the site and the app as lines.

### Repository
- The changelog, issue forms, comments and test names are in English.

## [0.18.2] - 2026-11-04

### Fixed
- Dropdown lists no longer run off the screen: on a phone the Tutorial menu opened beyond the left edge. Any list now shifts itself to fit on the screen.

### Site
- The site is registered in Google Search Console (the verification file is in the site root).

## [0.18.1] - 2026-11-04

### Tables
- Seara and KamAZ MRL are back in the weapon list. The set without air resistance held old high-trajectory tables for charges 13 to 15 that had been taken with air resistance on. Without air resistance ACE calculates tables only up to 29,900 m, and the high trajectory of these charges lies entirely beyond that, so the game has no such tables. The other tables of both weapons were checked line by line against a new export from the game.
- The table export from the game (tables:game) removes such leftovers by itself.

## [0.18.0] - 2026-11-04

### Interface
- A favourite star right on the selected weapon and the selected map: it shows whether the item is a favourite and adds or removes it without opening the list.
- The weapon button shows the name without the calibre; the calibre is in the open list.
- A weapon with a single shell shows a dimmed field instead of a list (like the gun height under the lock).
- Shorter, clearer texts in the settings, Link and the tutorial in all languages. The section "Air resistance in the game" has the switch "Asterisk * in the ACE menu" and the link "Where to find it".
- About: the author's name leads to the Steam profile, and there is a "Support on Donatello" item.
- Grid coordinate input and markers from the game screen are experimental and now exist only in the development build.

### Maps
- The author of the Chernarus maps (autumn, summer, winter) is CUP, the mod they were ported to.

## [0.17.0] - 2026-11-04

### Headline: air resistance in the game
- On the first start (before the tutorial) the calculator asks whether the game has air resistance. Two animations side by side show the ACE menu (Ctrl+Win): the item with the weapon name without an asterisk and with an asterisk *, and what the range table looks like in each case. The answer turns "Air resistance and weather" on or off; it can be changed in the settings, section "Air resistance in the game". The same is the first question in the help.

### Site address
- The GitHub account was renamed to HeisDevoid, so the site is now at heisdevoid.github.io/multipurpose-artillery-calculator. The Windows app takes maps and invitation links from the new address.

### Tables
- Tables are exported straight from the game, without screenshots: a script for the debug console (web/tools/arma/export_tables.sqf) uses the same ACE calculation as the range table window, for all charges and both trajectories at once, without air resistance and with it.
- Mk6, Sholef, Seara, 2S9 Sochor, KamAZ MRL, M109A6, M119A2, M252 and M777 were rewritten from the game export: each now has tables both without air resistance and with it. The tables with air resistance matched the ones taken from screenshots earlier line by line; the missing low-trajectory ranges of Sochor charge 2 are filled in.
- Mk6 is calculated without air resistance by default (as in ACE without advanced ballistics); with it the difference is about 100 mils at 2 km.

### Weapons
- New RHS weapons from the game export: 2A18M D-30A (122 mm; the D30J from RHSSAF has the same tables), 2S1 Gvozdika (122 mm), BM-21 Grad, 2B14-1 Podnos (82 mm), M142 HIMARS (M26 and M26A1 rockets with tables of their own).
- The list has only weapons with tables both without air resistance and with it. Hidden for now: S.O.G. (M2, M29, M101, D-44, H-12, Type 53, Type 63), Seara and KamAZ MRL. They return when the missing tables appear.

### Map
- Contour lines from the height grid (the mountain button at the bottom right): every 5, 2 or 1 m as you zoom in, with height labels, in the satellite and topo modes.
- Terrain zones "Where I can hit" and "Where to stand": around the gun and around the target, with a mark at the nearest good spot. The buttons are the bottom row of the coordinate plate in the middle of the map, with icons and a colour legend. The outline is detailed and follows the terrain (360 rays) and is calculated in parts between frames, without freezing. Water is not part of the zones; a target in water is checked separately (a ring: reachable, tight, blocked, out of range).
- When a shell passes tight over a slope or hits it, the spot is marked right on the gun to target line.
- On a narrow map (a phone, a small window) the gun and target coordinates are centred in two rows, without the flight strip.

### Interface
- Settings: sections collapse and remember their state, "Air resistance in the game" is a section of its own and comes first. A switch reacts only to the toggle itself, so scrolling on a phone cannot turn an option on by touching its label. Texts in the settings and Link are shorter and clearer.
- Calculator fields in a narrow window start on one line (a long label wraps, the field does not shrink).
- The "Mods and DLC" window: cards of equal height, authors on one line; the badge of a simplified map image is bright and sits in the bottom right corner of the preview.
- Tutorial: air resistance, the weapon and table badges, zones, terrain on the line of fire, the overlay.
- Keyboard shortcuts: "Steep | flat arc mode", "Next | previous target", "Show | hide this help"; MRSI sounds are labelled "time on target".

### Windows app: overlay
- Charge, azimuth and elevation in the same order as in the Arma artillery HUD (CH, AZ, EL), with the same labels.
- "Input" with the map turned on opens the map right in the overlay: the gun and the target are placed over the game, and the main window recalculates (and picks up the new gun position).
- A warning when the fire is tight over terrain or terrain blocks the target; over Link the gunner gets it too.
- Simultaneous impact: when it is selected (the panel is open), the overlay shows the shot plan and the next shot; "fire" starts the strike.
- No line with key hints.

### Link
- The gunner receives the terrain warning and the simultaneous impact plan; "fire" on any device starts the strike for everyone.
- A warning that the settings from fire direction are updated only on the Link page, and a banner with a button to go back if the gunner has left it.

### Site
- It opens faster (on a phone with a slow connection the app is ready about twice as fast, and the first screen appears at once): range tables load one weapon at a time (the selected one first, the rest in the background so the app works offline), dictionaries other than Russian and English load on demand, React is a separate file from the browser cache. The startup code is about 3.5 times smaller.
- For search engines: every language has a link of its own (?lang=de), the tab title and description are in the interface language, there are links to the language versions, a sitemap (sitemap.xml), a description of the app for search (schema.org), a preview picture for links in messengers and social networks, and a splash with a description before the app loads.

## [0.16.1] - 2026-10-26

### Tables
- M101: tables without air resistance for both trajectories (the low one was taken again, the high one was checked line by line) and the low one with air resistance.
- The rule: ACE shows weather corrections only when air resistance is on. A table with them counts as a table for advanced ballistics, a table without them as one for a game without air resistance. If there is no table for the selected physics (most weapons have only tables with air resistance for now), another one is used and a warning is shown.

### Windows app
- Updates are checked not only on start but also every half an hour, when the window gets focus and on a second launch.
- The app runs as a single instance: a second launch opens the window that is already running.
- About shows the version and an update check button with the result or the error text.

## [0.16.0] - 2026-10-26

### Weapons
- 10 new weapons with tables from game screenshots (all "not verified in the game" for now):
  - vanilla: KamAZ MRL (Zamak MRL), Sholef (M4 Scorcher), 2S9 Sochor;
  - S.O.G. Prairie Fire (DLC): D-44, H-12, Type 53, Type 63;
  - RHSUSAF: M109A6, M119A2;
  - the SOD M777 155mm Howitzer mod: M777 (high-explosive shell only).
- 2S9 Sochor has no ranges from 1200 to 4900 m on the low trajectory of charge 2 yet (no screenshot).

### Maps
- Four Chernarus maps from CUP Terrains (grad_meh export): autumn, summer, winter and Chernarus 2020. They are in "Mods and DLC" under the "Mods" filter.
- The map import keeps the map kind (DLC, mod) set by hand in index.json: the author of Chernarus is Bohemia, but it is not part of the base game.

## [0.15.0] - 2026-10-26

### Interface
- Settings in sections: icons, quick jumps between sections, switches on the right, as in phone settings.
  An example of a feature opens with the "Show an example" button (no hover or long press, no lag on a phone).
- Text is no longer cut off with an ellipsis: toggles first hide icons and reduce the font, then split the width by label length; lists wrap long names.
- The footer on a PC is a single row without gaps. On a phone it is two even rows: the tutorial and settings on top, Link, theme and language below.
- The coordinate plate on a phone takes two rows and does not overlap the map layer button.
- Input rows on a phone: labels on one line, units ("m/s", "hPa") do not wrap.
- Table verification in the game is shown by a badge in the corner of the weapon tile (a yellow "!" or a green check mark), in the weapon list too; the text "verified / not verified" is gone from the labels.
- The map quality badge is inside the map list, the buttons under the map have no gaps.
- The new marker window: the label takes the full width, the hue wheel opens inside the window when the colour is pressed (the separate rainbow circle is gone).

### Terrain along the shell path
- The height map is used to check whether the shell hits a hill or a ridge on its way (the arc is calculated from the elevation angle as a parabola, without air resistance, like the tables; with air resistance the shell flies higher, so the estimate is on the safe side).
- Charges that hit terrain are marked with a mountain icon and struck through; "Auto" and the priority choice avoid them.
- If the selected solution hits terrain or passes tight (within 15 m over a bump), a warning appears with the terrain and arc profile and a hint what to fire instead.
- The check works when the gun and the target are on the map and the distance was not edited by hand; trees and buildings are not taken into account.

### Simultaneous impact (MRSI)
- It is called "Simultaneous impact" and is turned on in the settings ("Calculator sections", with an example). It works for towed guns and self-propelled guns; a mortar and an MLRS get an explanation instead of the panel.
- A new panel: reload time, the next shot in large type (charge, elevation, countdown), a bar until impact, the plan of all shots.

### Line fire
- Fire density is selected instead of the weapon type (dense, medium, sparse, very sparse); the recommended one fits the current weapon.
- Every point shows elevation and azimuth (and the charge if it changes along the line), the current point is large and has arrows.

### Maps and weapons
- The "Mods and DLC" window (formerly "Mods") for maps and weapons, with the filter "All / DLC / Mods"; DLC maps (Tanoa, Livonia, Cam Lao Nam) moved there.
- A low quality warning for maps built without grad_meh (Cam Lao Nam for now).
- A single "Markers" list on the map instead of separate "Targets" and "Markers"; with Link on, everyone in the room sees the markers.

### Calculation
- Inputs survive a change of weapon or shell and a reload: distance, heights, azimuth, the target on the map, adjustments. The shell, trajectory and charge are remembered for each weapon.

## [0.14.0] - 2026-10-25

### Maps
- 26 built-in maps: official ones (Altis, Stratis, Tanoa, Malden, Livonia, VR, Cam Lao Nam) and community maps with their authors' permission; mod maps are in a window with search and favourites.
- A vector layer: buildings, roads, forests, contour lines, names and spot heights; the "Satellite / Topo" mode (the button in the bottom right corner of the map).
- Smooth dragging and zooming (the map base is drawn once and shifted).
- Drawing on the map (pencil, straight line, eraser, colours), map markers, colour choice with a hue wheel.
- Line fire with aim points, range rings, voting for new maps and weapons.

### Calculation
- Automatic choice of trajectory and charge ("best", "fast", "precise"), a strip of all charges, "only the good charges".
- The option "Weather and advanced ballistics": a separate set of tables for a game with air resistance.
- A "verified / not verified in the game" badge on every weapon.
- Flight animation in the timer line, a volley ("+ shell"), timer sounds.

### Interface
- 7 languages: Russian, English, Ukrainian, German, French, Japanese, Chinese.
- A tutorial (basic and advanced), keyboard shortcuts, a convenient footer on a phone.

### Reliability
- An error screen instead of a white screen, separate protection for the map, an error log on the device and a one-click report.
- Smoke tests of the built site in a browser (Playwright) in CI and before publishing.
- Link: protection against replay of intercepted messages (AES-GCM encryption was there before).
- Maps moved out of the main git history to the `maps` branch.

### Tools
- Map export without grad_meh from inside the game (topo and a photo of the map).

## [0.13.0] - 2026-10-17
- Built-in maps Altis, Stratis and Tanoa; a corrected Mk6 table.

## [0.12.0]
- A new interface design, time on target (TOT), journal targets on the map.
