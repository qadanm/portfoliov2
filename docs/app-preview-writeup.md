# Two App Previews, built like software

The App Store gives you thirty seconds and a three-second scroll. I wanted the
preview to teach the game rather than describe it, so I built both of them as
code instead of editing them in a timeline.

## The setup

Two files, one per slot Apple actually serves in the 1.4 listing:

| | iPhone | iPad |
|---|---|---|
| Resolution | 886 × 1920 | 1600 × 1200 |
| Frames | 864 at 30 fps | 864 at 30 fps |
| Length | 28.8 s | 28.8 s |

They live in `social/renderer` in the app's monorepo, as Remotion compositions.
Every layout, easing curve, and cut is a React component driven by a frame
number, so a beat can be moved by editing an integer and the whole film
re-renders identically. Nothing is keyframed by hand.

That mattered because Apple's rules are a design constraint, not a checklist.
Previews have to show only content from inside the app, use plain transitions,
and carry a single score. So the intro and outro are composed from two files the
app already ships: the Home hero artwork and the wordmark. No stock footage, no
invented title card.

## The intro does the mechanic

CarSpotter works by showing you a detail, then landing the whole car. The intro
performs that exact move on the brand art. It opens tight on one headlight and
pulls back to reveal the line-up behind it. By the first question, the viewer
knows the game without a sentence of explanation.

My first pass had the artwork full bleed with the wordmark centred, and the
letters landed across the Mercedes' bonnet. The lazy fix is a scrim, and it
looks like a scrim. The app's own Home screen already solves it: cars occupy the
lower frame, copy sits in the space above. So the art is boxed to the bottom
66% with its top edge dissolving into ink. The wordmark can never share a pixel
with a car.

## Audio from the game, not from a library

The bed is `city.mp3`, the app's own music, running unbroken across all three
acts. Every one-shot is the cue the app fires at that same moment: `round_ready`
as a question arrives, `answer_lock` and `reveal` frame-locked to the cut.

One problem surfaced before mixing. The app's raw samples run from −9 dBFS to
−39, a 30 dB spread, so any mix either buries the cues or clips. I normalised
the whole library first, −3 dBFS per one-shot and −9 for the bed, and only then
made a mixing decision. The delivered file is mastered at +6.8 dB with a soft
limiter, because the mix landed at −9.8 dBFS and sounded thin next to other
store previews.

## The check that earned its keep

I cut the gameplay from real simulator takes. My first draft assumed where each
clip started, and three of the six iPad clips were wrong. `progress` showed the
old result screen, `packs` showed Home, `packq` showed Progress. The film
therefore showed the new result layout and then the old one, which is exactly
what a viewer notices.

The rule since then: extract one frame from every clip and compare it to the
clip's name before rendering anything. That is not optional, and it is what
caught the fourth error on the phone cut.

Same discipline at the end. `ffprobe` on both delivered files confirms H.264
High, `yuv420p`, `tv` range, 30 fps, stereo AAC, peak level. I stop guessing what
the encoder did.

## One thing I nearly shipped

The 6.5" preview slot already held a preview from an earlier release. My upload
succeeded, which is why it looked fine, and the old film would have appeared
alongside the new one on smaller phones. Checking whether your asset landed is
not the same as checking what the slot contains.
