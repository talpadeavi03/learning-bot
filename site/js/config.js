const WORKER_URL = 'https://learning-bot.talpadeavi0303.workers.dev';

// Default data — overridden by loadDashboard() with live API data
const D = {
  metrics: { energy: 0, focus: 0, mood: 0, sleep: 0, productivity: 0 },
  activity: [],
  goals: { today: [] },
  weekly: [0, 0, 0, 0, 0, 0, 0]
};

const UNIVERSES = {
  aether: { name: 'Universe-616', accent: '45,159,61', bg: '#181818', card: '#1e1e1e' },
  iron:   { name: 'Iron Man Verse', accent: '220,53,53', bg: '#1a0a0a', card: '#2a1515' },
  anime:  { name: 'Anime Nexus', accent: '138,43,226', bg: '#12081e', card: '#1e1028' },
  cyber:  { name: 'Cyberpunk-7', accent: '0,255,255', bg: '#0a1a1a', card: '#0f2828' },
};

function changeUniverse(id) {
  const u = UNIVERSES[id] || UNIVERSES.aether;
  document.documentElement.style.setProperty('--g', `rgba(${u.accent},.85)`);
  document.documentElement.style.setProperty('--g2', `rgba(${u.accent},.15)`);
  document.documentElement.style.setProperty('--bg', u.bg);
  document.documentElement.style.setProperty('--card', u.card);
  showAchievement('Universe Shifted', u.name + ' · +150 XP');
}
