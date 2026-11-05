export const MOODS = [
  { emoji: "😊", name: "Happy", text: "I want to have a good time" },
  { emoji: "😌", name: "Relaxed", text: "I want to chill and unwind" },
  { emoji: "⚡", name: "Energetic", text: "I want something exciting" },
  { emoji: "😔", name: "Low", text: "I need something comforting" },
  { emoji: "❤️", name: "Romantic", text: "I want a romantic experience" },
  { emoji: "🤩", name: "Adventurous", text: "I want to try something new" },
];

export const MOOD_QUIZ_QUESTIONS = [
  {
    id: "energy",
    question: "How's your energy right now?",
    options: [
      { id: "full", emoji: "🔋", label: "Full of energy", reason: "you're full of energy", weights: { Energetic: 2, Adventurous: 1 } },
      { id: "okay", emoji: "🙂", label: "Doing okay", reason: "you're doing okay", weights: { Happy: 1, Relaxed: 1 } },
      { id: "tired", emoji: "🥱", label: "A bit tired", reason: "you're a bit tired", weights: { Relaxed: 2, Low: 1 } },
      { id: "drained", emoji: "🪫", label: "Completely drained", reason: "you're feeling drained", weights: { Low: 2, Relaxed: 1 } },
    ],
  },
  {
    id: "week",
    question: "How has your day or week been?",
    options: [
      { id: "great", emoji: "🌟", label: "Great", reason: "your week has been great", weights: { Happy: 2, Energetic: 1 } },
      { id: "stressful", emoji: "😵‍💫", label: "Busy and stressful", reason: "it's been a stressful week", weights: { Relaxed: 2, Low: 1 } },
      { id: "boring", emoji: "😐", label: "Boring", reason: "things have been boring lately", weights: { Adventurous: 2, Energetic: 1 } },
      { id: "rough", emoji: "🌧️", label: "Rough", reason: "it's been a rough few days", weights: { Low: 2 } },
    ],
  },
  {
    id: "wish",
    question: "What sounds best right now?",
    options: [
      { id: "quiet", emoji: "🍃", label: "Somewhere quiet", reason: "you want somewhere quiet", weights: { Relaxed: 3 } },
      { id: "laugh", emoji: "😂", label: "Laughing with friends", reason: "you want to laugh with friends", weights: { Happy: 3 } },
      { id: "new", emoji: "🧭", label: "Trying something new", reason: "you want to try something new", weights: { Adventurous: 3 } },
      { id: "loud", emoji: "🎶", label: "Loud music and moving around", reason: "you want music and movement", weights: { Energetic: 3 } },
      { id: "special", emoji: "💞", label: "Special time with someone", reason: "you want special time with someone", weights: { Romantic: 3 } },
      { id: "comfort", emoji: "🧸", label: "Something comforting", reason: "you need a little comfort", weights: { Low: 3 } },
    ],
  },
  {
    id: "company",
    question: "Who's coming along?",
    options: [
      { id: "partner", emoji: "💑", label: "Partner or date", reason: "you're going with a partner", weights: { Romantic: 2 } },
      { id: "friends", emoji: "👯", label: "Close friends", reason: "you're going with close friends", weights: { Happy: 1, Adventurous: 1 } },
      { id: "group", emoji: "🎉", label: "A big group", reason: "you're going with a big group", weights: { Energetic: 1, Happy: 1 } },
      { id: "solo", emoji: "🙋", label: "Just me, or not sure yet", reason: "it's just you for now", weights: { Relaxed: 1, Low: 1 } },
    ],
  },
  {
    id: "adventure",
    question: "How adventurous do you feel?",
    options: [
      { id: "comfort-zone", emoji: "🛋️", label: "Stay in my comfort zone", reason: "you'd rather stay in your comfort zone", weights: { Relaxed: 1, Low: 1 } },
      { id: "surprise", emoji: "🎁", label: "Up for a small surprise", reason: "you're up for a small surprise", weights: { Happy: 1, Romantic: 1 } },
      { id: "bring-it", emoji: "🚀", label: "Bring it on", reason: "you're ready for anything", weights: { Adventurous: 2, Energetic: 1 } },
    ],
  },
];

const TIE_BREAK_QUESTION = "wish";

function findOption(questionId, optionId) {
  const question = MOOD_QUIZ_QUESTIONS.find((item) => item.id === questionId);
  return question?.options.find((option) => option.id === optionId) || null;
}

/*
 * answers: { [questionId]: optionId }
 * Returns the winning mood, the runner-up (if it scored at all), and a short
 * reason built from the answers that pushed the winner the most.
 */
export function scoreMoodQuiz(answers = {}) {
  const scores = Object.fromEntries(MOODS.map((mood) => [mood.name, 0]));
  const chosen = [];

  MOOD_QUIZ_QUESTIONS.forEach((question) => {
    const option = findOption(question.id, answers[question.id]);

    if (!option) {
      return;
    }

    chosen.push({ questionId: question.id, option });
    Object.entries(option.weights).forEach(([mood, points]) => {
      scores[mood] += points;
    });
  });

  const tieBreakWeights =
    findOption(TIE_BREAK_QUESTION, answers[TIE_BREAK_QUESTION])?.weights || {};
  const moodOrder = MOODS.map((mood) => mood.name);

  const ranked = [...moodOrder].sort((a, b) => {
    if (scores[b] !== scores[a]) {
      return scores[b] - scores[a];
    }

    const tieBreak = (tieBreakWeights[b] || 0) - (tieBreakWeights[a] || 0);
    if (tieBreak !== 0) {
      return tieBreak;
    }

    return moodOrder.indexOf(a) - moodOrder.indexOf(b);
  });

  const mood = ranked[0];
  const runnerUp = scores[ranked[1]] > 0 ? ranked[1] : "";

  const reasons = chosen
    .filter(({ option }) => option.weights[mood])
    .sort((a, b) => b.option.weights[mood] - a.option.weights[mood])
    .slice(0, 2)
    .map(({ option }) => option.reason);

  return {
    mood,
    runnerUp,
    reason: reasons.join(" and "),
    scores,
  };
}

export function getMoodInfo(name) {
  return MOODS.find((mood) => mood.name === name) || null;
}
