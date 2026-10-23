# Pebble Town — project guide for Claude Code

A Toca Boca–style digital dollhouse for young kids. Original art and characters (never copy Toca Boca's
look, names, or sounds). It is a web app played mostly on **iPad in landscape**, installed to the home
screen as a full-screen web app. Owner: Sukhrob. Players: his kids.

## Commands

| Task | Command |
|---|---|
| Install | `npm ci` then `npx playwright install chromium` |
| Run locally | `npm run dev` → http://localhost:4173 (open on an iPad on the same Wi‑Fi via the computer's LAN IP) |
| Static checks | `npm run check` (script syntax, manifest, no external scripts) |
| Browser tests | `npm test` (Playwright, iPad landscape viewport) |
| Production build | `npm run build` → `dist/` (stamps the build id into `index.html` and `sw.js`) |
| Preview the build | `npm run preview` → http://localhost:4174 |

Always run `npm run check && npm test` before committing. CI runs the same steps.

## Layout

```
app/                    ← everything that ships (served as-is, no bundler)
  index.html            ← the whole game: CSS + markup + one inline <script>
  sw.js                 ← offline cache; cache name gets the build id
  manifest.webmanifest  ← home-screen install (fullscreen, landscape)
  icons/                ← icon.svg source + rendered PNGs (180/192/512)
scripts/build.mjs       ← app/ → dist/, replaces __BUILD__
scripts/check.mjs       ← fast static checks
tests/smoke.spec.js     ← Playwright smoke tests
.github/workflows/ci.yml← test on every push/PR; deploy main to GitHub Pages
```

## How the game is built (app/index.html)

One full-screen SVG stage, `viewBox="0 0 1440 1000"`, letterboxed to the screen. **All game coordinates
are world units in that box.** The exception is the **town**: a room with `w: TW` (7840) that is wider than the
screen. A camera (`S.camX`) slides it left/right by translating `#cam` (room + entities), `#cam2` (particles, lamp
glow) and the night-mask `#holes`. Use `wOf(e)` (not 1440) when clamping an entity's x, and `viewCX()` for
"the middle of what's on screen". The floor band starts at `FT=790`; the lowest floor point is `FB=984`.
Entities stand at their **feet** (x, y = bottom centre).

The script is split by banner comments (`/* ===== Name ===== */`). In order:

1. **Sound**: everything is synthesized with WebAudio (`A.*`). There are no audio files. Audio only starts after the first tap (an iOS rule).
2. **Shared room pieces**: `WALLS`/`FENCES` paint palettes, `woodFloor`, `wallFloor`, and `win()`, which draws the reusable window with day/night sky.
3. **Kitchen / Bedroom / Bathroom / Garden**: each `xxxArt()` returns the room's SVG string. Tappable parts are groups with `data-hot="<name>"`. Add `data-piv="x y"` plus an `id` to make a part wobble when tapped.
4. **Room definitions (`ROOMS`)**: per room:
   - `art`, `paints`, `defPaint`
   - `lamp`/`glow`: where the night-time light hole sits
   - `hint`: where the dress-up hint stars appear
   - `props`: SVG drawn *inside the entity layer* with a sort depth. The tub front is one, so kids look like they're sitting in the bath.
   - `surf`: surfaces things can land on: `{id, x1, x2, y, chars?, seat?, lie?, snap?, itemY?()}`
5. **Characters & pets**: `charArt(look, state)` and `petArt('cat'|'dog', state)` return SVG for a pose. Poses: stand, sit (seat), lie (bed, rotated −90°), up (being dragged). `OPTS` lists the dress-up options.
6. **Things (`ITEMS`)**: each item has `{h, w, food?, drink?, snd?, crumb?, art}`. `BOX_ORDER` controls the toy box order, and `CHEST_TOYS` lists what the bedroom chest pops out.
7. **Starting house (`DEFAULTS`)**: every default entity with its starting room, position and surface.
8. **World state**: `S` holds global state (room, night, lamps, bath level, flowers, paint, …) and `E` holds the entity list. `build(saved)` loads a save; `snapshot()` produces one.
9. **Town**: `townArt()` draws the street: sky and a parallax layer (`#para`: sun, hills, the far-off city `skyline()`), side streets, pavement (790–906) and a two-lane road (906–1000) with zebra crossings and traffic lights at `CROSSX`. Honey Street (lots 0–8) is on the left, Main Street on the right. `drawTown()` fills `#blds` with buildings or empty lots (lots get a pulsing "+" in build mode). Lot positions are `LOTX`; lot `HONEY_LOT` is always the Honey Street House (the 4 original rooms, `HONEY`). Buildings are drawn in local coords (x centred on the lot, y=0 at the pavement) by `bldArt(type, c)`; `bldWins()` lists the windows that glow at night.
   - **Fake 3D**: boxes get a darker side face going "back" along `DPX/DPY` (`side()`), gable roofs a receding slope (`roofSide()`), buildings a grass shadow (`gShadow()`), and `wins(type)` draws lit windows with an inset shadow and sills. Use these for new building art. The street also has a picket fence, `bush()`es, tappable hydrants (`HYDX`) and mailboxes (`MAILX`), bins and slanted pavement slabs.
   - **Big buildings** (`LMS`: school, library, market) always stand on Main Street, each with a giant toy on its roof (`lmArt`). Each floor is its own room with `lm` set (`lmRooms()`, art under "Big buildings (inside)"). Floor buttons (`data-lm`) are added to `#rooms` at start and shown only inside that building. `S.floor` remembers the last floor per building.
   - **Street traffic**: `CARS` (convertibles, a bus, an ice-cream van) drive in `LANEY` lanes and turn around off-screen at the ends. `stepCars` brakes for other cars, red lights (`S.red`) and anyone standing in the lane. Each car has a moving seat surface (`car0`…) in the town's `surf`: dropping a friend over a car seats them (see `drop`), they ride along and the camera follows (`S.follow`). Cars are drawn in the entity layer as sorted props.
   - **Town map** ("Town map (bird’s-eye)" banner): the map button opens `#map`, a tilted isometric overview drawn on its own SVG by `drawMap()`. Honey Street runs up-right along ground axis `a`, Main Street down-right along `b`, meeting at a crossroads; `gp(a,b,z)` projects to the screen. Buildings are drawn in a street frame (`mFrame(x)`: u along the street, w back, z up) with `mbox`, `mgable` (tiled), `mface` (paints flat art onto the front wall) and `mside` (onto the end wall facing us) by `mBld(type)`. There is no sky: the map is letterboxed, so `mView()` works out the on-screen part (`MV`) and the ground, roads and filler blocks fill all of it (`mSeen` culls what is off screen). Roads come from `mRoads()`; `mGround` rounds every kerb where two roads meet (`mFillet`). Filler city blocks (`mBlocks`: `mHouse`, `mTower`, small parks, rows of houses in front of the streets) are decoration. Set pieces (`mSets`: `mMall` with its car park, `mCafe`, `mRestaurant`, `mHospital`) fill the blocks listed in `MRES`; their signs pair an icon (`msign` + `IC_*`) with a word label painted on the wall (`mtxt`: SHOPPING MALL, COFFEE, RESTAURANT, HOSPITAL, and LIBRARY / SCHOOL / GROCERY on the big buildings), matching the owner's reference town art. The map is the game's landing page: the splash's Play button opens it, and its close button drops you onto the street below. The park (`MPK` block: `mParkGround` for flat things drawn in ground coords via `GM`, `mPark` for gazebo, ponds' fountain, bridge, playground, fenced pitch, benches, lamps, trees) sits between the two streets. Every vehicle is a rounded little model from `mveh(o, dir, type, col)` (sedan, hatch, suv, taxi, pickup, conv, ice, bus, truck, fire, amb), built from rounded slabs (`vslab`). Parked cars are `mcar`, lamps `mlamp` (they glow at night). Trees are `mtree`: a lumpy, shaded crown built from `mclump`s (or now and then a conifer), seeded by position so each one differs. The street's cars, extra side-street traffic (`mTraf`, map only) and friends (`mFigs`) appear too. Moving cars are slotted into the depth-sorted scenery `#mL` by `mMove`, so buildings in front hide them. The map opens zoomed in (`MZ`) on the middle of town inside `#mZoom`; dragging pans it (`mapDown/Move/Up`, clamped by `mPanTo` to the area drawn at zoom 1). Scenery goes through `mSoft()`, which swaps the bold ink for thin soft outlines (a model-town look with slate roofs, grey asphalt and natural greens); lot markers, the pin and friends keep the bold ink. Tapping a building enters it, an empty lot opens the builder there, anywhere else jumps to that spot of the street (`mapTap`). A new building type needs an `mBld` branch.
10. **Built houses and shops**: each built building is `{id:'b<n>', lot, type:'home'|'shop', c}` in `S.blds` and gets its own room via `regBld(b)` (`ROOMS[b.id]`, interior art `homeArt`/`shopArt`). `addBld`, `changeBld`, `razeBld` (moves anything inside out onto the street) and the picker sheet (`openBuild`) live under the "Building with the hammer" banner. Shop food on shelves is `data-hot="buy"` and drops a real item.
11. **Rooms on screen**: `buildRoom()` swaps the room art, re-attaches that room's entities and settles anything that has no valid surface. `switchRoom(id)` changes rooms; going back to the town centres the camera on the building you came out of. `updateUI()` shows the back arrow inside buildings, the room tabs only inside the Honey house, and the hammer only in town.
12. **Poses and geometry**: `toWorld()`, `head()`, `hand()`, and physics:
    - `startFall(e, vx, vy)` → `stepFall` → `land`. Things drop until they cross a surface, and the ball bounces.
    - `sortZ()` orders entities by feet y; dragged things always go on top.
13. **Interactions**:
    - `lift`, `drop`, `tryGive`: drop food on a head to eat it, drop an item on a body to hold it.
    - `startEat`/`finishEat`: default foods go back to the kitchen fridge, and spawned foods disappear.
    - `travel` (move to another room), `spawnItem`, `removeEnt`
    - `tapEnt` (tapping a thing) and `tapHot` (tapping scenery)
14. **Pointer input**: multi-touch drag. Dropping onto `[data-drop]` buttons moves a thing to another room (the back arrow is `data-room="town"`), or puts it in the toy box. In town, dragging a thing up off the pavement onto a building takes it inside (`bldAt`). Swiping empty space or a building in town pans the camera with inertia (`stepCam`); holding a dragged thing near the screen edge scrolls the street along. Velocity on release makes thrown things fly.
15. **Particles** (`spawn`, `burst`), the **frame loop** (`frame` → `stepEnt` per entity in the current room, then `ambient`), **dress-up**, the **toy box**, the **toolbar**, and **boot**.

`window.__pt` exposes `{S, E, byId, ROOMS, switchRoom, addBld, lotX, CARS, LMS, openMap, tapHot}`. **It is a test hook used by `tests/`. Keep it.**

## Saving

- Saves go to `localStorage`, key `pebble-town.honey-street.v1`, written 400 ms after any change. The format is `v: 3` (adds `blds`, `bldN`, `camX`, `homeRoom`; later an optional `floor` map). Riders in cars are saved without a surface, so they land on the pavement after a reload.
- Changing the save shape is allowed, but keep loading older saves. `build()` loads v1 (kitchen-only) and v2 (house-only, no town) saves, so follow that pattern and never wipe a child's house. New games start in the town.
- Removed default items are listed in `removed`. Spawned items have `spawned: true` and ids `s<n>`. The cap is `MAXSP = 40`.
- Home-screen web apps on iPad keep their own storage, separate from Safari tabs. That storage isn't cleared by Safari's 7-day rule. The app also calls `navigator.storage.persist()`.

## Rules for changes

- **Kid-safe by default:**
  - no ads, analytics, tracking, accounts, or outbound links
  - no text kids must read to play (icons and sound instead)
  - anything for grown-ups (settings, links, purchases) goes behind a parental gate
- **No runtime dependencies or external scripts.** `npm run check` fails if a `<script src>` appears. The only outside request is Google Fonts, with a full fallback stack.
- **iPad first:**
  - tap targets ≥ 52 px
  - landscape layout
  - respect `env(safe-area-inset-*)`
  - test multi-touch
  - no hover-only UI
  - keep the frame loop light. SVG node count matters, so particles are capped at 140.
- **Visual language:**
  - thick ink outlines (`K = #2E2A4F`, 4–5 px), flat sticker colors, the Baloo 2 display font
  - single light theme on purpose
  - new art should match: same stroke width, rounded joins, no gradients except light glows
- When adding a room, item, surface or building type, add or extend a test in `tests/smoke.spec.js`.

## Recipes

- **New item:** add it to `ITEMS`, then to `BOX_ORDER` (and `CHEST_TOYS` if it's a toy). For special tap behaviour, add a branch in `tapEnt`.
- **New surface:** add `{id, x1, x2, y}` to the room's `surf`. Use `chars: true` if friends or pets can stand on it, `seat: true` for sitting, `lie: true` for sleeping, and `snap: [min,max]` to centre them.
- **New room:**
  1. Write `fooArt()` and add a `ROOMS.foo` entry.
  2. Add a room button in `#rooms` with an inline SVG icon.
  3. Optionally add defaults in `DEFAULTS`.
  4. Add it to the "every room renders" test.
- **New big building:** add an `LMS` entry (x, half-width `hw`, floor room ids, tab colour) clear of lots and crossings, a branch in `lmArt()` + `bldWins()`, and its floor rooms in `lmRooms()`.
- **New building type:** add a palette list and a branch in `bldArt()` + `bldWins()`, an interior `fooArt(b)` and surfaces, a `BROOM.foo` entry, `BTYPES.foo`, and tiles in `BUILD_OPTS`.
- **New tappable scenery:** wrap the SVG in `<g data-hot="name" class="hot">` and handle `case 'name'` in `tapHot`.

## Deploying

The `main` branch deploys automatically to GitHub Pages after the tests pass. Pull requests only run tests. Each deploy gets a new build id: it shows on the start screen ("version abc1234") and renames the service worker's cache, so iPads pick up updates the next time the app is opened with a connection. They may need to close and reopen it once.

## Backlog ideas

- A park/playground lot, more big buildings (cinema, hair salon, hospital)
- Stickers or decorations kids can place on walls
- A "make a new friend" button
- Day/night that follows the real clock (optional)
- Gentle background music per room, plus a parent-gated settings panel (volume, reset)
- Split `index.html` into ES modules (`app/js/*.js`) once it gets too big to edit comfortably. Keep it build-free.
- Later: wrap with Capacitor for the App Store (Kids Category rules: no third-party ads or analytics, parental gates)
