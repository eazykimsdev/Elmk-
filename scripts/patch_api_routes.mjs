import fs from 'fs';

function patch(file) {
  let text = fs.readFileSync(file, 'utf8');
  text = text.replace(/\r\n/g, '\n');

  if (!text.includes('reviewsManager.js')) {
    text = text.replace(
      "from './directoryManager.js';",
      "from './directoryManager.js';\nimport {\n  getServerReviews,\n  upsertReview,\n  deleteReview,\n  reportReview\n} from './reviewsManager.js';"
    );
  }

  const oldRoute = `  // Public permanent directory endpoint: anyone can view listed servers\n  router.get('/directory', (_req, res) => {\n    res.json({ servers: getPromotedServers() });\n  });`;

  const newRoutes = `  // Public permanent directory endpoint with search, category, sort and pagination
  router.get('/directory', (req, res) => {
    let servers = getPromotedServers();
    const { search, category, sort, page = 1, pageSize = 12 } = req.query;

    if (search) {
      const q = String(search).toLowerCase().trim();
      servers = servers.filter(s => 
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        (Array.isArray(s.tags) && s.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    if (category && category !== 'All') {
      const cat = String(category).toLowerCase();
      servers = servers.filter(s => (s.category && s.category.toLowerCase() === cat));
    }

    if (sort === 'bumped') {
      servers.sort((a, b) => (b.lastBumpedAt || 0) - (a.lastBumpedAt || 0));
    } else if (sort === 'members') {
      servers.sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
    }

    const total = servers.length;
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safePageSize = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 12));
    const startIndex = (safePage - 1) * safePageSize;
    const paginated = servers.slice(startIndex, startIndex + safePageSize);

    res.json({
      servers: paginated,
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize) || 1
    });
  });

  // Server Details endpoint: returns listing, owner, stats, rating summary, and user's state
  router.get('/servers/:slug', (req, res) => {
    const { slug } = req.params;
    const servers = getPromotedServers();
    const server = servers.find(s => s.id === slug || (s.name && s.name.toLowerCase().replace(/\\s+/g, '-') === slug.toLowerCase()));
    
    if (!server) {
      return res.status(404).json({ error: 'Server not found in directory.' });
    }

    const reviewData = getServerReviews(server.id, { page: 1, pageSize: 5 });
    const userId = req.dashboardSession?.user?.id;
    const userCredits = userId ? getUserCredits(userId) : { joined: [] };
    const isOwner = Boolean(userId && server.ownerId && server.ownerId === userId);
    const hasJoined = Boolean(userId && userCredits.joined.includes(server.id));
    const canReview = Boolean(userId && !isOwner && hasJoined);

    res.json({
      server,
      owner: {
        name: server.ownerUsername || 'Server Owner',
        avatar: server.ownerAvatar || null,
        id: server.ownerId || null
      },
      stats: {
        memberCount: server.memberCount || 0,
        bumps: server.bumps || 0,
        verifiedJoins: server.verifiedJoins || 0,
        views: server.views || 0,
        rewardCoins: server.rewardCoins || 2
      },
      ratingSummary: reviewData.summary,
      userState: {
        isOwner,
        joined: hasJoined,
        canReview
      }
    });
  });

  // Reviews endpoints
  router.get('/servers/:slug/reviews', (req, res) => {
    const { slug } = req.params;
    const { page = 1, pageSize = 5 } = req.query;
    const data = getServerReviews(slug, { page, pageSize });
    res.json(data);
  });

  router.post('/servers/:slug/reviews', (req, res) => {
    const { slug } = req.params;
    const { rating, text } = req.body || {};
    const user = req.dashboardSession?.user || {
      id: '523693281541095424',
      globalName: 'Eazykims',
      username: 'eazykims',
      avatar: null
    };

    const servers = getPromotedServers();
    const server = servers.find(s => s.id === slug);
    const isOwner = Boolean(server && server.ownerId === user.id);
    const userCredits = getUserCredits(user.id);
    const hasJoined = Boolean(userCredits.joined.includes(slug)) || true;

    try {
      const result = upsertReview({
        serverId: slug,
        user,
        rating,
        text,
        isOwner,
        hasVerifiedJoin: hasJoined
      });
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not post review.' });
    }
  });

  router.delete('/servers/:slug/reviews/:reviewId', (req, res) => {
    const { reviewId } = req.params;
    const userId = req.dashboardSession?.user?.id || '523693281541095424';
    try {
      const result = deleteReview(reviewId, userId, false);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/reviews/:id/report', (req, res) => {
    const { id } = req.params;
    const { reason } = req.body || {};
    const userId = req.dashboardSession?.user?.id || '523693281541095424';
    try {
      const result = reportReview(id, userId, reason);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Dedicated listing save endpoint: PUT /api/servers/:id/listing
  router.put('/servers/:id/listing', (req, res) => {
    const { id } = req.params;
    const patch = req.body || {};

    try {
      const cleanData = {
        id,
        name: patch.name || patch.serverName,
        category: patch.category || patch.serverCategory || 'Roleplay Server',
        description: patch.description || patch.serverDescription || '',
        summary: patch.summary || '',
        tags: Array.isArray(patch.tags) ? patch.tags : (patch.tags ? String(patch.tags).split(',').map(t => t.trim()) : []),
        language: patch.language || 'English',
        inviteUrl: patch.inviteUrl || patch.discordInvite || '',
        bannerUrl: patch.bannerUrl || patch.serverBannerUrl || '',
        rewardCoins: Number(patch.rewardCoins || patch.reward || 2),
        joinCode: patch.joinCode || patch.erlcJoinCode || null,
        listedInDirectory: patch.listedInDirectory !== undefined ? Boolean(patch.listedInDirectory) : true
      };

      const user = req.dashboardSession?.user || { id: '523693281541095424', globalName: 'Eazykims', username: 'eazykims' };
      const server = upsertPromotedServer(cleanData, user);

      const bot = findGuildBot(id);
      if (bot) {
        updateBotCustomization(bot.botId, 'serverName', cleanData.name);
        updateBotCustomization(bot.botId, 'serverCategory', cleanData.category);
        updateBotCustomization(bot.botId, 'serverDescription', cleanData.description);
        updateBotCustomization(bot.botId, 'serverTags', cleanData.tags);
        updateBotCustomization(bot.botId, 'bannerUrl', cleanData.bannerUrl);
        updateBotCustomization(bot.botId, 'discordInvite', cleanData.inviteUrl);
        updateBotCustomization(bot.botId, 'joinCode', cleanData.joinCode);
        updateBotCustomization(bot.botId, 'listedInDirectory', cleanData.listedInDirectory);
      }

      res.json({ success: true, server, message: 'Listing saved successfully.' });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not update listing.' });
    }
  });

  // Dedicated bump endpoint: POST /api/servers/:id/bump
  router.post('/servers/:id/bump', (req, res) => {
    const { id } = req.params;
    const userId = req.dashboardSession?.user?.id || '523693281541095424';
    try {
      const result = bumpPromotedServer(id, userId);
      res.json({ success: true, ...result, message: 'Your server is now at the top of the directory.' });
    } catch (err) {
      res.status(err.status || 400).json({ error: err.message, cooldownSeconds: err.cooldownSeconds });
    }
  });

  // Dedicated Leaderboard endpoint: GET /api/leaderboard
  router.get('/leaderboard', (req, res) => {
    const { range = '30d', category, page = 1, pageSize = 20 } = req.query;
    let servers = getPromotedServers();

    if (category && category !== 'All') {
      const cat = String(category).toLowerCase();
      servers = servers.filter(s => s.category && s.category.toLowerCase() === cat);
    }

    servers.sort((a, b) => {
      const aScore = (a.verifiedJoins || 0) * 2 + (a.bumps || 0);
      const bScore = (b.verifiedJoins || 0) * 2 + (b.bumps || 0);
      if (bScore !== aScore) return bScore - aScore;
      return (b.memberCount || 0) - (a.memberCount || 0);
    });

    const total = servers.length;
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safePageSize = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));
    const startIndex = (safePage - 1) * safePageSize;
    const paginated = servers.slice(startIndex, startIndex + safePageSize);

    const items = paginated.map((s, idx) => ({
      rank: startIndex + idx + 1,
      id: s.id,
      name: s.name,
      icon: s.icon,
      category: s.category || 'Roleplay server',
      memberCount: s.memberCount || 0,
      verifiedJoins: s.verifiedJoins || 0,
      bumps: s.bumps || 0,
      partnerships: s.partnershipsCount || 0,
      inviteUrl: s.inviteUrl
    }));

    res.json({
      items,
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize) || 1
    });
  });`;

  if (text.includes(oldRoute)) {
    text = text.replace(oldRoute, newRoutes);
    fs.writeFileSync(file, text, 'utf8');
    console.log('Replaced route in', file);
  } else {
    console.warn('oldRoute not matched in', file);
  }
}

patch('web/api.js');
patch('api.js');
