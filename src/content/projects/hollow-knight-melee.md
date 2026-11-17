---
title: "Hollow Knight: Melee"
wing: fabrication
status: in-flight
flagship: true
summary: Play Hollow Knight as Super Smash Bros. Melee characters, running Melee's own recompiled code.
stack: [Python, C, "C#"]
role: Solo build
facts:
  - label: Characters
    value: "26"
  - label: Accuracy
    value: Frame for frame
  - label: Platforms
    value: Windows, Linux
links:
  - label: Source
    href: https://github.com/9je/hollow-knight-melee
  - label: Installer
    href: https://github.com/9je/hollow-knight-melee/releases/latest
media:
  - kind: video
    src: /projects/hollow-knight-melee/loop.mp4
    poster: /projects/hollow-knight-melee/loop-poster.webp
    alt: Fox from Melee fighting through Greenpath in Hollow Knight, landing aerials and shines on its enemies.
    width: 960
    height: 540
exhibit:
  anchor: hollow-knight-melee
started: 2026-10
order: 15
---
A Hollow Knight mod where you play as Fox, or any of the other 25 Melee characters, with movement and combat that match Melee frame for frame.

It does not imitate Melee. A recompiler I wrote turns the PowerPC code on your own Melee disc into C, and that builds into a native library the mod loads. Hollow Knight's rooms become Melee collision. Hits, hitlag, knockback, grabs and sounds all come from Melee itself.

Nothing from Melee ships with it. One installer finds the game, takes your ISO, backs up your saves and builds the core on your machine.
