import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'data', 'promoted_servers.json');
if (fs.existsSync(file)) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let count = 0;
  if (Array.isArray(data.servers)) {
    for (const s of data.servers) {
      // If server has not explicitly configured or was defaulted to 'here'
      if (!s.hasExplicitPartnershipConfig || s.partnershipAllowedMentions === undefined || s.allowPartnerMentions === undefined) {
        s.partnershipAllowedMentions = 'none';
        s.allowPartnerMentions = false;
        s.partnershipAllowHere = false;
        count++;
      }
    }
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[MIGRATION] Reset partnership mentions to 'none' for ${count} servers.`);
  }
}

