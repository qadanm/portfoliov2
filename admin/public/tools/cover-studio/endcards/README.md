# CarSpotter carousel endcards

Cover Studio selects one of these 11 cards when a new draft is opened. The owner can choose another card before export. `endcards.js` draws the selected card with Canvas at the same 1080 × 1350 or 1080 × 1440 size as the cover. Exports contain two numbered PNGs; no model call or server rendering is involved.

The source collection is `CarSpotter-Quirky-Endcards 4`, supplied by the site owner. `rounds.json` retains its car names, clue crops, and captions. The source photos are copied byte for byte into `photos/`; their credits and licenses are in [CREDITS.md](CREDITS.md). The Qadan Travels avatar and official App Store badge came from that collection. `carspotter-lockup.svg` is the current lockup from `https://carspottergame.com/brand/lockup-dark.svg`, replacing the older slash wordmark in the source collection.

To change a card, edit its `rounds.json` entry and check the clue crop in the editor preview. To add a card, add its photo under `photos/` and an entry in `rounds.json`, then update `loadEndcards()` in `endcards.js` if the file extension differs. Keep the photo credit in `CREDITS.md`.
