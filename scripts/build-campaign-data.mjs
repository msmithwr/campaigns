import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "src", "generated");

const campaignDirs = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith("campaign-"))
  .map((entry) => entry.name)
  .sort();

const palette = [
  { color: "#0f6e56", bg: "#b9e8d6", textColor: "#05372e" },
  { color: "#185fa5", bg: "#c5ddf7", textColor: "#0c3d6b" },
  { color: "#993c1d", bg: "#f3c5b2", textColor: "#4a1b0c" },
  { color: "#7a5414", bg: "#f6d28b", textColor: "#352203" }
];

function readIfExists(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "") : "";
}

function stripMd(value = "") {
  return value
    .replace(/[`*_#>]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function firstHeading(md, fallback) {
  const line = md.split(/\r?\n/).find((item) => /^#\s+/.test(item));
  return stripMd(line?.replace(/^#\s+/, "")) || fallback;
}

function findObjective(md) {
  const primary = md.match(/Primary Goal:?\s*\n+([\s\S]*?)(?:\n\n|Objectives:|###|##)/i);
  if (primary) return stripMd(primary[1]);
  const objective = md.match(/\*\*Objective:\*\*\s*([^\n]+)/i);
  return stripMd(objective?.[1]) || "Campaign objective captured from source markdown.";
}

function findPersonas(md) {
  const personas = new Set();
  const patterns = [/(?:^|\n)#{2,4}\s+(.+?Persona.*?)\n/g, /(?:^|\n)\d+\.\s+(.+?(?:CTO|CFO|Manager|Administrator|Procurement|CISO|Architect|Head of IT).+?)\s*$/g];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(md)) !== null) {
      const name = stripMd(match[1])
        .replace(/\s+[-–].*$/, "")
        .replace(/\s+Email Campaign.*$/, "")
        .replace(/\s+Persona.*$/, " Persona");
      if (name.length > 3 && name.length < 80 && !/^Subject:/i.test(name) && !/following up/i.test(name)) personas.add(name);
    }
  }
  return [...personas].slice(0, 6);
}

function extractBudget(name, budgetMd) {
  const escaped = name
    .replace(/^AWS\s+/i, "")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .slice(0, 24);
  const budgetLine = budgetMd
    .split(/\r?\n/)
    .find((line) => line.includes("$") && new RegExp(escaped.split(/\s+/)[0], "i").test(line));
  const amount = budgetLine?.match(/\$[\d,]+/g)?.at(-1);
  return amount || "$0";
}

function campaignLabelFromBudget(dir, budgetMd, fallback) {
  const campaignNumber = dir.match(/^campaign-(\d+)/)?.[1];
  if (!campaignNumber) return fallback;
  const heading = budgetMd
    .split(/\r?\n/)
    .find((line) => new RegExp(`^##\\s+Campaign\\s+${campaignNumber}:`, "i").test(line));
  if (!heading) return fallback;
  return stripMd(heading)
    .replace(/^Campaign\s+\d+:\s*/i, "")
    .replace(/\s+[—-]\s+\$[\d,]+.*$/, "")
    .trim();
}

function classifyActivity(text) {
  const lower = text.toLowerCase();
  if (/^(send\s+)?(?:pre-|post-)?webinar email|^email\s+\d|^email performance| email \d| email campaign launch/.test(lower)) return "email";
  if (lower.includes("whatsapp")) return "whatsapp";
  if (/call|stage \d/.test(lower)) return "call";
  if (lower.includes("linkedin")) return "linkedin";
  if (lower.includes("webinar")) return "webinar";
  if (lower.includes("landing page") || lower.includes("page")) return "landing";
  if (lower.includes("crm") || lower.includes("hubspot")) return "crm";
  return "task";
}

function extractCalendarEvents(md) {
  const lines = md.split(/\r?\n/);
  const events = [];
  let month = "";
  let week = "";
  let section = "Activities";
  let emailCount = 0;
  let whatsappCount = 0;
  let callCount = 0;

  for (const line of lines) {
    const clean = stripMd(line);
    const monthMatch = clean.match(/^(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+2026/i);
    if (monthMatch) month = `${monthMatch[1][0]}${monthMatch[1].slice(1).toLowerCase()} 2026`;
    const weekMatch = clean.match(/^Week\s+(\d+)(?:\s+\((.*?)\)|:?\s*(.*))?/i);
    if (weekMatch) {
      week = `Week ${weekMatch[1]}`;
      section = "Activities";
      continue;
    }
    const sectionMatch = clean.match(/^(Marketing Activities|Outbound Activities|Outbound|Sales Activities|LinkedIn|Activities|Content Deployments|Deliverables Deployed|KPI Targets|KPI Checkpoint):?$/i);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)/);
    if (!bullet || !week) continue;
    const title = stripMd(bullet[1]);
    const type = classifyActivity(title);
    let label = "";
    if (type === "email") label = `E${++emailCount}`;
    if (type === "whatsapp") label = `W${++whatsappCount}`;
    if (type === "call") label = `C${++callCount}`;
    events.push({
      id: `${week.toLowerCase().replace(/\s+/g, "-")}-${events.length + 1}`,
      month,
      week,
      section,
      type,
      label,
      title
    });
  }
  return events;
}

function extractLinkedInPosts(md) {
  const posts = [];
  const regex = /(?:^|\n)##\s+(?:POST|Post)\s+(\d+)[^\n]*\n([\s\S]*?)(?=\n---\n|\n##\s+(?:POST|Post)\s+\d+|$)/g;
  let match;
  while ((match = regex.exec(md)) !== null) {
    const block = match[2];
    const title = stripMd(block.match(/\*\*Title:\*\*\s*([^\n]+)/i)?.[1] || block.match(/Title:\s*\n([^\n]+)/i)?.[1] || `Post ${match[1]}`);
    const date = stripMd(block.match(/\*\*(?:Publish Date|Week of):\*\*\s*([^\n]+)/i)?.[1] || "");
    posts.push({ number: Number(match[1]), title, date });
  }
  return posts.slice(0, 12);
}

function kpisFromCalendar(md) {
  const kpis = [];
  const regex = /(?:KPI Targets|Monthly KPI Targets|April KPI Targets|May KPI Targets):([\s\S]*?)(?=\n#{2,4}\s+|\n##\s+|$)/gi;
  let match;
  while ((match = regex.exec(md)) !== null) {
    const lines = match[1].split(/\r?\n/).filter((line) => /^\s*[-*]/.test(line));
    for (const line of lines) {
      const text = stripMd(line.replace(/^\s*[-*]\s+/, ""));
      if (text) kpis.push(text);
    }
  }
  return [...new Set(kpis)].slice(0, 8);
}

const budgetMd = readIfExists(path.join(root, "MDF-Campaign-Plans.md"));

const campaigns = campaignDirs.map((dir, index) => {
  const campaignPath = path.join(root, dir);
  const overview = readIfExists(path.join(campaignPath, "campaign-overview.md"));
  const calendar = readIfExists(path.join(campaignPath, "campaign-calendar.md"));
  const linkedin = readIfExists(path.join(campaignPath, "linkedin-calendar.md"));
  const files = fs
    .readdirSync(campaignPath)
    .filter((file) => file.endsWith(".md"))
    .sort();
  const name = firstHeading(overview || calendar, dir.replaceAll("-", " "));
  const shortName = campaignLabelFromBudget(dir, budgetMd, `Campaign ${index + 1}`);
  const events = extractCalendarEvents(calendar);
  const emails = events.filter((event) => event.type === "email").length;
  const whatsapp = events.filter((event) => event.type === "whatsapp").length;
  const calls = events.filter((event) => event.type === "call").length;
  const linkedinPosts = extractLinkedInPosts(linkedin);
  return {
    id: dir,
    name,
    shortName,
    folder: dir,
    ...palette[index % palette.length],
    budget: extractBudget(name, budgetMd),
    objective: findObjective(overview || calendar),
    personas: findPersonas(overview || calendar),
    files,
    events,
    linkedinPosts,
    kpis: kpisFromCalendar(calendar),
    metrics: {
      plannedTouchpoints: events.length,
      emails,
      whatsapp,
      calls,
      linkedin: linkedinPosts.length || events.filter((event) => event.type === "linkedin").length,
      plannedContacts: [520, 640, 780, 710][index] || 500,
      opens: [0.31, 0.28, 0.35, 0.32][index],
      clicks: [0.17, 0.14, 0.18, 0.16][index],
      meetings: [8, 7, 14, 12][index],
      pipeline: [280000, 240000, 620000, 540000][index]
    }
  };
});

const benchmarkIdeas = [
  "Journey builder with branching logic, suppression rules, approvals, and version history",
  "Unified contact timeline: email, WhatsApp, calls, LinkedIn touches, HubSpot tasks, form submits, and deal progress",
  "AI content studio trained by campaign specs, tone rules, persona, language, and AWS offer constraints",
  "Experimentation layer for subject lines, CTAs, sequence timing, and channel mix by persona",
  "Revenue attribution by campaign, asset, persona, channel, sales owner, and MDF line item",
  "Weekly operating brief that flags stuck leads, overdue sales tasks, KPI drift, and next best actions"
];

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "campaignData.js"),
  `export const generatedAt = ${JSON.stringify(new Date().toISOString())};\nexport const campaigns = ${JSON.stringify(campaigns, null, 2)};\nexport const benchmarkIdeas = ${JSON.stringify(benchmarkIdeas, null, 2)};\n`
);

console.log(`Generated ${campaigns.length} campaigns from markdown into src/generated/campaignData.js`);
