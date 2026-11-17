---
title: phob-screen
wing: fabrication
status: in-flight
flagship: true
summary: A full colour screen on a PhobGCC controller board, running inside the real firmware.
stack: [C++, RP2040, Python]
role: Firmware and hardware, solo
facts:
  - label: Panel
    value: 240 x 240
  - label: Refresh
    value: Up to 30 fps
  - label: Hardware
    value: v1 built
media:
  - kind: image
    src: /projects/phob-screen/01.webp
    alt: Princess Peach winking, playing as the idle animation on the controller's screen.
    caption: Idle
    pixel: true
    width: 480
    height: 480
  - kind: image
    src: /projects/phob-screen/02.webp
    alt: The stick calibration screen, measuring notch 6 of 32 with live x and y readouts.
    caption: Measure
    pixel: true
    width: 960
    height: 960
  - kind: image
    src: /projects/phob-screen/03.webp
    alt: The stick calibration screen adjusting a notch, the readouts green once the stick is on target.
    caption: Adjust
    pixel: true
    width: 960
    height: 960
  - kind: image
    src: /projects/phob-screen/04.webp
    alt: The config page listing every Phob setting, changed with the D-pad.
    caption: Config
    pixel: true
    width: 960
    height: 960
exhibit:
  anchor: phob-screen
started: 2026-11
order: 10
---
The PhobGCC is the open source motherboard that competitive Melee players put in their GameCube controllers. This adds a 1.3 inch colour LCD to it, driven from the board's own RP2040 through its spare GPIO header. As far as I can tell, nobody has done it this way before.

It is not a demo beside the firmware. It runs inside it. The screen shows a live input dashboard, walks you through stick calibration notch by notch, and plays an animation when the controller is idle. Animations live in their own region of flash, so swapping one never touches the firmware or your calibration.

Hardware v1 is built and it works. It is also ugly. The custom board is on order.
