# ChatGPT Apps Development Guidelines

> Based on OpenAI's official guidance: [What makes a great ChatGPT app](https://developers.openai.com/blog/what-makes-a-great-chatgpt-app/)

---

## 1. Understanding What a ChatGPT App Is

### Mindset Shift

| Traditional App | ChatGPT App |
|-----------------|-------------|
| Users "open" your app and land on a home page | Users are mid-conversation; your app enters at a specific moment |
| You own the screen | You're a **capability** the model can call |
| Full navigation hierarchy | Compact, well-defined toolkit |
| Destination-based | Context-based |

### Definition

> **A ChatGPT app is a set of well-defined tools that can perform tasks, trigger interactions, or access data.**

### Key Implications

- You don't need to port every feature
- You don't need a full navigation hierarchy
- You **do** need a clear, compact API: a handful of operations that are easy to invoke and easy to build on

---

## 2. The Three Ways to Add Real Value

Every app idea should pass this filter—ask yourself which of these your app enables:

### Know — New Context or Data
Your app makes new information available:
- Live prices, availability, inventory
- Internal metrics, logs, analytics
- Specialized or subscription-gated datasets
- User-specific data (accounts, history, preferences)
- Sensor data, live streams

### Do — Real Actions
Your app takes actions on the user's behalf:
- Create or update records in internal tools
- Send messages, tickets, approvals, notifications
- Schedule, book, order, or configure things
- Trigger workflows (deploy, escalate, sync data)
- Maintain stateful game logic, track progress, enforce rules

### Show — Better Presentation
Your app presents information in a GUI that makes it more digestible or actionable:
- Shortlists, comparisons, rankings
- Tables, timelines, charts
- Role-specific or decision-specific summaries
- Visual views of game state (boards, inventories, scores)

> ⚠️ **If your app doesn't clearly improve at least one of Know/Do/Show, it likely won't feel valuable beyond what users can already do in ChatGPT.**

---

## 3. Capability Selection: Don't Port Your Product

### The Process

1. **List core jobs-to-be-done** — What outcomes do users accomplish with your product?
   - Help someone choose a home
   - Turn raw data into a clear, shareable report
   - Translate intent into a delightful discovery experience

2. **For each job, ask:** "Without an app, what can't the user do within a ChatGPT conversation?"
   - Access live or private data?
   - Take real actions in our systems?
   - Get structured or visual output?

3. **Turn gaps into clearly named operations:**

```
search_properties        → Return a structured list of candidate homes
explain_metric_change    → Fetch relevant data and summarize likely drivers
generate_campaign_variants → Create multiple ad variants with metadata
create_support_ticket    → Open a ticket and return a summary + link
```

### Capability Design Principles

| ✅ Do | ❌ Don't |
|-------|----------|
| Concrete enough for the model to choose confidently | Vague, catch-all operations |
| Simple enough to mix with other conversation steps | Complex multi-step pipelines in one call |
| Directly tied to user value | Mapped to your entire product feature set |

---

## 4. Design for Conversation & Discovery

### Handling Different Intent Types

#### Vague Intent
> "Help me figure out where to live."

**Best practice:**
- Use relevant context already in the thread
- Ask **one or two** clarifying questions at most
- Produce something concrete quickly (e.g., a few example cities with short explanations)
- User should feel progress has started, not dropped into a multi-step onboarding flow

#### Specific Intent
> "Find 3-bedroom homes in Seattle under $1.2M near well-rated elementary schools."

**Best practice:**
- Don't ask the user to repeat themselves
- Parse the query → call the right capabilities → return focused results
- Offer refinements as **optional tuning**, not required setup

#### No Brand Awareness (Cold Start)

Your first response should:
1. Explain your app's role in one line  
   *"I pull live listings and school ratings so you can compare options."*
2. Deliver useful output right away
3. Offer a clear next step  
   *"Ask me to narrow by commute, neighborhood, or budget."*

---

## 5. Build for the Model AND the User

You're designing for **two audiences**: the human in the chat, and the model runtime that decides when/how to call your app.

### Model-Friendly Design

| Principle | Implementation |
|-----------|----------------|
| **Clear, descriptive actions** | Use straightforward names: `search_jobs`, `get_rate_quote`, `create_ticket` |
| **Unambiguous parameters** | Spell out required vs. optional; document formatting |
| **Predictable, structured outputs** | Stable schemas, include IDs, clear field names |
| **Brief + machine-friendly** | Pair a summary with a structured list |

**Example output pattern:**
```json
{
  "summary": "Three options that match your budget and commute time",
  "results": [
    {"id": "...", "address": "...", "price": 950000, "commute_minutes": 25, "school_rating": 8.5, "url": "..."},
    ...
  ]
}
```

### Privacy by Design

- Only require fields you truly need
- Avoid "blob" params that scoop up extra context
- **Never** use instructions like "just send the whole conversation"
- Skip sensitive internals; redact or aggregate when full fidelity isn't necessary
- Be explicit about what you collect and why

---

## 6. Design for an Ecosystem

Your app is rarely the only one in play. The model might call multiple apps in the same conversation.

### Practical Consequences

| ✅ Do | ❌ Don't |
|-------|----------|
| Keep actions **small and focused**: `search_candidates`, `score_candidates`, `send_outreach` | Create monolithic `run_full_recruiting_pipeline` |
| Make outputs **easy to pass along**: stable IDs, clear field names, consistent structures | Hide important info only in free-form text |
| Do your part and hand control back | Build long, tunnel-like flows |

---

## 7. Pre-Launch Checklist

### 1. New Powers
- [ ] Does your app clearly **know**, **do**, or **show** new things?
- [ ] Would users notice if it stopped working?

### 2. Focused Surface
- [ ] Have you picked a **small set** of capabilities (not cloning your entire product)?
- [ ] Are capabilities named/scoped to map cleanly to real jobs-to-be-done?

### 3. First Interaction
- [ ] Does your app handle both vague and specific prompts gracefully?
- [ ] Can a new user understand your role from the first meaningful response?
- [ ] Do they see value on the **first turn**?

### 4. Model-Friendliness
- [ ] Are actions and parameters clear and unambiguous?
- [ ] Are outputs structured and consistent enough to chain and reuse?

### 5. Evaluation
- [ ] Do you have a test set with positive, negative, and edge cases?
- [ ] Can you measure win rate vs. ChatGPT's answer without the app?

### 6. Ecosystem Fit
- [ ] Can other apps/users reasonably build on your output?
- [ ] Are you comfortable being one link in a multi-app chain?

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│                  CHATGPT APP DESIGN                         │
├─────────────────────────────────────────────────────────────┤
│  VALUE = Know + Do + Show                                   │
│                                                             │
│  CAPABILITIES:                                              │
│    • Few, focused operations (not feature parity)           │
│    • Clear names mapping to jobs-to-be-done                 │
│    • Concrete enough for model to choose confidently        │
│                                                             │
│  CONVERSATION:                                              │
│    • Progress on first turn (don't over-ask)                │
│    • Handle vague AND specific intent                       │
│    • Explain yourself if user doesn't know you              │
│                                                             │
│  MODEL-FRIENDLY:                                            │
│    • Structured, stable outputs with IDs                    │
│    • Minimal, well-documented parameters                    │
│    • Privacy by design                                      │
│                                                             │
│  ECOSYSTEM:                                                 │
│    • Small actions, easy to chain                           │
│    • Hand control back to conversation                      │
└─────────────────────────────────────────────────────────────┘
```

---

*Source: [OpenAI Developers Blog](https://developers.openai.com/blog/what-makes-a-great-chatgpt-app/) • See also: [Apps SDK Quickstart](https://developers.openai.com/apps-sdk/quickstart) | [Developer Docs](https://developers.openai.com/apps-sdk)*