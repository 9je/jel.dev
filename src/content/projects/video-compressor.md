---
title: Video compressor for Discord
wing: fabrication
status: operational
summary: Two-pass H.264 that lands a clip under Discord's limit with the quality left in it.
stack: [Python, ffmpeg]
links:
  - label: github.com/9je/compressVideoForDiscord
    href: https://github.com/9je/compressVideoForDiscord
order: 50
---
Discord caps an upload at 10 MB unless you pay for it, and a Melee clip is always just over. This works out the largest bitrate that still fits, runs a two-pass H.264 encode at it, and hands back a file that goes straight into the chat.

Two passes rather than one because the first pass is what lets the second spend its bits where the motion is. A file picker, a progress bar, and the same behaviour on Windows and Linux.
