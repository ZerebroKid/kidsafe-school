# ZerebroKid — project rules

## Copy rules (locked by the user)
- Popup 1 and Popup 2 marketing lines must be written in **English**, NOT Hindi/Hinglish/Devanagari.
- Do **not** shorten, summarise, merge or paraphrase away the depth of any marketing line. Every line keeps all of its detail.
- Treat **every marketing line as its own card**, and every card carries a visual.
- Product/UI copy elsewhere: mostly English; Hinglish only inside the specified marketing copy.
- Emoji: replace with SVG icons everywhere for a premium feel.

### Popup 1 — Rewards (English, full depth, one card per line)
1. Complete your today's topic and get rewards
2. New games
3. New funny videos
4. Get food delivered at home at special discounts
5. Get other products delivered at home at special discounts
6. Price line: what costs ₹200 at an offline shop outside, and ₹230 on an online store like Zomato or Amazon, you get for only ₹150 on our app.

### Popup 2 — No tuition needed (English, full depth, one card per line)
1. Same content as a coaching institute
2. Now no need to spend ₹3,000 on monthly tuition
3. We will give you the same content as coaching, here on our app
4. No need to go outside in the sun and get tanned
5. Going and coming back wastes your time
6. Staying in the sun damages your skin
7. Travelling makes you tired
8. And you still pay ₹3,000 every month for tuition
9. So no more of all this — now this app gives you the same quality content you would get by going to any coaching institute
10. Sit in your room and we will deliver everything required
11. Live classes
12. Recorded lectures
13. Notes from top coaching institute teachers
14. E-books from top coaching institutes
15. An AI system that lets you ask any doubt from the middle of your lecture, as many times as you want
16. Before the exam, the AI system will collect your school's past exam papers and give you the questions most likely to come in the next exam

## Design rules
- Frozen token sheet from the master prompt pack (violet #6D3BFF primary, 4px spacing base, 390×844 frame). Never introduce off-token values.
- 7 sections: Explanation · Watch & Learn · Practice · Curiosity · Real-Life · Common Mistakes · Experiment → Quiz as the gate.
- No lives/hearts system. "Try again" always available.
- **From iteration 2 on: NO XP, coins, levels, streaks, leaderboards or achievements anywhere.** Motivation is only: today's mission → topic → quiz → unlock reward. Keep the interface calm, minimal, focused.
- Bottom nav: Home · Study · Quiz · Rewards · Profile.
- Visual storytelling over paragraphs — one image instead of three lines. Real photographic/product imagery in reward and feature cards (currently AI-generated stand-ins in `assets/`, need licensing before launch).
- Any feature not live carries a "Coming soon" ribbon.
- Light app; dark only for immersive moments (video, Focus Mode, quiz).
- Flexbox + gap only (Auto Layout safe for html.to.design → Figma). Semantic class names on every pattern.
- Illustrations: geometric SVG where it works, labelled placeholders where it doesn't. No hotlinked images.
