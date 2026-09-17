import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import {
  EMBEDDING_MODEL,
  buildClassificationDocument,
  classifyPost,
  classifyText,
  warmupClassifier,
} from "../src/classifier.js";
import { DEMO_POSTS } from "../src/fixtures.js";
import { topLeads, type MentionRecord } from "../src/store.js";

describe("shipped local-transformer classifyText", () => {
  it("uses BGE-small, not MiniLM or an LLM", () => {
    assert.match(EMBEDDING_MODEL, /bge-small-en-v1\.5/);
    assert.doesNotMatch(EMBEDDING_MODEL, /MiniLM|gpt|llama/i);
  });

  before(async () => {
    await warmupClassifier();
  });

  it("maps representative builder / help / scaffold / noise texts to expected buckets", async () => {
    const results = [];
    for (const post of DEMO_POSTS) {
      const doc = buildClassificationDocument({
        text: post.text,
        authorUsername: post.authorUsername,
        authorBio: post.authorBio,
      });
      const c = await classifyText(doc);
      results.push({ post, c });
      const allowed = Array.isArray(post.expectedPrimary)
        ? post.expectedPrimary
        : [post.expectedPrimary];
      assert.ok(
        allowed.includes(c.primary),
        `${post.authorUsername}: expected one of ${allowed.join("|")}, got ${c.primary} (scores=${JSON.stringify(c.scores)})`,
      );
      if (post.id === "demo-1") {
        assert.notEqual(c.primary, "pad_migrating_or_exploring");
        assert.notEqual(c.primary, "noise_retail_hype");
      }
    }

    const noise = results.find((r) => r.post.id === "demo-2")!;
    const builder = results.find((r) => r.post.id === "demo-1")!;
    const help = results.find((r) => r.post.id === "demo-3")!;
    const scaffold = results.find((r) => r.post.id === "demo-4")!;

    assert.equal(noise.c.suppressed, true);
    assert.equal(noise.c.leadScore, 0);

    for (const r of [builder, help, scaffold]) {
      assert.equal(r.c.suppressed, false);
      assert.ok(r.c.leadScore > 0, `${r.post.authorUsername} should have leadScore > 0`);
      assert.ok(
        r.c.leadScore > noise.c.leadScore,
        `${r.post.authorUsername} lead must outrank noise`,
      );
    }
  });

  it("ranks high-intent leads above suppressed noise via topLeads", async () => {
    const mentions: MentionRecord[] = [];
    for (const post of DEMO_POSTS) {
      const classification = await classifyText(
        buildClassificationDocument({
          text: post.text,
          authorUsername: post.authorUsername,
          authorBio: post.authorBio,
        }),
      );
      mentions.push({
        id: post.id,
        text: post.text,
        url: `https://x.com/${post.authorUsername}/status/${post.id}`,
        queryId: "test",
        author: { id: post.id, username: post.authorUsername, bio: post.authorBio },
        classification,
        scannedAt: new Date().toISOString(),
      });
    }

    const leads = topLeads(mentions, 10);
    assert.ok(leads.length >= 3);
    assert.ok(leads.every((l) => !l.classification.suppressed));
    assert.ok(!leads.some((l) => l.author?.username === "degenxyz"));
    assert.ok(leads.some((l) => l.author?.username === "launch_founder"));
    assert.ok(leads.some((l) => l.author?.username === "pad_builder"));
    assert.ok(leads.some((l) => l.author?.username === "rwa_dev"));

    for (let i = 1; i < leads.length; i++) {
      assert.ok(
        leads[i - 1]!.classification.leadScore >= leads[i]!.classification.leadScore,
        "leads must be sorted by leadScore desc",
      );
    }
  });

  it("gates tech-word shill and OOD as noise, keeps real builder signal", async () => {
    const traps = [
      "DBC coin about to explode, Meteora DBC 100x, ape in",
      "Just found the Meteora SDK lmao this token is going to 50x",
      "Best launchpad on solana?? MET pumps hard after every DBC launch",
      "chart looking juicy, meteora szn incoming, points when ser",
      "Ethereum gas is high again, L2s are the only way",
    ];
    for (const text of traps) {
      const c = await classifyText(buildClassificationDocument({ text }));
      assert.equal(
        c.primary,
        "noise_retail_hype",
        `trap should gate: "${text}" → ${c.primary} signal=${c.signalScore.toFixed(3)} noise=${c.noiseScore.toFixed(3)}`,
      );
      assert.equal(c.suppressed, true);
      assert.equal(c.leadScore, 0);
      assert.equal(c.gatedAsNoise, true);
    }

    const builder = await classifyText(
      buildClassificationDocument({
        text: "Anyone have experience integrating @MeteoraAG Dynamic Bonding Curve? Looking for partner config help for our launchpad.",
        authorBio: "Founder @NewPad",
      }),
    );
    assert.equal(builder.primary, "pad_migrating_or_exploring");
    assert.equal(builder.gatedAsNoise, false);
    assert.ok(builder.signalScore > builder.noiseScore);
  });

  it("classifyPost routes official handles to their own lane regardless of content", async () => {
    const official = await classifyPost({
      text: "meteora dbc docs! new features shipping",
      authorUsername: "MeteoraEco",
    });
    assert.equal(official.primary, "official_meteora");
    assert.equal(official.leadScore, 0);
    assert.equal(official.suppressed, false);
    assert.equal(official.gatedAsNoise, false);

    // same text from a community account stays semantic
    const community = await classifyPost({
      text: "meteora dbc docs! new features shipping",
      authorUsername: "some_builder",
    });
    assert.notEqual(community.primary, "official_meteora");

    // official bucket never wins embeddings (override-only)
    const announcement = await classifyText(
      buildClassificationDocument({ text: "Meteora announcement: new DBC features live" }),
    );
    assert.notEqual(announcement.primary, "official_meteora");
  });

  it("separates ecosystem pad drama from competitor pain", async () => {
    const drama = await classifyText(
      buildClassificationDocument({
        text: "Ember Curve graduations keep getting sniped — even the DBC pads have this problem now",
      }),
    );
    assert.equal(drama.primary, "pad_ecosystem_drama");
    assert.equal(drama.gatedAsNoise, false);

    const competitor = await classifyText(
      buildClassificationDocument({
        text: "Another pump.fun graduation sniped to zero. These pads have no locked LP story.",
      }),
    );
    assert.equal(competitor.primary, "competitor_pain");
  });

  it("competitor-pain and thin SDK paraphrases clear the noise gate", async () => {
    const pain = await classifyText(
      buildClassificationDocument({
        text: "Another pump.fun graduation sniped to zero. These pads have no locked LP story.",
      }),
    );
    assert.equal(pain.primary, "competitor_pain");
    assert.equal(pain.gatedAsNoise, false);
    assert.ok(
      pain.signalScore - pain.noiseScore >= 0.05,
      `pain gate too tight: sig=${pain.signalScore.toFixed(3)} noi=${pain.noiseScore.toFixed(3)}`,
    );

    const sdk = await classifyText(
      buildClassificationDocument({
        text: "Spent the weekend in the DBC TS client, account metas for swap are still biting me",
        authorBio: "anchor enjoyooor",
      }),
    );
    assert.equal(sdk.primary, "builder_integrating_sdk");
    assert.equal(sdk.gatedAsNoise, false);
    assert.ok(
      sdk.signalScore - sdk.noiseScore >= 0.05,
      `sdk paraphrase gate too tight: sig=${sdk.signalScore.toFixed(3)} noi=${sdk.noiseScore.toFixed(3)}`,
    );
  });

  it("forces LP army posts to noise even when they mention Meteora", async () => {
    const c = await classifyPost({
      text: "LP army assemble we farming Meteora locked LP fees tonight",
      authorUsername: "yieldmaxxer",
    });
    assert.equal(c.primary, "noise_retail_hype");
    assert.equal(c.suppressed, true);
    assert.equal(c.gatedAsNoise, true);
  });

  it("forces ticker CA bots to noise even when they mention graduation", async () => {
    const c = await classifyPost({
      text: "🤖 AI Signal (SOL) $JOBLESS CA: 88E4cWZvAvab1gDbjEhVEAbf43h1UgPngdqpUt3D9VrR already 48% of the way to graduation on Raydium",
      authorUsername: "bitecong",
    });
    assert.equal(c.primary, "noise_retail_hype");
    assert.equal(c.suppressed, true);
  });

  it("keeps Meteora-track hackathons and gates generic demo-day posts", async () => {
    const meteoraTrack = await classifyText(
      buildClassificationDocument({
        text: "Submitting our DBC launchpad to the Meteora track at Colosseum this weekend",
      }),
    );
    assert.equal(meteoraTrack.primary, "hackathon_builder");
    assert.equal(meteoraTrack.gatedAsNoise, false);

    const generic = await classifyText(
      buildClassificationDocument({
        text: "Our hackathon project's demo day is Friday looking for teammates",
      }),
    );
    assert.notEqual(generic.primary, "hackathon_builder");
  });
});
