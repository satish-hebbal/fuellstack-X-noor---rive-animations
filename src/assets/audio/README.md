# Letter sounds

Drop audio files here named with the letter's position in front, the same way
the Rive timelines are named:

```
01-alif.mp3
02-ba.mp3
07-khaa.mp3
```

`.mp3`, `.wav`, `.m4a`, `.ogg` and `.aac` all work. The number is the whole
mapping — `01-alif.mp3` plays for letter 1. Nothing else needs editing.

## Why sounds can live here rather than in the .riv

Rive only compiles assets that something in an artboard actually references. A
sound sitting in the editor's Assets panel but not wired to an Audio Event never
makes it into the exported file — which is exactly what happened to `01-alif`.

A file in this folder always wins over a copy embedded in the .riv, so you can
fix or replace a recording without re-exporting anything from Rive.

## Why the app doesn't use Rive's Audio Events

It can't. Rive only reports Events from **state machines** — `advanceAndReportChanges`
gathers them from `activeStateMachines` and nowhere else. This file plays one
linear timeline per letter, and linear animations report no events at all, so an
Audio Event on a timeline never fires at runtime however well it previews in the
editor.
