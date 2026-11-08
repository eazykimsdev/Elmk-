const fs = require('fs');
let content = fs.readFileSync('src/pages/AdminPortalPage.tsx', 'utf8');

const regex = /<select\s+value=\{editingServer\.category \|\| 'Roleplay Server'\}[\s\S]*?<\/select>/;

const replacement = `<Select
                                    value={editingServer.category || 'Roleplay Server'}
                                    onValueChange={(val) => setEditingServer({ ...editingServer, category: val })}
                                  >
                                    <SelectTrigger className="w-full bg-[#18181b] border-white/10 text-xs h-9 text-zinc-200">
                                      <SelectValue placeholder="Select Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {DIRECTORY_CATEGORIES.map((cat) => (
                                        <SelectItem key={cat} value={cat}>
                                          {cat}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>`;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync('src/pages/AdminPortalPage.tsx', content, 'utf8');
  console.log('Replaced AdminPortalPage select successfully!');
} else {
  console.error('Regex did not match!');
}

