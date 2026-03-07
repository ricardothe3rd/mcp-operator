export interface KnowledgeEntry {
  id: string;
  title: string;
  keywords: string[];
  content: string;
}

// Static knowledge base — no external API needed.
// Injected into the system prompt when relevant to the user's message.
export const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    id: "what-is-mcp-agent",
    title: "What is MCP Operator?",
    keywords: ["what", "mcp", "agent", "does", "explain", "overview", "how", "work"],
    content: `MCP Operator is an autonomous AI agent platform. You describe what you want automated in plain language, connect your tools (Discord, Slack, GitHub, Google Sheets, etc.), and the agent runs automatically on a schedule — no code, no workflow builders.

Key concepts:
- Jobs: each automation task you define. A job has a mission (what the agent does), an interval (how often), and a list of connected integrations.
- The agent reads its recent run history before each run so it can learn and self-correct.
- Integrations: third-party services the agent can read from or post to.
- Logs: every action the agent takes is logged with a timestamp and result.`,
  },

  {
    id: "jobs",
    title: "How Jobs Work",
    keywords: ["job", "jobs", "create", "run", "schedule", "interval", "auto", "mission", "task", "automation"],
    content: `A Job is one automation. Each job has:
- Name: a label for the job
- Mission: plain-English description of what the agent should do each run (e.g. "Check for new GitHub PRs and post a summary to Discord")
- Interval: how often to run (in minutes). Set to 0 to disable auto-run.
- Integrations: which services the agent can use for this job

To create a job: go to the Jobs tab on the dashboard → click "+ New Job" → fill in name, mission, interval.

To run a job manually: click the Play button on the job card. The agent runs immediately and logs the result.

To stop auto-run: click the Stop button or set the interval to 0.

The agent sees the last 5 run results before each run so it can build on previous work.`,
  },

  {
    id: "discord",
    title: "Connecting Discord",
    keywords: ["discord", "webhook", "channel", "message", "notify", "notification", "post"],
    content: `To connect Discord:
1. Open Discord → go to your server → pick a channel
2. Click the gear icon (Edit Channel) → Integrations → Webhooks → New Webhook
3. Copy the webhook URL
4. In MCP Operator: go to Settings → paste the URL in "Discord Webhook URL" → Save

What the agent can do with Discord:
- Post a message to a channel (e.g. "New PR opened: title, author, link")
- Send summaries, alerts, daily digests

Tip: Use different webhook URLs for different channels to separate notifications.`,
  },

  {
    id: "slack",
    title: "Connecting Slack",
    keywords: ["slack", "webhook", "channel", "message", "notify", "notification", "post"],
    content: `To connect Slack:
1. Go to api.slack.com/apps → Create an App → Incoming Webhooks → Activate
2. Click "Add New Webhook to Workspace" → pick a channel → copy the webhook URL
3. In MCP Operator: go to Settings → paste the URL in "Slack Webhook URL" → Save

What the agent can do with Slack:
- Post messages to a Slack channel
- Send summaries, alerts, status updates`,
  },

  {
    id: "github",
    title: "Connecting GitHub",
    keywords: ["github", "git", "repo", "repository", "pr", "pull request", "issue", "token", "commit", "push", "event"],
    content: `To connect GitHub:
1. GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
2. Generate a token with scopes: repo, read:user
3. In MCP Operator: go to Settings → paste token in "GitHub Token" + enter your repo (owner/repo format) → Save

What the agent can do with GitHub:
- Get open/closed pull requests from a repo
- Get recent repository events (pushes, forks, stars)
- Create issues in a repo
- Comment on pull requests

Example mission: "Every hour, check for new open PRs in my repo and post a summary to Discord."`,
  },

  {
    id: "google-sheets",
    title: "Connecting Google Sheets",
    keywords: ["google", "sheets", "spreadsheet", "row", "append", "log", "table", "data", "write"],
    content: `To connect Google Sheets:
1. Go to console.cloud.google.com → Enable the Google Sheets API
2. Create an API Key (or use a Service Account for write access)
3. In MCP Operator: Settings → paste the API Key + your Spreadsheet ID

Spreadsheet ID: found in the URL — docs.google.com/spreadsheets/d/[THIS_IS_THE_ID]/edit

What the agent can do with Google Sheets:
- Append a new row (e.g. log an event, record a sale, track activity)
- Read values from a range

Example mission: "Every time a GitHub PR is merged, log the PR title, author, and timestamp to my Google Sheet."`,
  },

  {
    id: "airtable",
    title: "Connecting Airtable",
    keywords: ["airtable", "base", "table", "record", "row", "database", "crm"],
    content: `To connect Airtable:
1. Go to airtable.com/create/tokens → Create a personal access token
2. Scope needed: data.records:read, data.records:write
3. Copy your Base ID from the URL: airtable.com/[BASE_ID]/...
4. In MCP Operator: Settings → paste API Key + Base ID

What the agent can do with Airtable:
- Read records from a table
- Create new records
- Update existing records

Example mission: "Every morning, check my Airtable CRM for leads added in the last 24h and post a summary to Slack."`,
  },

  {
    id: "notion",
    title: "Connecting Notion",
    keywords: ["notion", "page", "database", "block", "note", "wiki", "doc"],
    content: `To connect Notion:
1. Go to notion.so/my-integrations → New integration → copy the Internal Integration Token
2. Open the Notion page/database you want the agent to access → Share → invite your integration
3. In MCP Operator: Settings → paste the token in "Notion API Key"

What the agent can do with Notion:
- Search pages and databases
- Create new pages
- Append content to existing pages

Example mission: "Every day, create a Notion page summarising yesterday's GitHub activity."`,
  },

  {
    id: "sendgrid",
    title: "Connecting SendGrid (Email)",
    keywords: ["sendgrid", "email", "send", "mail", "smtp", "newsletter"],
    content: `To connect SendGrid:
1. Sign up at sendgrid.com → Settings → API Keys → Create API Key (Full Access)
2. In MCP Operator: Settings → paste the key in "SendGrid API Key"

What the agent can do with SendGrid:
- Send transactional emails to any address
- Send digests, alerts, summaries via email

Example mission: "Every Monday, email me a summary of all open GitHub issues."`,
  },

  {
    id: "hubspot",
    title: "Connecting HubSpot",
    keywords: ["hubspot", "crm", "contact", "deal", "lead", "sales", "pipeline"],
    content: `To connect HubSpot:
1. In HubSpot: Settings → Integrations → Private Apps → Create a private app
2. Scopes: crm.objects.contacts.read, crm.objects.contacts.write, crm.objects.deals.read
3. Copy the Access Token
4. In MCP Operator: Settings → paste in "HubSpot API Key"

What the agent can do with HubSpot:
- Search and read contacts
- Create new contacts
- Get recent deals

Example mission: "Every day, check for new HubSpot contacts added in the last 24h and notify the team on Slack."`,
  },

  {
    id: "stripe",
    title: "Connecting Stripe",
    keywords: ["stripe", "payment", "charge", "subscription", "revenue", "billing", "invoice"],
    content: `To connect Stripe:
1. Go to dashboard.stripe.com → Developers → API Keys
2. Copy the Secret Key (starts with sk_)
3. In MCP Operator: Settings → paste in "Stripe API Key"

What the agent can do with Stripe:
- Get recent charges and payments
- Monitor subscription events
- Get invoice data

Example mission: "Every hour, check for new Stripe payments and log them to Google Sheets."`,
  },

  {
    id: "ai-providers",
    title: "AI Providers (Groq, Ollama, and others)",
    keywords: ["ai", "provider", "groq", "ollama", "openai", "anthropic", "gemini", "google", "model", "key", "api key", "llm", "free"],
    content: `MCP Operator supports multiple AI providers. You can switch in Settings → AI Provider.

Recommended free options:
- Groq: Free API key at console.groq.com. Uses llama-3.3-70b-versatile. Fast, generous free tier, great for tool use.
- Ollama: Fully local, zero cost, no API key needed. Install from ollama.com, then run: ollama pull llama3.2. Set provider to Ollama in Settings.

Paid options:
- Google Gemini: gemini-2.0-flash. Get key at aistudio.google.com.
- OpenAI: gpt-4o-mini. Get key at platform.openai.com.
- Anthropic: claude-haiku. Get key at console.anthropic.com.

The AI provider is used for: the chat assistant in the dashboard AND the agent that runs your jobs.`,
  },

  {
    id: "webhook-trigger",
    title: "Triggering the Agent via Webhook",
    keywords: ["webhook", "trigger", "curl", "http", "post", "inbound", "event", "real-time", "realtime", "instant"],
    content: `You can trigger any job instantly via an inbound webhook — no waiting for the cron timer.

Endpoint: POST /api/webhook/trigger

Headers required:
- Content-Type: application/json
- Authorization: Bearer YOUR_WEBHOOK_SECRET

Body:
{
  "jobId": "your-job-id",
  "trigger": "github_push",
  "payload": { ...any event data }
}

Example curl:
curl -X POST https://your-app/api/webhook/trigger \\
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{"jobId":"abc123","trigger":"github_push","payload":{"repo":"myrepo","pusher":"alice"}}'

The WEBHOOK_SECRET is set in your .env.local file.
The job runs immediately and logs the result.`,
  },

  {
    id: "troubleshooting",
    title: "Troubleshooting Common Issues",
    keywords: ["error", "fail", "broken", "not working", "problem", "issue", "fix", "debug", "quota", "rate limit"],
    content: `Common issues and fixes:

"You exceeded your current quota" (Google Gemini)
→ Switch to Groq (free, console.groq.com) or Ollama (local, free)

Agent runs but nothing happens
→ Check that the integration credential is saved in Settings
→ Check the Logs tab for the error message
→ Make sure the mission clearly says which tool to use (e.g. "post to Discord")

Job keeps failing 3 times
→ An alert is sent to Discord/Slack if those are connected
→ Check Logs for the actual error
→ Most common: expired API key, wrong webhook URL, missing permissions

Auth errors (MissingSecret)
→ Add AUTH_SECRET to your .env.local file
→ Run: openssl rand -base64 32 to generate one

Ollama not connecting
→ Make sure Ollama is running: ollama serve
→ Default URL is http://localhost:11434
→ Pull the model first: ollama pull llama3.2`,
  },

  {
    id: "demo-flow",
    title: "Demo Flow",
    keywords: ["demo", "show", "present", "example", "showcase"],
    content: `The recommended demo flow for MCP Operator (2 minutes):

1. Sign in → land on dashboard
2. Show the Jobs tab — a pre-created job with a clear mission
3. Click "Run Now" — watch the agent log steps in real time
4. Show the Logs tab — see the result of what it did
5. Open Discord/Slack — show the notification that arrived
6. (Optional) Fire a webhook from terminal: curl POST /api/webhook/trigger
7. Show Settings — all integrations connected with masked keys
8. "Event arrives. Agent thinks. Systems update. No prompt. No human."`,
  },
];

/**
 * Returns entries whose keywords overlap with words in the user message.
 * Simple bag-of-words match — no external dependency.
 */
export function searchKnowledge(query: string, topK = 3): KnowledgeEntry[] {
  const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);

  const scored = KNOWLEDGE_BASE.map((entry) => {
    const hits = entry.keywords.filter((kw) =>
      words.some((w) => w.includes(kw) || kw.includes(w))
    ).length;
    return { entry, hits };
  });

  return scored
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, topK)
    .map((s) => s.entry);
}

/**
 * Formats matched knowledge entries as a context block for the system prompt.
 */
export function buildKnowledgeContext(query: string): string {
  const matches = searchKnowledge(query);
  if (matches.length === 0) return "";

  return (
    "\n\n--- Relevant knowledge ---\n" +
    matches.map((e) => `## ${e.title}\n${e.content}`).join("\n\n") +
    "\n--- End knowledge ---"
  );
}
