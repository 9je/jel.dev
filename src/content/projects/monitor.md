---
title: Monitor
wing: fabrication
status: operational
summary: A Pop OS desktop app for saying which screen is the primary one, in Rust.
stack: [Rust, egui]
links:
  - label: github.com/9je/monitor
    href: https://github.com/9je/monitor
order: 40
---
Pop OS will tell you which monitors are connected. It will not tell you which of them is the one on the left. This lists every output with its port, resolution, refresh rate and physical size, sets the primary display in a click, and identifies a screen by dimming every other one for a few seconds.

Rust and egui on top of xrandr. It notices when it is running inside a Flatpak sandbox and proxies its calls back out to the host, which is the part that took the longest.
