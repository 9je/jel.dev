---
title: earworm.games
wing: recreation
status: operational
summary: A guess-the-song game. A tenth of a second of a track, then longer slices until you name it.
stack: [SvelteKit, TypeScript, Python, SQLite]
links:
  - label: earworm.games
    href: https://earworm.games
order: 15
---
A clip plays for a tenth of a second and you guess the song from a search box. Every wrong guess or skip unlocks a longer slice, up to sixteen seconds. Solo, endless, no accounts to make.

The harder half is the library behind it. A Python pipeline resolves each track against Deezer for canonical metadata and cover art, rips the audio, trims the leading silence so a fade in survives but dead air does not, and normalises every clip to the same loudness, because a quiet seventies recording next to a modern one gives the decade away by volume alone. Each clip is encoded twice, since iOS Safari cannot decode Opus through the Web Audio API.

Nothing the browser receives says what the song is. Clips are served under a per round id, the files on disk are named by a hash, and every guess is checked on the server against the round it belongs to.
