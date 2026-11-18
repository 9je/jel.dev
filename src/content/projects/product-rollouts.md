---
title: Product rollouts at scale
wing: operations
status: restricted
summary: Security products taken from pilot to the whole client fleet, one product a quarter, owned start to finish.
stack: [ITDR, DNS Filtering, Disk Encryption, SIEM]
facts:
  - label: Endpoints on SIEM
    value: 5,000+
  - label: Identities watched
    value: Thousands
  - label: Pace
    value: One product a quarter
  - label: First client
    value: Ourselves
order: 20
---
Rolling a security product out across a client base is a deployment problem, a data problem and a communication problem at once. I have run these for identity threat detection, DNS filtering, desktop encryption and SIEM, among others. Each one is mine for the quarter it takes.

It starts in house. We run the product on ourselves first, and what breaks there becomes the procedure the service desk works from. Then I build the deployment and validation tooling that takes it from pilot to every endpoint or identity, the reporting that proves it landed, and the monitoring checks that catch a tenant drifting out of line before a client does.
