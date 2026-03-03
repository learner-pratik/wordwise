// ─────────────────────────────────────────────────────────────────────────────
//  notify.js — Netlify Scheduled Function  (runs every hour)
//  For each subscriber it checks whether it is currently 9 AM in their
//  timezone. If it is, it sends either a daily-word or weekly-quiz push.
//
//  Required environment variables (set in Netlify UI → Site config → Env vars):
//    VAPID_PUBLIC_KEY   — the public VAPID key
//    VAPID_PRIVATE_KEY  — the private VAPID key
//    VAPID_EMAIL        — your email, e.g. mailto:you@example.com
// ─────────────────────────────────────────────────────────────────────────────
const webpush  = require('web-push');
const { getStore } = require('@netlify/blobs');

// ── Minimal vocab list (word + short def) used to pick the notification word ──
const WORDS = [
  { word: "Candid",        def: "Truthful and straightforward; frank in speech." },
  { word: "Astute",        def: "Shrewdly perceptive; quick to assess situations." },
  { word: "Resilient",     def: "Able to recover quickly from difficulties; tough." },
  { word: "Serendipity",   def: "A happy accident; finding good things unexpectedly." },
  { word: "Eloquent",      def: "Fluent and persuasive in speaking or writing." },
  { word: "Gregarious",    def: "Fond of company; sociable and outgoing." },
  { word: "Tenacious",     def: "Not giving up easily; fiercely determined." },
  { word: "Empathetic",    def: "Understanding and sharing the feelings of others." },
  { word: "Lucid",         def: "Clearly expressed and easy to understand." },
  { word: "Meticulous",    def: "Very careful and precise; attentive to detail." },
  { word: "Pensive",       def: "Engaged in deep or serious thought; reflective." },
  { word: "Pragmatic",     def: "Focused on practical results rather than ideals." },
  { word: "Whimsical",     def: "Playfully quaint or fanciful; pleasantly odd." },
  { word: "Ambivalent",    def: "Having mixed or contradictory feelings about something." },
  { word: "Forthright",    def: "Direct and outspoken; straightforward without hesitation." },
  { word: "Nonchalant",    def: "Appearing casually calm; not showing anxiety or enthusiasm." },
  { word: "Verbose",       def: "Using more words than needed; long-winded." },
  { word: "Tactful",       def: "Considerate of others' feelings; diplomatic." },
  { word: "Ebullient",     def: "Cheerful and full of energy; overflowing with enthusiasm." },
  { word: "Nuanced",       def: "Characterised by subtle distinctions; not simplistic." },
  { word: "Leverage",      def: "Use something to its maximum advantage." },
  { word: "Expedite",      def: "Make a process happen sooner; speed it up." },
  { word: "Mitigate",      def: "Make less severe; reduce or lessen the impact." },
  { word: "Concise",       def: "Brief but comprehensive; clearly expressed in few words." },
  { word: "Proactive",     def: "Acting in anticipation; controlling a situation before it arises." },
  { word: "Streamline",    def: "Make more efficient by using faster or simpler methods." },
  { word: "Pivotal",       def: "Of crucial importance; a key turning point." },
  { word: "Substantiate",  def: "Provide evidence to support or prove the truth of something." },
  { word: "Facilitate",    def: "Make an action or process easy or easier." },
  { word: "Scalable",      def: "Able to grow efficiently without losing quality." },
  { word: "Hit the nail on the head", def: "Be exactly right; identify the precise issue." },
  { word: "Break the ice",    def: "Ease tension and start conversation in an awkward situation." },
  { word: "Beat around the bush", def: "Avoid the main point; talk about something indirectly." },
  { word: "Bite the bullet",  def: "Endure a painful or difficult situation with courage." },
  { word: "On the fence",     def: "Unable to decide between two options; uncommitted." },
  { word: "Cost an arm and a leg", def: "Be extremely expensive." },
  { word: "Let the cat out of the bag", def: "Accidentally reveal information that was secret." },
  { word: "Burn the midnight oil",  def: "Work or study very hard late into the night." },
  { word: "Under the weather",  def: "Feeling ill or unwell; not in the best of health." },
  { word: "Spill the beans",   def: "Reveal secret information, especially by accident." },
  { word: "Articulate",     def: "Able to speak fluently; express ideas clearly and effectively." },
  { word: "Fathom",         def: "Understand a difficult thing after much thought." },
  { word: "Enigmatic",      def: "Difficult to interpret; mysterious and puzzling." },
  { word: "Jovial",         def: "Cheerful and friendly; full of good humour." },
  { word: "Daunting",       def: "Intimidating; seeming difficult to deal with." },
  { word: "Jaded",          def: "Tired and bored from having had too much of something." },
  { word: "Impeccable",     def: "Perfect; in accordance with the highest standards." },
  { word: "Acumen",         def: "The ability to make good judgements quickly; shrewdness." },
  { word: "Discerning",     def: "Having good judgement; able to recognise quality." },
  { word: "Hone",           def: "Sharpen a skill to a high level; perfect over time." },
  { word: "The ball is in your court", def: "It is now your turn to take action or decide." },
  { word: "Miss the boat",  def: "Miss an opportunity; fail to act in time." },
  { word: "Once in a blue moon", def: "Very rarely; once in a very long time." },
  { word: "Pull someone's leg", def: "Tease or joke with someone playfully." },
  { word: "A blessing in disguise", def: "Something that seems bad at first but turns out to be good." },
  { word: "Get cold feet",  def: "Become nervous or hesitant about something already planned." },
  { word: "Every cloud has a silver lining", def: "Every difficult situation has a positive aspect." },
  { word: "Bite off more than you can chew", def: "Take on a commitment that is too much to handle." },
  { word: "Move the needle",   def: "Have a meaningful impact; make significant progress." },
  { word: "Value proposition", def: "A statement of why your product or service is worth choosing." },
  { word: "Paradigm shift",    def: "A fundamental change in approach or way of thinking." },
  { word: "Pain points",       def: "The specific problems or frustrations a customer experiences." },
  { word: "Low-hanging fruit",  def: "The easiest tasks or goals to achieve; quick wins." },
  { word: "Circle back",       def: "Return to a topic at a later time; follow up." },
  { word: "Take ownership",    def: "Accept full responsibility for something and its outcomes." },
  { word: "Deep dive",         def: "A thorough, in-depth examination of a topic." },
  { word: "Amiable",           def: "Having a friendly and pleasant manner; good-natured." },
  { word: "Blunder",           def: "A stupid or careless mistake." },
  { word: "Candor",            def: "The quality of being open and honest; frankness." },
  { word: "Inevitable",        def: "Certain to happen; unable to be avoided." },
  { word: "Haggle",            def: "Dispute or bargain persistently over a price." },
  { word: "Gloat",             def: "Be smug or take excessive satisfaction in one's success." },
  { word: "Robust",            def: "Strong and resilient; able to withstand adverse conditions." },
  { word: "Pervasive",         def: "Spreading widely throughout; present everywhere." },
  { word: "Tangible",          def: "Real and concrete; perceptible; not abstract." },
  { word: "Inquisitive",       def: "Having a keen interest in learning; naturally curious." },
  { word: "Commensurate",      def: "In proportion to; corresponding in size or degree." },
  { word: "Quantify",          def: "Express or measure the quantity of; put a number on." },
  { word: "Flabbergasted",     def: "Utterly astonished; overcome with shock and surprise." },
  { word: "Underpin",          def: "Support or form the basis for; strengthen from below." },
  { word: "Sanguine",          def: "Optimistic, especially in a difficult situation." },
  { word: "Tactile",           def: "Connected with the sense of touch; perceptible by touch." },
  { word: "Discrepancy",       def: "A lack of compatibility between two facts; an inconsistency." },
  { word: "Lament",            def: "Express great sorrow or regret; mourn or grieve." },
  { word: "Forthcoming",       def: "About to appear soon; willing to give information." },
  { word: "Reinforce",         def: "Strengthen or support, especially with more evidence." },
  { word: "Innate",            def: "Inborn; natural; existing from birth rather than learned." },
  { word: "Scrutinise",        def: "Examine closely and critically; inspect in great detail." },
  { word: "Volatile",          def: "Liable to change rapidly and unpredictably; unstable." },
  { word: "Succinct",          def: "Briefly and clearly expressed; without wasted words." },
];

// ── Configure web-push ──────────────────────────────────────────────────────
webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:pratik.naik3202@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Returns the current hour (0-23) in a given IANA timezone */
function currentHourIn(timezone) {
  try {
    const str = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).format(new Date());
    // Intl may return "24" for midnight on some runtimes; normalise
    return parseInt(str, 10) % 24;
  } catch {
    return -1; // invalid timezone — skip
  }
}

/** Returns today's word index for a given startDate string (YYYY-MM-DD) */
function wordIndexFor(startDate, timezone) {
  const start = new Date(startDate + 'T00:00:00');
  // Get today's date in the subscriber's timezone
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
  const today = new Date(todayStr + 'T00:00:00');
  const daysSinceStart = Math.max(0, Math.floor((today - start) / 86_400_000));
  return daysSinceStart % WORDS.length;
}

/** Returns true if today is a quiz day (every 7th day since startDate) */
function isQuizDay(startDate, timezone) {
  const start = new Date(startDate + 'T00:00:00');
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
  const today = new Date(todayStr + 'T00:00:00');
  const daysSinceStart = Math.floor((today - start) / 86_400_000);
  return daysSinceStart > 0 && daysSinceStart % 7 === 0;
}

/** Send a push message, removing expired/invalid subscriptions automatically */
async function sendPush(store, key, record) {
  const payload = JSON.stringify(record.payload);
  try {
    await webpush.sendNotification(record.subscription, payload);
    console.log(`✅ Sent to ${key.slice(-8)}`);
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Subscription expired — clean it up
      console.log(`🗑 Removing expired subscription ${key.slice(-8)}`);
      await store.delete(key).catch(() => {});
    } else {
      console.error(`❌ Failed to send to ${key.slice(-8)}:`, err.message);
    }
  }
}

// ── Main handler (called on schedule) ───────────────────────────────────────
exports.handler = async () => {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.error('VAPID keys not configured — set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Netlify env vars');
    return { statusCode: 500 };
  }

  const store = getStore('push-subscriptions');
  let entries;
  try {
    const list = await store.list();
    entries = list.blobs || [];
  } catch (err) {
    console.error('Could not list subscriptions:', err.message);
    return { statusCode: 500 };
  }

  if (entries.length === 0) {
    console.log('No subscribers yet.');
    return { statusCode: 200 };
  }

  const sends = entries.map(async ({ key }) => {
    let record;
    try {
      record = await store.get(key, { type: 'json' });
    } catch {
      return; // couldn't read — skip
    }

    const { subscription, timezone, startDate } = record;
    const hour = currentHourIn(timezone);

    // Only fire when it is 9 AM in the subscriber's timezone
    if (hour !== 9) return;

    const quiz = isQuizDay(startDate, timezone);
    const idx  = wordIndexFor(startDate, timezone);
    const word = WORDS[idx];

    let payload;
    if (quiz) {
      payload = {
        title: '🧠 WordWise — Weekly Quiz!',
        body:  "It's quiz time! Test yourself on the words you've learned this week.",
        url:   '/?tab=quiz',
        tag:   'wordwise-quiz',
      };
    } else {
      payload = {
        title: `📚 WordWise — Today's Word: ${word.word}`,
        body:  word.def,
        url:   '/?tab=today',
        tag:   'wordwise-daily',
      };
    }

    await sendPush(store, key, { subscription, payload });
  });

  await Promise.allSettled(sends);
  return { statusCode: 200 };
};
