/**
 * Single source of truth for every word on the site.
 *
 * Rule: only facts Ritesh has provided. No invented companies, dates,
 * metrics, certifications or clients. When the LinkedIn export / CV is
 * added, extend `experience` and the evolution chapters from it.
 */

export type FormationName =
  | 'embers'
  | 'dust'
  | 'code'
  | 'stack'
  | 'lattice'
  | 'globe'
  | 'shield'
  | 'rings'
  | 'neural'
  | 'blueprint';

export const profile = {
  name: 'Ritesh Singh',
  first: 'RITESH',
  last: 'SINGH',
  role: 'Senior Cyber Security Engineer',
  company: 'Ridge IT Cyber',
  headline: 'Senior Cyber Security Engineer | Zero Trust | Zscaler | Software Engineering | AI',
  focus: ['Zero Trust', 'Zscaler ZIA / ZPA', 'Software Engineering', 'AI'],
  // Fill these in to enable the contact buttons + terminal `contact` output.
  links: {
    linkedin: '', // e.g. 'https://www.linkedin.com/in/your-handle'
    email: '', // e.g. 'you@domain.com'
    github: '', // optional
  },
};

export const manifesto =
  "I didn't start in security. I started by writing software — APIs, databases, full-stack apps. " +
  'Then I followed the systems down: into infrastructure, networks and identity. ' +
  'Today I design and troubleshoot enterprise Zero Trust environments — and I still think like a builder.';

export interface Chapter {
  id: string;
  index: string;
  kicker: string;
  title: string;
  body: string;
  tags: string[];
  command: string;
  formation: FormationName;
  next?: boolean;
}

export const chapters: Chapter[] = [
  {
    id: 'software',
    index: '01',
    kicker: 'origin',
    title: 'Software Engineering',
    body: 'Where it started. Writing code taught me to think in systems, data and edge cases — and to care about what actually ships.',
    tags: ['Python', 'JavaScript'],
    command: '$ python3 -c "print(\'hello, world\')"',
    formation: 'code',
  },
  {
    id: 'fullstack',
    index: '02',
    kicker: 'build layer',
    title: 'Backend / Full Stack',
    body: 'From the database to the interface. APIs, data models and front-ends built with Django, Angular and React / Next.js.',
    tags: ['Django', 'Angular', 'React / Next.js', 'APIs', 'Databases'],
    command: '$ python manage.py runserver',
    formation: 'stack',
  },
  {
    id: 'enterprise',
    index: '03',
    kicker: 'scale layer',
    title: 'Enterprise Systems',
    body: 'Business-critical platforms where everything connects. ERPNext / Frappe, automation and the architecture that holds it together.',
    tags: ['ERPNext', 'Frappe', 'Automation', 'System Architecture'],
    command: '$ bench start',
    formation: 'lattice',
  },
  {
    id: 'network',
    index: '04',
    kicker: 'transport layer',
    title: 'Networking & Identity',
    body: 'Following the packets. Who is connecting, from where, on what device — and what they should be allowed to reach.',
    tags: ['Network Security', 'Identity', 'Secure Remote Access'],
    command: '$ traceroute app.internal',
    formation: 'globe',
  },
  {
    id: 'security',
    index: '05',
    kicker: 'defense layer',
    title: 'Cybersecurity',
    body: 'Enterprise security as an engineering discipline: designing policy, hardening access and troubleshooting complex environments end to end.',
    tags: ['Enterprise Security', 'Security Policy Design', 'Troubleshooting'],
    command: '$ policy apply --default deny',
    formation: 'shield',
  },
  {
    id: 'zerotrust',
    index: '06',
    kicker: 'current focus',
    title: 'Zscaler / Zero Trust',
    body: 'Never trust, always verify. Designing and troubleshooting Zero Trust environments with Zscaler — connecting users to applications, never to the network.',
    tags: ['ZIA', 'ZPA', 'Zero Trust Architecture', 'Application Access', 'RDP Connectivity'],
    command: '> evaluate(user, device, app) → ALLOW [segment]',
    formation: 'rings',
  },
  {
    id: 'ai',
    index: '07',
    kicker: 'force multiplier',
    title: 'Automation / AI',
    body: 'Putting software back into security. Automating the repetitive, and experimenting with LLMs and AI/ML to see what they can actually do.',
    tags: ['LLMs', 'AI / ML', 'Automation', 'Python'],
    command: '>>> model.generate(prompt)',
    formation: 'neural',
  },
  {
    id: 'architecture',
    index: '08',
    kicker: 'trajectory',
    title: 'Security Architecture',
    body: 'Where it all converges: scalable security solutions designed by someone who has built the software, run the systems and secured the access.',
    tags: ['Scalable Security', 'Zero Trust', 'System Design'],
    command: '$ design --trust none --scale enterprise',
    formation: 'blueprint',
    next: true,
  },
];

export interface Module {
  name: string;
  domain: string;
  detail: string;
  stack: string[];
}

export const modules: Module[] = [
  {
    name: 'Zero Trust Architecture',
    domain: 'SECURITY',
    detail: 'Least-privilege access designed around identity, device and context — never around network location.',
    stack: ['Zero Trust', 'Policy', 'Least privilege'],
  },
  {
    name: 'Zscaler Internet Access',
    domain: 'ZIA',
    detail: 'Securing user traffic to the internet and SaaS with inline inspection and policy.',
    stack: ['ZIA', 'Inspection', 'Web & SaaS policy'],
  },
  {
    name: 'Zscaler Private Access',
    domain: 'ZPA',
    detail: 'Application access without network access — app segments, connectors and RDP connectivity to private apps.',
    stack: ['ZPA', 'App segments', 'RDP'],
  },
  {
    name: 'Security Policy Design',
    domain: 'SECURITY',
    detail: 'Turning business requirements into precise, maintainable access and security policy.',
    stack: ['Access policy', 'Enterprise security'],
  },
  {
    name: 'Enterprise Troubleshooting',
    domain: 'OPERATIONS',
    detail: 'Tracing failures across identity, client, network and application layers in complex environments.',
    stack: ['Root cause', 'Network', 'Identity'],
  },
  {
    name: 'Network Security & Remote Access',
    domain: 'NETWORK',
    detail: 'Secure remote access and application connectivity for distributed users.',
    stack: ['Network security', 'Secure remote access'],
  },
  {
    name: 'Software Engineering',
    domain: 'BUILD',
    detail: 'Full-stack applications, APIs and data models.',
    stack: ['Python', 'JavaScript', 'Django', 'Angular', 'React / Next.js', 'Databases'],
  },
  {
    name: 'Enterprise Platforms',
    domain: 'BUILD',
    detail: 'ERP systems and business workflows on ERPNext / Frappe.',
    stack: ['ERPNext', 'Frappe', 'APIs'],
  },
  {
    name: 'Automation & AI',
    domain: 'AI',
    detail: 'Automation, LLMs and AI/ML experimentation.',
    stack: ['LLMs', 'AI / ML', 'Automation'],
  },
  {
    name: 'System Architecture',
    domain: 'ARCHITECTURE',
    detail: 'Designing scalable systems and security solutions that hold up in production.',
    stack: ['Scalability', 'System design'],
  },
];

export const marquee = [
  'ZERO TRUST',
  'ZSCALER ZIA',
  'ZSCALER ZPA',
  'SECURE REMOTE ACCESS',
  'SECURITY POLICY DESIGN',
  'NETWORK SECURITY',
  'PYTHON',
  'DJANGO',
  'REACT / NEXT.JS',
  'ANGULAR',
  'ERPNEXT / FRAPPE',
  'LLMs',
  'AUTOMATION',
  'SYSTEM ARCHITECTURE',
];
