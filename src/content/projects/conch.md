---
title: conch.gg
wing: fabrication
status: in-flight
summary: Custom GameCube controllers, and the Rust bridge that puts one in a browser.
stack: [Rust, TypeScript]
links:
  - label: conch.gg
    href: https://conch.gg
  - label: gc-bridge source
    href: https://github.com/9je/gc-bridge
order: 20
---
A small hardware business: custom built GameCube controllers for players who care as much as I do. The site sells them and hosts the tools I wrote along the way, including a browser-based input viewer.

Underneath that viewer is gc-bridge, a local server in Rust that reads a GameCube adapter and streams its inputs to the browser. Rust so the latency stays out of the way, and open source so others can use it in their own projects.
