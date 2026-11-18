---
title: Workflow automation
wing: operations
status: restricted
summary: Automation built across Pia, Rewst and Power Automate, with user onboarding and offboarding at the centre.
stack: [Pia, Rewst, Power Automate, PowerShell]
facts:
  - label: Orchestrators
    value: Pia, Rewst, Power Automate
  - label: Onboarding steps carried
    value: A dozen
  - label: Hands on keyboard
    value: None
order: 30
---
We run three orchestrators and I build in all of them, picking whichever fits the job.

Most of the work has gone into bringing users on and taking them off. Onboarding at an MSP is the same dozen steps repeated across many client tenants, each with its own quirks. The automation takes the request and carries it through account creation, licensing, groups, devices and the client-specific extras, then reports back. Engineers review the result instead of doing the steps.

The rest is built as the need comes up: reports that reconcile licenses between portals so the mismatches get fixed, scheduled rotation of the global admin passwords across client tenants, forwarding of text messages to email, and a long tail of smaller jobs.
