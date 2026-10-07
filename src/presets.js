// Five absurd scenarios, each designed to show off a different Bayesian lesson.
// Probabilities are in [0, 1].

const ev = (text, pEH, pEnH) => ({ text, pEH, pEnH, on: true });

export const PRESETS = [
  {
    id: 'cat',
    emoji: '🐈',
    title: 'The cat is plotting against me',
    lesson: 'Several modest clues compound. One big clue dominates.',
    hypothesis: 'My cat is actively plotting against me',
    prior: 0.05,
    evidence: [
      ev('Stared at me for 40 uninterrupted seconds', 0.9, 0.6),
      ev('Knocked my glass off the table while maintaining eye contact', 0.7, 0.25),
      ev('Purred contentedly on my lap', 0.3, 0.8),
      ev('Found a tiny notebook containing my daily schedule', 0.4, 0.002),
    ],
  },
  {
    id: 'printer',
    emoji: '🖨️',
    title: 'The printer resents me specifically',
    lesson: 'Evidence that is likely either way barely moves anything. Then one item does.',
    hypothesis: 'The office printer is sentient and resents me personally',
    prior: 0.01,
    evidence: [
      ev('Paper jam the moment I hit "Print"', 0.95, 0.7),
      ev('Works flawlessly for my colleague, Derek', 0.9, 0.5),
      ev('Printed my resignation letter in perfect quality, on the first try', 0.98, 0.6),
      ev('Display read "NO." when I asked for double-sided', 0.6, 0.0002),
    ],
  },
  {
    id: 'pigeon',
    emoji: '🐦',
    title: 'It is the same pigeon every day',
    lesson: 'A low prior can be overcome — if the evidence is genuinely surprising otherwise.',
    hypothesis: 'The pigeon at my bus stop is the same individual pigeon every day',
    prior: 0.02,
    evidence: [
      ev('It is grey', 0.99, 0.97),
      ev('It has a slightly bent left toe', 0.95, 0.05),
      ev('It approaches only me and ignores the man with the sandwich', 0.6, 0.08),
      ev('It was there on a Sunday, when the bus does not run', 0.7, 0.3),
    ],
  },
  {
    id: 'socks',
    emoji: '🧦',
    title: 'The dryer is a portal',
    lesson: "Cromwell's rule: a prior of 0% is a promise never to learn anything.",
    hypothesis: 'My dryer is a portal to a sock-exclusive dimension',
    prior: 0,
    evidence: [
      ev('An odd number of socks emerged', 0.99, 0.4),
      ev('The dryer briefly hummed in a key not found in Western music', 0.5, 0.02),
      ev('A sock I have never owned appeared, wet, smelling of ozone', 0.3, 0.001),
    ],
  },
  {
    id: 'plant',
    emoji: '🪴',
    title: 'The plant is faking it for attention',
    lesson: 'Order does not matter: the posterior is the same however you shuffle the evidence.',
    hypothesis: 'My houseplant is faking its own death for attention',
    prior: 0.1,
    evidence: [
      ev('It wilted dramatically the moment I sat down to watch TV', 0.85, 0.3),
      ev('It perked up within minutes of being spoken to', 0.8, 0.2),
      ev('I have, in fact, not watered it since March', 0.4, 0.95),
      ev('A new leaf unfurled while I was on the phone with my mother', 0.7, 0.35),
    ],
  },
];

export const DEFAULT_STATE = {
  mode: 'lab',
  hypothesis: '',
  prior: 0.5,
  evidence: [],
  coin: { a0: 1, b0: 1, flips: '' },
};

export const COIN_PRIORS = [
  { id: 'uniform', label: 'Total ignorance', note: 'Beta(1, 1): every bias equally plausible.', a0: 1, b0: 1 },
  { id: 'jeffreys', label: 'Jeffreys', note: 'Beta(½, ½): suspects the coin is either rigged or very rigged.', a0: 0.5, b0: 0.5 },
  { id: 'trusting', label: 'Trusts the Mint', note: 'Beta(50, 50): coins are fair, thank you very much.', a0: 50, b0: 50 },
  { id: 'cynic', label: 'Card-table cynic', note: 'Beta(2, 6): has been to Las Vegas.', a0: 2, b0: 6 },
];
