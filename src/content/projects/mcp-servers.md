---
title: MCP servers for Copilot
wing: operations
status: restricted
summary: Vendor MCP servers deployed to the company's Copilot, and in-house servers built with the dev team.
stack: [MCP, Copilot, ConnectWise]
role: Contributor and reviewer on a larger dev team
facts:
  - label: Vendor servers
    value: Deployed
  - label: In-house servers
    value: In build
  - label: My part
    value: PRs and reviews
  - label: Status
    value: Current focus
order: 15
---
This is what I am working on now. An MCP server gives an AI assistant a safe, defined way to reach a system: look up a ticket, read a device's state, check a tenant. The goal is for our engineers to ask Copilot a question and get an answer from the tools we already run.

There are two halves. One is taking the MCP servers our vendors publish and deploying them to our Copilot, with the access and guard rails an MSP needs. The other is building our own for the systems nobody ships one for. That half is a team effort. I submit pull requests, review the ones other teams send, and none of it is mine alone.

It follows on from earlier internal tooling: Copilot agents that answer from our own knowledge, and ConnectWise extensions that put the right action one click away.
