---
title: earworm.games
wing: fabrication
status: operational
summary: A guess-the-song game, built because the ones that already existed did not fit how my friends play.
stack: [SvelteKit, TypeScript, Python, SQLite]
links:
  - label: earworm.games
    href: https://earworm.games
order: 30
---
A clip plays for a tenth of a second and you guess the song. Every wrong guess unlocks a longer slice, up to sixteen seconds.

Games like it already existed. None of them had the library my friends actually listen to, so this one has a bigger pool behind it and an interface that gets out of the way. The part I did not expect to learn was audio: every clip is normalised to one loudness and encoded twice, because a quiet seventies record next to a modern one gives the decade away by volume alone.
