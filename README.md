# Campaign Agent

Set up and launch an event campaign by sending a chat message, instead of
clicking through a CRM, an email tool and a spreadsheet one after the other.

It runs offline out of the box. No API key, no accounts, no `npm install`:

```bash
git clone https://github.com/chamodgimhan/campaign-agent.git
cd campaign-agent
npm run demo
```

```
you > set up the campaign for the founder breakfast

[TOOL:find_event] ok
[TOOL:get_audience] ok
[TOOL:draft_campaign] ok

[CONFIRM] Send campaign cmp-1 to its recipient list
          Type "yes" to go ahead: yes

[TOOL:send_campaign] ok
[TOOL:log_campaign] ok

agent > Sent campaign cmp-1 for Founder Breakfast to 3 contacts and logged it.
```

## Why I built it

Launching a campaign for an event means the same steps every time: find the
event, pull the right people out of the CRM, set up the email, log it, then
check registrations afterwards. It is a lot of clicking for something that is
the same shape each time, and the person doing it is usually on their phone.

I wanted to see how far a chat message could get, and in particular where the
stop button belongs when software can send real email on your behalf.

## What it does

- Finds an event by name, city or tag
- Pulls the matching audience out of the CRM
- Drafts the campaign and shows a summary
- **Waits for you to type `yes`** before anything is sent or changed
- Sends it, then logs it to the tracking sheet
- Answers questions like "who is registered for scale-up night?"

## How it works

```
message ──> agent loop ──> tools ──> adapters ──> CRM / email / sheet
               ^             │
               └── result ───┘
                             │
                   writes ───┴──> confirmation gate ──> you type yes
```

The loop picks a tool, runs it, reads the result, and repeats until the job is
done. Every tool is a small function with a schema. Tools are marked read or
write, and **a write cannot run until the gate returns true** — that check sits
in the tool runner, not in the prompt, so it holds whether the model is driving
or the offline planner is.

Two planners drive the same tools:

| mode | what picks the tools | needs |
| --- | --- | --- |
| `npm run demo` | a small rule-based planner | nothing |
| `npm start` | Claude, via tool calling | `ANTHROPIC_API_KEY`, `npm install` |

Having both means the confirmation behaviour can be tested without a model in
the loop, and anyone can clone the repo and watch it work without signing up
for anything.

## Connecting real systems

Everything the agent touches goes through four adapters in `src/adapters/`:
`crm`, `marketing`, `sheet` and `events`. The mock set keeps state in memory
and resets on every run.

To connect something real — HubSpot, Mailchimp, Google Sheets, whatever you use
— write a module exporting the same functions and point the matching variable
in `.env` at it. The agent, the tools and the confirmation gate do not change.

In a real deployment the terminal loop in `src/index.js` would be replaced by a
webhook (Twilio, for example) that passes the incoming message body straight to
`runAgent()`.

## Layout

```
src/
  index.js            terminal chat loop
  agent.js            the loop; live and demo planners
  tools/index.js      tool schemas, write flags, the runner
  confirm.js          the confirmation gate
  prompt.js           shared stdin reader
  adapters/           mock CRM, email, sheet and events
  data/seed.json      made-up events and contacts
test/                 node --test
```

## Tests

```bash
npm test
```

Ten tests, no network. The ones that matter check that a declined confirmation
leaves the campaign a draft, that a decline stops the run before anything is
logged, and that errors come back as `{ error }` instead of throwing.

## Notes

All events and contacts in `src/data/seed.json` are made up, and every address
is `@example.com`. Nothing here talks to a real account.

MIT licensed.
