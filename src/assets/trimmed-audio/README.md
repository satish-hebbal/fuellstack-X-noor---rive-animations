# Letter sounds

One file per letter, named with the letter's position in front — the same
number the Rive timelines use:

```
01-alif.mp3     ↔  timeline "1. alif"
02-ba.mp3       ↔  timeline "2. baa"
07-khaa.mp3     ↔  timeline "7. khaa"
```

`.mp3`, `.wav`, `.m4a`, `.ogg` and `.aac` all work. The leading number is the
whole mapping; the rest of the filename is for humans. Add a file and it plays,
with no code change.

## Why audio isn't inside the .riv

Two independent reasons, either one sufficient:

**Rive only reports Events from state machines.** `advanceAndReportChanges`
gathers them from `activeStateMachines` and nowhere else. This file plays one
linear timeline per letter, and linear animations report no events at all — so
an Audio Event sitting on a timeline never fires at runtime, however well it
previews in the editor. Embedding audio would mean rebuilding the file as 29
states and transitions.

**Rive only compiles assets something references.** A sound in the editor's
Assets panel that isn't wired to an Event never reaches the exported file, with
no warning. That's exactly what happened to `01-alif`.

## Handing this to the mobile team

Ship the `.riv` plus this folder. The contract is one sentence: *play timeline N
and sound N together; the leading number is the mapping.* It's the same on
React Native — `rive.play("7. khaa")` alongside the matching file in
`expo-av` — and it means re-recording a letter never needs a Rive re-export.

Keep the prefix strict on both sides. `7. khaa` and `07-khaa.mp3` are fine;
`khaa 7` is not, because the number is parsed from the front.
