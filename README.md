# n8n-nodes-postel

This is an n8n community node for [Postel](https://www.postel.app). Postel finds what's going viral in your niche and turns it into your own post, in your own voice. Then it schedules or publishes it to X, LinkedIn, Bluesky and Mastodon.

Use it to turn things that happen in your other apps (a new blog post, a changelog entry, a row in your content calendar) into posts, and to start workflows when a post goes out or fails.

[Installation](#installation) · [Operations](#operations) · [Credentials](#credentials) · [Compatibility](#compatibility) · [Usage](#usage) · [Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation. The package name is `n8n-nodes-postel`.

## Operations

**Postel** node

- **Viral Post → Find**: posts and videos that took off on X, YouTube, TikTok or Instagram, from individual creators. Filter by topic, days back, minimum outlier score (X: views ÷ followers; videos: times the creator's usual), views, format (X) or length (videos).
- **Viral Post → Get**: one viral post.
- **Viral Post → Write My Take**: Postel writes your own post from a viral X post or a format, in your voice, one draft per network. 1 AI credit per network; takes 10 to 40 seconds.
- **Post → Create**: save a post as a draft, schedule it for a time, or publish it now. Optional media links (images or a video) and a LinkedIn first comment.
- **Post → Generate in My Voice**: Postel writes a post from your prompt in your own voice and saves it as a draft. Uses 1 Postel AI credit and takes 5 to 30 seconds.
- **Post → Schedule**: schedule a draft that's already in Postel.
- **Post → Publish Now**: publish a draft within a minute. The step returns at once (status `scheduled`); use the Postel Trigger to act when it is live or if it fails.
- **Post → Get** and **Get Many**: read posts, filtered by status or channel.
- **Channel → Get Many**: the networks you can post to and which are connected.

**Postel Trigger** node (polling)

- **New Viral Post in My Niche**: a post or video took off in your niche, as Postel scored it for you (Pro plan, with your niche set up in Postel). Includes how well it fits.
- **Post Published**: a post went out. Includes its link.
- **Post Failed**: a post couldn't be published. Includes the reason; Postel moves the post back to drafts.
- **Draft Ready in Review**: Postel wrote a new post for you and it's waiting in Review (Pro plan).

The first poll only remembers what's already there, so activating a workflow doesn't fire for old posts.

### Threads

On X, Bluesky and Mastodon, put a line with only `---` between the parts of a thread:

```
First post of the thread
---
Second post
```

### Plans

Saving drafts works on every Postel plan. Scheduling and publishing need a paid plan; without one, the node stops with a message that links to the billing page. If your workspace needs approval before posts go out, scheduled posts wait for an owner or admin, and Publish Now asks you to schedule instead.

## Credentials

1. In Postel, open **Settings → API keys** and create a key. It starts with `pstl_`.
2. In n8n, create a **Postel API** credential and paste the key.

The key acts for the Postel workspace it was made in. Leave **Base URL** as it is.

## Compatibility

Built and tested with n8n node API version 1 and `@n8n/node-cli` 0.54. No runtime dependencies.

## Usage

**Something takes off in your niche → your take, ready to review**

1. **Postel Trigger**, event New Viral Post in My Niche.
2. **Postel → Viral Post → Write My Take**, Write From: A Viral X Post, Viral Post ID `{{ $json.viralPost.id }}`.
3. **Slack → Send Message** with `{{ $json.post.text }}`, so you read it and schedule it in Postel.

**New blog post → a LinkedIn draft in your voice**

1. **RSS Feed Trigger** on your blog's feed.
2. **Postel → Post → Generate in My Voice**, channel LinkedIn, prompt `New post on my blog: {{ $json.title }}. {{ $json.contentSnippet }} Link: {{ $json.link }}`.
3. Open Postel, read the draft, schedule it.

**Content calendar → scheduled posts**

1. **Schedule Trigger** every morning, then **Google Sheets → Get Rows** where the date is today.
2. **Postel → Post → Create**, When: Schedule, Scheduled Time from the sheet. Dates without a timezone use the workflow's timezone.

**Post failed → email**

1. **Postel Trigger**, event Post Failed.
2. **Send Email** with `{{ $json.post.text }}` and the reason `{{ $json.post.failure.message }}`.

Errors from Postel are shown as Postel wrote them (for example "Connect LinkedIn in Postel (Settings → Channels), then run this step again."), with Postel's error code in the details.

Create and Generate in My Voice send an `Idempotency-Key` made of the execution, node and item, so n8n's "Retry On Fail" never posts twice or spends a second credit. Publish Now goes through Postel's publishing queue, so the step is quick and can't time out halfway.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Postel for Zapier, n8n and Make](https://www.postel.app/automations)
- [Postel API reference](https://www.postel.app/api/docs) (the **Public API v1** section)

## Development

```bash
npm install
npm run lint
npm run build
npm test                         # offline checks
POSTEL_TEST_URL=http://localhost:3000 POSTEL_TEST_KEY=pstl_... npm test   # also runs against a Postel API
npm run dev                      # n8n with this node loaded, at http://localhost:5678
```

Live tests create drafts and scheduled posts in the key's workspace, so use a test workspace.
