---
title: Automated user onboarding
wing: operations
status: restricted
summary: End-to-end user onboarding built on Pia, from ticket to working account with no hands on keyboard.
stack: [Pia, PowerShell]
facts:
  - label: Steps carried
    value: A dozen
  - label: Hands on keyboard
    value: None
  - label: Built on
    value: Pia
media:
  - kind: image
    src: /projects/automated-onboarding/room.webp
    alt: "The onboarding console in the server hall: a set on a bench listing each step of a run as done, from request to report."
    caption: In the room
    width: 720
    height: 540
exhibit:
  anchor: automated-onboarding
order: 20
---
Onboarding at an MSP is the same dozen steps repeated across many client tenants, each with its own quirks. This automation takes the request and carries it through account creation, licensing, groups, devices and the client-specific extras, then reports back. Engineers review the result instead of doing the steps.
