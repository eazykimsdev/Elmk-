/**
 * scripts/migrate_strip_legacy_keys.mjs
 * 
 * Migration:
 * 1. Strips all legacy keys from removed modules (tickets, shifts, applications, departments,
 *    infractions, antinuke, raid, protection, j4j, legacy sessions) from stored database/JSON objects.
 * 2. Initializes data/site_state.json with default operational state if missing.
 * 3. Removes legacy ticket files if present.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

const LEGACY_KEYS = new Set([
  'ticketCategories', 'ticketPingRoleId', 'ticketClaimRoleId', 'ticketCategoryId',
  'ticketInsideBannerUrl', 'ticketOpenMessage', 'transcriptsChannelId', 'showRulesButton',
  'rulesTitle', 'rulesDescription', 'rulesButtonLabel', 'rulesButtonStyle',
  'panelTitle', 'panelDescription', 'panelDesign', 'panelLayout', 'panelColor', 'buttonPlacement',
  'topBannerUrl', 'bottomBannerUrl', 'promoteBannerUrl', 'promotionBottomBannerUrl',
  'appTopBannerUrl', 'appBottomBannerUrl', 'infractBannerUrl', 'infractionBottomBannerUrl',
  'staffDocsTopBannerUrl', 'staffDocsBottomBannerUrl', 'deptBannerUrl', 'regulationsBannerUrl',
  'regulationsChannelId', 'infractionStaffRoleId', 'infractRemoveRoleId', 'infractGiveRoleId',
  'promotionStaffRoleId', 'promotionGiveRoleId', 'appDescription', 'appTitle', 'appQuizIntroText',
  'ingameQuestions', 'discordQuestions', 'staffDocsTitle', 'staffDocsDescription', 'staffDocsLayout',
  'applications', 'shifts', 'departments', 'infractions', 'antinuke', 'raid', 'protection',
  'sessionTopBannerUrl', 'sessionShutdownBannerUrl', 'sessionBottomBannerUrl', 'sessionVoteTopBannerUrl',
  'sessionVoteBottomBannerUrl', 'sessionChannelId', 'ingameVcId', 'queueVcId', 'notificationRoleId',
  'hostRoleId', 'sessionStartTitle', 'sessionStartDesc', 'sessionShutdownTitle', 'sessionShutdownDesc',
  'sessionQuorumVotes', 'radioFrequencies', 'staffLoaRequests', 'staffInfractions',
  'j4jEnabled', 'j4jRewardRoleId', 'j4jDailyTarget', 'j4jMinAccountAgeDays', 'j4jRequireAvatar',
  'j4jRequireEmail', 'j4jBlockChurn', 'joinCredits', 'j4jAuditLog'
]);

function stripObject(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  let modified = false;
  for (const key of Object.keys(obj)) {
    if (LEGACY_KEYS.has(key) || key.toLowerCase().includes('ticket') || key.toLowerCase().includes('insidebanner')) {
      delete obj[key];
      modified = true;
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      if (stripObject(obj[key])) modified = true;
    }
  }
  return modified;
}

export function runLegacyKeysMigration() {
  console.log('[MIGRATION] Running legacy keys cleanup migration...');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // 1. Ensure site_state.json exists with default operational state and cleanup expired windows
  const siteStateFile = path.join(DATA_DIR, 'site_state.json');
  if (!fs.existsSync(siteStateFile)) {
    const defaultSiteState = {
      maintenance: false,
      maintenance_on: false,
      mode: 'operational',
      title: '',
      message: '',
      eta: null,
      starts_at: null,
      ends_at: null,
      affectedServices: [],
      allowedUserIds: [],
      updated_at: new Date().toISOString(),
      updated_by: 'System Migration'
    };
    fs.writeFileSync(siteStateFile, JSON.stringify(defaultSiteState, null, 2), 'utf8');
    console.log('[MIGRATION] Created default data/site_state.json');
  } else {
    try {
      const data = JSON.parse(fs.readFileSync(siteStateFile, 'utf8') || '{}');
      let changed = false;

      // Emergency kill switch via env var
      if (process.env.MAINTENANCE_FORCE_OFF === 'true' || process.env.MAINTENANCE_FORCE_OFF === '1') {
        data.maintenance = false;
        data.maintenance_on = false;
        data.mode = 'operational';
        data.starts_at = null;
        data.ends_at = null;
        changed = true;
      }

      // Cleanup expired or open-ended scheduled windows
      if (data.starts_at) {
        if (!data.ends_at || new Date(data.ends_at).getTime() < Date.now()) {
          data.starts_at = null;
          data.ends_at = null;
          changed = true;
        }
      }

      if (changed) {
        fs.writeFileSync(siteStateFile, JSON.stringify(data, null, 2), 'utf8');
        console.log('[MIGRATION] Normalized data/site_state.json operational state');
      }
    } catch {}
  }

  // 2. Clean bot instances
  const botDbFile = path.join(DATA_DIR, 'bot_instances.db.json');
  if (fs.existsSync(botDbFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(botDbFile, 'utf8') || '{}');
      if (stripObject(data)) {
        fs.writeFileSync(botDbFile, JSON.stringify(data, null, 2), 'utf8');
        console.log('[MIGRATION] Stripped legacy keys from bot_instances.db.json');
      }
    } catch (err) {
      console.warn('[MIGRATION] Could not process bot_instances.db.json:', err.message);
    }
  }

  const botJsonFile = path.join(DATA_DIR, 'bot_instances.json');
  if (fs.existsSync(botJsonFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(botJsonFile, 'utf8') || '{}');
      if (stripObject(data)) {
        fs.writeFileSync(botJsonFile, JSON.stringify(data, null, 2), 'utf8');
        console.log('[MIGRATION] Stripped legacy keys from bot_instances.json');
      }
    } catch (err) {
      console.warn('[MIGRATION] Could not process bot_instances.json:', err.message);
    }
  }

  // 3. Clean promoted servers
  const promotedFile = path.join(DATA_DIR, 'promoted_servers.json');
  if (fs.existsSync(promotedFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(promotedFile, 'utf8') || '{}');
      if (stripObject(data)) {
        fs.writeFileSync(promotedFile, JSON.stringify(data, null, 2), 'utf8');
        console.log('[MIGRATION] Stripped legacy keys from promoted_servers.json');
      }
    } catch (err) {
      console.warn('[MIGRATION] Could not process promoted_servers.json:', err.message);
    }
  }

  // 4. Clean user settings
  const userSettingsFile = path.join(DATA_DIR, 'user_settings.json');
  if (fs.existsSync(userSettingsFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(userSettingsFile, 'utf8') || '{}');
      if (stripObject(data)) {
        fs.writeFileSync(userSettingsFile, JSON.stringify(data, null, 2), 'utf8');
        console.log('[MIGRATION] Stripped legacy keys from user_settings.json');
      }
    } catch (err) {
      console.warn('[MIGRATION] Could not process user_settings.json:', err.message);
    }
  }

  // 5. Remove legacy ticket files
  const deadFiles = [
    path.join(DATA_DIR, 'ticket_panels.json'),
    path.join(DATA_DIR, 'tickets.json'),
    path.join(DATA_DIR, 'ticket_desk.json')
  ];
  for (const f of deadFiles) {
    if (fs.existsSync(f)) {
      try {
        fs.unlinkSync(f);
        console.log(`[MIGRATION] Deleted dead file: ${path.basename(f)}`);
      } catch {}
    }
  }

  console.log('[MIGRATION] Legacy keys migration completed successfully.');
  return { success: true, cleanedFilesCount: 4 };
}

if (process.argv[1] && process.argv[1].endsWith('migrate_strip_legacy_keys.mjs')) {
  runLegacyKeysMigration();
}
