import fs from 'fs';

let code = fs.readFileSync('api.js', 'utf8');

// Replace default parameter server names
code = code.replace(/guildName = 'Discord bot V\.2'/g, "guildName = 'Community server'");
code = code.replace(/guildId = '1530147023754367006'/g, "guildId = ''");

// Replace master owner override
code = code.replace(/const isMasterOwner = session\?\.user\?\.role === 'Owner' \|\| callerId === '523693281541095424';/g,
  "const isMasterOwner = session?.user?.role === 'Owner';");

// Remove hardcoded eazykims insertion into userMap
const hardcodedUserBlock = `    if (!userMap.has('523693281541095424')) {
      userMap.set('523693281541095424', {
        id: '523693281541095424',
        username: 'eazykims',
        globalName: 'Eazykims',
        avatar: '/brand/logo.png',
        joinedAt: '2026-10-01T00:00:00.000Z'
      });
    }`;
code = code.replace(hardcodedUserBlock, '');

// Clean review endpoint user fallback
code = code.replace(/const user = req\.dashboardSession\?\.user \|\| \{\s*id: '523693281541095424',\s*globalName: 'Eazykims',\s*username: 'eazykims',\s*avatar: null\s*\};/g,
  "const user = req.dashboardSession?.user || req.session?.user;\n    if (!user) return res.status(401).json({ error: 'Please sign in to leave a review.' });");

// Clean promote upsert user fallback
code = code.replace(/const user = req\.dashboardSession\?\.user \|\| \{ id: '523693281541095424', globalName: 'Eazykims', username: 'eazykims' \};/g,
  "const user = req.dashboardSession?.user || req.session?.user;\n      if (!user) return res.status(401).json({ error: 'Please sign in to save server settings.' });");

// Clean userProfile fallbacks in recruit endpoints
code = code.replace(/\{ id: userId, username: 'eazykims', name: 'Eazykims' \}/g,
  "{ id: userId, username: 'representative', name: 'Representative' }");

// Replace remaining '523693281541095424' fallbacks with generic/session resolution
code = code.replace(/\|\|\s*'523693281541095424'/g, "|| (req.dashboardSession?.user?.id || req.session?.user?.id)");

// Replace any leftover 'Discord bot V.2'
code = code.replace(/Discord bot V\.2/g, "ConnectingERLC Community");

fs.writeFileSync('api.js', code, 'utf8');
console.log('Successfully cleaned developer tokens from api.js');

