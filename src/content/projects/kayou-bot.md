---
title: MLPEKAYOU bot
wing: recreation
status: closed-source
summary: The Discord bot for mlpekayou.community, linking members to their card collections.
stack: [TypeScript, Discord API, Canvas]
links:
  - label: mlpekayou.community
    href: https://mlpekayou.community
media:
  - kind: image
    src: /projects/kayou-bot/01.webp
    alt: A collection screen drawn by the bot, with a member's sets as card art and a progress bar under each.
    caption: Collection
    width: 1200
    height: 1014
  - kind: image
    src: /projects/kayou-bot/02.webp
    alt: A looking for screen drawn by the bot, showing the three cards a member is missing from a set.
    caption: Looking for
    width: 1000
    height: 597
order: 30
---
mlpekayou.community is a collector site for My Little Pony Kayou cards with over 6,000 members and a 1,500-member Discord. The bot ties a Discord account to a site account so members can track and look up their cards without leaving the server, along with finding people to trade with. It is the app of mine with the most daily users.

The bot draws every screen itself. Profiles, collections and trade matches are rendered as images on a canvas and sent in Discord's newer component frame, so it looks like the site and not like a wall of embeds.
