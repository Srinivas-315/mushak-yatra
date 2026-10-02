// Short "Bappa Katha" cards shown between acts, each with one quick quiz question.
// Answering correctly within the time limit gives bonus points.

export const STORIES = [
  {
    title: 'Why Ganesha is worshipped first',
    text: 'The gods held a race: whoever circled the universe first would be honoured first. Kartikeya flew off on his peacock. Ganesha simply walked around his parents, Shiva and Parvati, saying they were his whole universe. His wisdom won.',
    q: 'Whom did Ganesha circle to win the race?',
    options: ['His parents', 'Mount Kailash', 'The ocean', 'The moon'],
    answer: 0,
  },
  {
    title: 'The broken tusk',
    text: 'When Sage Vyasa recited the Mahabharata, Ganesha agreed to write it down without stopping. When his pen broke, he broke off one of his own tusks and kept writing, so the great story would not be interrupted.',
    q: 'Which epic did Ganesha write down?',
    options: ['Ramayana', 'Mahabharata', 'Panchatantra', 'Jataka Tales'],
    answer: 1,
  },
  {
    title: 'Mushak, the humble ride',
    text: 'Ganesha rides a tiny mouse named Mushak. It shows that true strength is not about size. A mouse can reach every corner, just as wisdom can reach and remove every obstacle.',
    q: 'What is the name of Ganesha’s mouse?',
    options: ['Nandi', 'Garuda', 'Mushak', 'Airavata'],
    answer: 2,
  },
  {
    title: 'Why 21 modaks?',
    text: 'Modaks are Ganesha’s favourite sweet. Devotees traditionally offer 21 modaks along with 21 blades of durva grass during the puja, as a sign of complete devotion.',
    q: 'How many modaks are traditionally offered?',
    options: ['11', '21', '51', '108'],
    answer: 1,
  },
  {
    title: 'The eco-friendly celebration',
    text: 'Traditional murtis were made of natural clay that dissolves gently in water. Today many families choose clay murtis and natural colours again, so the rivers and seas stay clean after Visarjan.',
    q: 'Which murti is best for the environment?',
    options: ['Plaster of Paris', 'Plastic', 'Natural clay', 'Painted metal'],
    answer: 2,
  },
  {
    title: 'Vighnaharta',
    text: 'One of Ganesha’s many names is Vighnaharta, the Remover of Obstacles. That is why people pray to him before starting anything new: a journey, an exam, or even a new game!',
    q: 'What does "Vighnaharta" mean?',
    options: ['Lord of sweets', 'Remover of obstacles', 'King of music', 'Protector of forests'],
    answer: 1,
  },
];

export const BLESSINGS = [
  'May Bappa remove every obstacle from your path.',
  'Wisdom, joy and sweet modaks to you this Chaturthi!',
  'Like Mushak, may you reach every goal, however big.',
  'Ganpati Bappa Morya, Pudhchya Varshi Lavkar Ya!',
  'May your code compile and your heart stay light.',
];

export const ACTS = [
  { id: 0, name: 'Bazaar at Dawn', sub: 'Act 1', length: 900 },
  { id: 1, name: 'Pandal Nights', sub: 'Act 2', length: 1000 },
  { id: 2, name: 'Visarjan by the Sea', sub: 'Act 3', length: 1100 },
];
