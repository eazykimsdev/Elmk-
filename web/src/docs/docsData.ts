export interface DocSection {
  title: string;
  items: DocPage[];
}

export interface DocHeading {
  id: string;
  title: string;
  level: number;
}

export interface DocPage {
  id: string;
  title: string;
  section: string;
  description: string;
  lastModified: string;
  headings: DocHeading[];
  content: DocBlock[];
}

export type DocBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: number; text: string; id: string }
  | { type: 'callout'; kind: 'note' | 'tip' | 'warning'; text: string }
  | { type: 'steps'; steps: { step: number; title: string; body: string }[] }
  | { type: 'code'; language: string; code: string }
  | { type: 'cards'; cards: { title: string; description: string; linkId?: string }[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'accordion'; items: { trigger: string; content: string }[] };

export const DOCS_SECTIONS: DocSection[] = [
  {
    title: 'Getting Started',
    items: [
      {
        id: 'introduction',
        title: 'Introduction',
        section: 'Getting Started',
        description: 'Welcome to ConnectingERLC, the growth platform for Emergency Response: Liberty County communities.',
        lastModified: 'November 2026',
        headings: [
          { id: 'what-is-connectingerlc', title: 'What is ConnectingERLC', level: 2 },
          { id: 'core-capabilities', title: 'Core capabilities', level: 2 },
          { id: 'how-it-works', title: 'How it works', level: 2 }
        ],
        content: [
          {
            type: 'paragraph',
            text: 'ConnectingERLC is a verified discovery network and partnership automation engine built specifically for ER:LC roleplay communities and server owners.'
          },
          {
            type: 'callout',
            kind: 'note',
            text: 'ConnectingERLC requires a permanent Discord server invite to list in the directory. Temporary links are automatically rejected.'
          },
          {
            type: 'heading',
            level: 2,
            id: 'what-is-connectingerlc',
            text: 'What is ConnectingERLC'
          },
          {
            type: 'paragraph',
            text: 'Discord server discovery for ER:LC has traditionally been unorganized and riddled with fake member numbers. ConnectingERLC connects with Discord and your private server API to verify real active players, automate cross-server promotions, and facilitate authentic member growth.'
          },
          {
            type: 'heading',
            level: 2,
            id: 'core-capabilities',
            text: 'Core capabilities'
          },
          {
            type: 'cards',
            cards: [
              {
                title: 'Community Directory',
                description: 'Ranked discovery based on real live members, active bumps, and verified reviews.',
                linkId: 'directory-joining'
              },
              {
                title: 'Partnership Exchange',
                description: 'Automated mutual partnerships with custom webhooks, role mentions, and coin pricing.',
                linkId: 'partnerships'
              },
              {
                title: 'Recruit Hub',
                description: 'Representative links with retention tracking and verified member rewards.',
                linkId: 'recruit-hub'
              },
              {
                title: 'Bumping System',
                description: 'One-click bumping via web or Discord slash command to elevate your community.',
                linkId: 'bumps'
              }
            ]
          }
        ]
      },
      {
        id: 'getting-started',
        title: 'Getting started',
        section: 'Getting Started',
        description: 'Set up your account, link your Discord servers, and publish your first community listing.',
        lastModified: 'November 2026',
        headings: [
          { id: 'quick-start', title: 'Quick start steps', level: 2 },
          { id: 'requirements', title: 'Requirements', level: 2 }
        ],
        content: [
          {
            type: 'paragraph',
            text: 'Getting started with ConnectingERLC takes less than two minutes. Follow these three steps to bring your server live.'
          },
          {
            type: 'steps',
            steps: [
              {
                step: 1,
                title: 'Sign in with Discord',
                body: 'Authorize your Discord account using the standard OAuth2 login. Ensure you have Manage Server permissions on the communities you want to list.'
              },
              {
                step: 2,
                title: 'Select your community',
                body: 'Choose your Discord server from the workspace switcher or add the official ConnectingERLC bot.'
              },
              {
                step: 3,
                title: 'Configure and publish',
                body: 'Navigate to Promote Server, set your server category, description, and permanent invite, then click Save and publish.'
              }
            ]
          },
          {
            type: 'heading',
            level: 2,
            id: 'requirements',
            text: 'Requirements'
          },
          {
            type: 'paragraph',
            text: 'To list a community in the directory, you must be the Discord server owner or hold the Administrator role. The server invite must be permanent without an expiration date.'
          }
        ]
      },
      {
        id: 'sign-in',
        title: 'Sign in',
        section: 'Getting Started',
        description: 'How authentication works on ConnectingERLC.',
        lastModified: 'November 2026',
        headings: [
          { id: 'discord-oauth', title: 'Discord OAuth2', level: 2 },
          { id: 'sessions', title: 'Session security', level: 2 }
        ],
        content: [
          {
            type: 'paragraph',
            text: 'ConnectingERLC uses Discord OAuth2 for passwordless, secure authentication. We request basic identity information (username, avatar, user ID) and the list of servers you manage.'
          },
          {
            type: 'callout',
            kind: 'tip',
            text: 'Your Discord account remains in full control. ConnectingERLC never asks for your password or token.'
          }
        ]
      },
      {
        id: 'adding-bot',
        title: 'Your servers and adding the bot',
        section: 'Getting Started',
        description: 'Add the official ConnectingERLC bot to your Discord server.',
        lastModified: 'November 2026',
        headings: [
          { id: 'bot-invite', title: 'Bot invitation', level: 2 },
          { id: 'permissions', title: 'Required permissions', level: 2 }
        ],
        content: [
          {
            type: 'paragraph',
            text: 'While browsing the directory does not require adding the bot, bumping via Discord and automated partnership messaging require the ConnectingERLC bot.'
          },
          {
            type: 'table',
            headers: ['Permission', 'Purpose', 'Required'],
            rows: [
              ['Create Instant Invite', 'Creates permanent fallback invites for your listing', 'Yes'],
              ['Send Messages', 'Sends bump embeds and partnership notifications', 'Yes'],
              ['Embed Links', 'Renders rich community profile cards', 'Yes'],
              ['Manage Roles', 'Assigns partner and recruit verification roles', 'Optional']
            ]
          }
        ]
      }
    ]
  },
  {
    title: 'Community Growth',
    items: [
      {
        id: 'promote-server',
        title: 'Promote server',
        section: 'Community Growth',
        description: 'Complete guide to community listing configuration.',
        lastModified: 'November 2026',
        headings: [
          { id: 'primary-categories', title: 'Primary community categories', level: 2 },
          { id: 'invite-rules', title: 'Invite validation rules', level: 2 },
          { id: 'bounties', title: 'Credits and rewards', level: 2 }
        ],
        content: [
          {
            type: 'paragraph',
            text: 'The Promote Server Studio allows community owners to fine-tune their public presence across ConnectingERLC.'
          },
          {
            type: 'heading',
            level: 2,
            id: 'primary-categories',
            text: 'Primary community categories'
          },
          {
            type: 'paragraph',
            text: 'Every community is categorized under one of the strictly ordered primary categories:'
          },
          {
            type: 'table',
            headers: ['Order', 'Category Name', 'Intended Server Type'],
            rows: [
              ['1', 'Design Server', 'Liveries, logos, Discord templates, graphics'],
              ['2', 'Roleplay Server', 'ER:LC private server roleplay communities'],
              ['3', 'Misc', 'General gaming and hangout communities'],
              ['4', 'COTS', 'Custom-off-the-shelf development and utilities'],
              ['5', 'Departments', 'Police, Fire, EMS, and Departmental branches'],
              ['6', 'Events', 'Competitive roleplay events and tournaments']
            ]
          },
          {
            type: 'heading',
            level: 2,
            id: 'invite-rules',
            text: 'Invite validation rules'
          },
          {
            type: 'callout',
            kind: 'warning',
            text: 'All invites must be permanent. If Discord reports that an invite has expired or is temporary, the listing cannot be published.'
          }
        ]
      },
      {
        id: 'directory-joining',
        title: 'Directory and joining',
        section: 'Community Growth',
        description: 'How users find and join active ER:LC roleplay communities.',
        lastModified: 'November 2026',
        headings: [
          { id: 'earning-credits', title: 'How credits are earned', level: 2 },
          { id: 'minimum-stay', title: 'The minimum stay requirement', level: 2 }
        ],
        content: [
          {
            type: 'paragraph',
            text: 'ConnectingERLC provides a transparent directory where communities are sorted by active member counts and recent bumps.'
          },
          {
            type: 'heading',
            level: 2,
            id: 'earning-credits',
            text: 'How credits are earned'
          },
          {
            type: 'paragraph',
            text: 'When you join an active community through ConnectingERLC, the base reward of 2 credits is paid by ConnectingERLC. Servers may also offer extra credits paid out of their own balance.'
          },
          {
            type: 'heading',
            level: 2,
            id: 'minimum-stay',
            text: 'The minimum stay requirement'
          },
          {
            type: 'paragraph',
            text: 'To prevent raid and churn farming, joining members must remain in the server for the configured retention period (default 72 hours, or 3 days) before leave or review eligibility updates.'
          }
        ]
      },
      {
        id: 'reviews',
        title: 'Reviews',
        section: 'Community Growth',
        description: 'Authentic community feedback guidelines and eligibility rules.',
        lastModified: 'November 2026',
        headings: [
          { id: 'eligibility', title: 'Who can leave a review', level: 2 },
          { id: 'moderation', title: 'Review moderation and reports', level: 2 }
        ],
        content: [
          {
            type: 'paragraph',
            text: 'Reviews on ConnectingERLC are strictly authentic. We do not tolerate fake reviews, paid reviews, or competitor review bombing.'
          },
          {
            type: 'heading',
            level: 2,
            id: 'eligibility',
            text: 'Who can leave a review'
          },
          {
            type: 'paragraph',
            text: 'Review eligibility is calculated server-side based on six distinct states:'
          },
          {
            type: 'table',
            headers: ['State', 'Condition', 'Action Allowed'],
            rows: [
              ['Not signed in', 'User is not authenticated', 'Must sign in to review'],
              ['Own server', 'User is the server owner', 'Cannot review own server'],
              ['Not joined', 'User has not joined this community', 'Must join and complete stay'],
              ['Stay pending', 'User joined but retention timer is active', 'Must wait for stay to finish'],
              ['Eligible', 'Verified member with completed stay', 'Can submit 1 to 5 star rating and comment'],
              ['Already reviewed', 'User has an existing review', 'Can edit or delete existing review']
            ]
          }
        ]
      },
      {
        id: 'bumps',
        title: 'Bumps',
        section: 'Community Growth',
        description: 'Keep your server at the top of the public directory.',
        lastModified: 'November 2026',
        headings: [
          { id: 'how-to-bump', title: 'How to bump', level: 2 },
          { id: 'cooldowns', title: 'Bump cooldowns', level: 2 }
        ],
        content: [
          {
            type: 'paragraph',
            text: 'Bumping moves your server to the top of the directory. You can bump via the web dashboard or by running /bump in Discord.'
          },
          {
            type: 'callout',
            kind: 'tip',
            text: 'Single bumps only per cooldown window. Double bumping is strictly blocked server-side.'
          }
        ]
      },
      {
        id: 'partnerships',
        title: 'Partnerships',
        section: 'Community Growth',
        description: 'Cross-community advertising with automated broadcasts.',
        lastModified: 'November 2026',
        headings: [
          { id: 'partnership-modes', title: 'Partnership modes', level: 2 },
          { id: 'pricing-mentions', title: 'Mentions and pricing', level: 2 }
        ],
        content: [
          {
            type: 'paragraph',
            text: 'ConnectingERLC automates cross-community partnerships between server owners. When two servers agree on a partnership, ads are posted reciprocally using secure Discord webhooks.'
          }
        ]
      },
      {
        id: 'recruit-hub',
        title: 'Recruit hub',
        section: 'Community Growth',
        description: 'Track representative links and member retention.',
        lastModified: 'November 2026',
        headings: [
          { id: 'reps', title: 'Representatives', level: 2 },
          { id: 'retention', title: 'Retention tracking', level: 2 }
        ],
        content: [
          {
            type: 'paragraph',
            text: 'Recruit Hub empowers community staff and recruiters to generate unique invitation links and track their verified recruits.'
          }
        ]
      }
    ]
  },
  {
    title: 'Platform & Legal',
    items: [
      {
        id: 'bot-setup',
        title: 'Bot setup and permissions',
        section: 'Platform & Legal',
        description: 'Technical reference for bot slash commands and gateway permissions.',
        lastModified: 'November 2026',
        headings: [
          { id: 'commands', title: 'Available slash commands', level: 2 }
        ],
        content: [
          {
            type: 'paragraph',
            text: 'The ConnectingERLC bot provides clean, fast slash commands in Discord.'
          },
          {
            type: 'table',
            headers: ['Command', 'Description', 'Access'],
            rows: [
              ['/bump', 'Elevates your server in the public directory', 'Members with Manage Server'],
              ['/status', 'Displays real-time system status and component health', 'Platform Administrators'],
              ['/stats', 'Shows community member and bump counts', 'Everyone']
            ]
          }
        ]
      },
      {
        id: 'status-incidents',
        title: 'Status and incidents',
        section: 'Platform & Legal',
        description: 'How system health and incident telemetry are recorded.',
        lastModified: 'November 2026',
        headings: [
          { id: 'health-monitoring', title: '90-day telemetry', level: 2 }
        ],
        content: [
          {
            type: 'paragraph',
            text: 'ConnectingERLC provides honest, transparent uptime monitoring. We never invent fake 90-day history. Days without recorded probes appear neutral grey.'
          }
        ]
      },
      {
        id: 'troubleshooting',
        title: 'Troubleshooting',
        section: 'Platform & Legal',
        description: 'Common issues and quick solutions.',
        lastModified: 'November 2026',
        headings: [
          { id: 'invite-expired', title: 'Invite link expired', level: 2 },
          { id: 'please-sign-in', title: 'Please sign in error', level: 2 }
        ],
        content: [
          {
            type: 'accordion',
            items: [
              {
                trigger: 'Why does my server say "Invite unavailable"?',
                content: 'Discord reported that your invite link was deleted, revoked, or set to expire. Go to Promote Server and paste a fresh permanent invite link.'
              },
              {
                trigger: 'Why am I seeing "Sign in to leave a review"?',
                content: 'Review submissions require a signed-in Discord account with a completed stay in that community.'
              },
              {
                trigger: 'Why did /bump say server not set up?',
                content: 'Your Discord server must be added and saved on https://connectingerlc.xyz/dashboard before it can be bumped from Discord.'
              }
            ]
          }
        ]
      },
      {
        id: 'terms',
        title: 'Terms of service',
        section: 'Platform & Legal',
        description: 'Platform terms and conditions.',
        lastModified: 'November 2026',
        headings: [
          { id: 'fair-use', title: 'Fair use policy', level: 2 }
        ],
        content: [
          {
            type: 'paragraph',
            text: 'All communities listed on ConnectingERLC must adhere to Discord Terms of Service and Community Guidelines. Fraudulent bump farming, alt raids, or abusive behavior will result in immediate blacklisting.'
          }
        ]
      },
      {
        id: 'privacy',
        title: 'Privacy policy',
        section: 'Platform & Legal',
        description: 'How your information is protected.',
        lastModified: 'November 2026',
        headings: [
          { id: 'data-collection', title: 'Data collection', level: 2 }
        ],
        content: [
          {
            type: 'paragraph',
            text: 'ConnectingERLC only stores necessary public Discord identifiers (user IDs, server IDs, avatars) to facilitate directory discovery and credit tracking. We do not sell user data.'
          }
        ]
      }
    ]
  }
];

export const ALL_DOCS_PAGES: DocPage[] = DOCS_SECTIONS.flatMap(s => s.items);

export function findDocPage(id: string): DocPage | undefined {
  return ALL_DOCS_PAGES.find(p => p.id === id);
}
