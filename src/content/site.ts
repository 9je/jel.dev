import type { Wing } from './schema';

export const site = {
  name: 'JEL',
  fullName: 'Jordan Eldridge Labs',
  description: 'Jordan Eldridge Labs: automation for MSPs, shipped products, community tooling, and security work, all in one facility.',
  intro:
    'JEL is where I keep everything I build. I work in compliance for an MSP and automate whatever I can reach. Outside work I ship products, build tools for the communities I play in, and do security research. Pick a wing.',
  wings: {
    operations: {
      name: 'Operations',
      tagline: 'Compliance, MSP tooling, and automation at work.',
      summary: 'The day job: compliance operations for an MSP, and the automation that keeps it running. Work here is described at the level of outcomes. No client names.',
    },
    fabrication: {
      name: 'Fabrication',
      tagline: 'Products I ship.',
      summary: 'Things built to be used by strangers: a SaaS, a hardware business, and open source that other people depend on.',
    },
    recreation: {
      name: 'Recreation',
      tagline: 'Tools for the games and communities I am part of.',
      summary: 'Built for players first. Some of these have more daily users than anything else I run.',
    },
    containment: {
      name: 'Containment',
      tagline: 'Pentesting, bug bounties, and security tooling.',
      summary: 'Offensive security work. Most of it cannot be shown until disclosure clears, so this wing fills in over time.',
    },
  } satisfies Record<Wing, { name: string; tagline: string; summary: string }>,
  about: {
    line: 'Jordan Eldridge. 23. Self-taught.',
    body: [
      'I learned by building things people needed and fixing them when they broke. At work that means compliance operations for a managed service provider, where I automate the repetitive parts so the people around me can do the interesting parts.',
      'Outside work I run a few things with real users, ship products under JEL, and spend my remaining hours on security research. This site is the one place all of it lives.',
    ],
    timeline: [
      { when: '2024', what: 'Earned eJPT and ISC2 CC. Shipped torn.bet.' },
      { when: '2025', what: 'Started ezkey.io and conch.gg. Kayou bot passes 1,500 Discord members.' },
      { when: '2026', what: 'First bug bounty accepted, pending disclosure. jel.dev goes live.' },
    ],
    email: 'eldridge.dev@outlook.com',
    github: 'https://github.com/9je',
  },
};
