---
title: earworm.games
wing: fabrication
status: operational
summary: A guess-the-song game, built because the ones that already existed did not fit my friend group's needs.
stack: [SvelteKit, TypeScript, Python, SQLite]
links:
  - label: earworm.games
    href: https://earworm.games
media:
  - kind: image
    src: /projects/earworm/room.webp
    alt: "The earworm.games exhibit in the dispatch office: a cassette five times life size on a lit plinth, under its nameplate."
    caption: In the room
    width: 720
    height: 540
order: 30
---
A clip plays for a tenth of a second and you guess the song. Every wrong guess unlocks a longer slice, up to sixteen seconds.

Games like it already existed. None of them had the library we wanted, so this one has a bigger pool behind it and an interface we like more. Got to learn a lot about audio, volume normalization, encoding, and efficient file formats to make it the best it could be.
