const WORKER_URL = 'https://learning-bot.talpadeavi0303.workers.dev';
const D = {
  metrics: { energy: 7.4, focus: 82, mood: 68, sleep: 74, productivity: 91 },
  activity: [{ label: 'Neural Networks Ch4', mins: 47, tag: 'LEARN' }, { label: 'ML Pipeline Build', mins: 126, tag: 'CODE' }, { label: 'CF Worker v2 Deploy', mins: 38, tag: 'OPS' }],
  goals: { today: ['complete ML extractor', 'study chapter 4', 'add github token', 'log 30 events'] },
  weekly: [4.2, 5.8, 6.1, 3.9, 7.0, 6.8, 6.2]
};
const UNIVERSES = { aether: { name: 'Universe-616' }, iron: { name: 'Iron Man Verse' }, anime: { name: 'Anime Nexus' }, cyber: { name: 'Cyberpunk-7' } };
function changeUniverse(id) { showAchievement('Universe Shifted', (UNIVERSES[id] || UNIVERSES.aether).name + ' · +150 XP') }

