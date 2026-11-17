---
title: AI trading desk
wing: recreation
status: operational
summary: Peaked at over 200 percent inside its first fifteen days. An AI desk that day trades my own account, with code holding the risk.
stack: [Python, Claude, SQLite, Docker]
role: Solo build
facts:
  - label: Peak return
    value: +219%
  - label: Reached
    value: 17 Nov 2026
  - label: Live since
    value: 2 Nov 2026
  - label: Closed trades
    value: "44"
media:
  - kind: image
    src: /projects/trading-desk/02.webp
    alt: The list of closed trades, each with its setup, its entry and exit times, why it was sold, and its return. Dollar amounts are hidden.
    invert: true
    width: 1328
    height: 1280
exhibit:
  anchor: trading-desk
started: 2026-10
order: 20
---
A desk that day trades my own brokerage account through the Robinhood MCP. It wakes before the open, reads what is moving and why, and takes a trade only when it sees a reason. Every entry has a thesis, a target and a stop written down before the order goes in.

The model decides. Code enforces. Claude never places an order itself. It runs as an unprivileged process that cannot read the broker token, and every decision passes a risk module that sizes the trade and can refuse it. Stops, targets and the daily loss limit are mechanical, so an exit never waits on a model. A watchdog, a shadow benchmark and a replay mode keep the record honest.

It went live on 2 November 2026 and peaked at 219 percent up on 17 November, measured on unit value so deposits do not count as gains. It wins under half of its trades and makes its money on the size of the winners. It is a small account and a short record, and I expect it to have bad weeks.
