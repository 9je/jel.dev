import type { Wing } from './schema';
import type { StopId } from '../scenes/walk/path';

export const site = {
  name: 'JEL',
  fullName: 'Jordan Eldridge Labs',
  description: 'Jordan Eldridge Labs: automation for MSPs, shipped products, community tooling, and security work, all in one facility.',
  intro:
    'JEL is where I keep everything I make. At work, I build the platform a CMMC compliant MSP runs on and automate whatever I can reach. In my free time, I ship products, build tools for the communities I play in, and do security research.',
  wings: {
    operations: {
      name: 'Operations',
      tagline: 'Platform development and automation at a CMMC compliant MSP.',
      summary: 'The day job. Platform development at a compliance-focused MSP: rollouts, automation, R&D and the tooling in between. Work here is shared at high level detail, with client names omitted.',
    },
    fabrication: {
      name: 'Fabrication',
      tagline: 'Products I ship.',
      summary: 'Things built to be used by the world: a SaaS, a hardware business, a game, and the utilities I open sourced along the way.',
    },
    recreation: {
      name: 'Recreation',
      tagline: 'Tools for the games and communities I am part of and care about.',
      summary: "If I see a need in a community I'm passionate about, I strive to build the solution.",
    },
    containment: {
      name: 'Containment',
      tagline: 'Pentesting, bug bounties, and security tooling.',
      summary: 'Offensive security work. Most of it cannot be shown until disclosure clears, so this wing fills in over time.',
    },
  } satisfies Record<Wing, { name: string; tagline: string; summary: string }>,
  stops: {
    booth: { title: 'Jordan Eldridge Labs', lead: 'One person, one facility. Everything I build lives here. Scroll to walk it.' },
    fabrication: { title: 'Fabrication', lead: 'Products built to be used by the world.' },
    recreation: { title: 'Recreation', lead: "Tools for the games and communities I'm passionate about." },
    operations: { title: 'Operations', lead: 'Platform development and automation at a CMMC compliant MSP.' },
    credentials: { title: 'Credentials', lead: 'Networking, security, endpoints and the cloud, eight films on the viewers.' },
    containment: { title: 'Containment', lead: 'Offensive security work. Most of it stays sealed until disclosure clears.' },
    file: { title: 'Personnel file', lead: 'Who is behind the door.' },
  } satisfies Record<StopId, { title: string; lead: string }>,
  about: {
    line: 'Jordan Eldridge. 23. Self-taught. Platform Developer at a compliance-focused MSP.',
    body: [
      'I learned by building things people needed and fixing them when they broke. At work I am a Platform Developer at a compliance-focused MSP, on the team that rolls out new products, automates the repeat work, and integrates what the company acquires. PowerShell, Power Automate, Rewst and Pia are the daily tools.',
      'Outside work I run a few things with real users, ship products under JEL, and spend my remaining hours on security research. This site is the one place all of it lives.',
    ],
    // Years off the dates the repositories were opened rather than off memory, and spanning the
    // whole of it rather than the last of it: the products are all 2026, but the C++ engine is
    // 2022 and there has been something every year in between.
    timeline: [
      { when: '2022', what: 'First open source contributions.' },
      { when: '2024', what: 'Got hired at MSP and began gathering credentials.' },
      { when: '2026', what: 'Began shipping products. First bug bounty accepted. jel.dev live.' },
    ],
    email: 'eldridge.dev@outlook.com',
    github: 'https://github.com/9je',
  },
};
