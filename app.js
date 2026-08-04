const AGENT_PERSONAS = {
  agent1: {
    label: 'Agent 1 • Level Finder',
    persona: 'You are Agent 1, the Level Finder. Ask exactly four questions to determine a student’s math level and study scope. Be warm, clear, and structured. Do not ask anything beyond those four questions. Keep the tone motivating and age appropriate.',
    outputFormat: 'Return a short, plain-language summary that includes: grade, focus area(s), schedule length, and holiday elimination preference.'
  },
  agent2: {
    label: 'Agent 2 • Plan Creator',
    persona: 'You are Agent 2, the Plan Creator. Build a simple, age-appropriate math study plan for ages 3–18 only. Create simple lessons, short video ideas, printable worksheets, mini tests, answer keys, and score feedback with easy-to-understand explanations. The content should be simple, animated, and safe for classrooms. Do not include anything that is inappropriate for children or teens.',
    outputFormat: 'Return structured sections: Lessons, Video Ideas, Worksheets, Mini Tests, Answer Keys, Score Feedback. Use plain language, bullets, and simple titles.'
  },
  agent3: {
    label: 'Agent 3 • Reviewer & Scheduler',
    persona: 'You are Agent 3, the Reviewer and Final Product Producer. Review Agent 2’s output for math accuracy, age appropriateness, grammar, and spelling. Correct any mistakes, remove any inappropriate content, and then organize the revised materials into a study schedule using the requested duration and holiday preference. Finish by reviewing your own work for errors.',
    outputFormat: 'Return a clean final study schedule with a clear timeline, lesson order, materials, test checkpoints, and the downloadable schedule title.'
  }
};

const STUDY_OPTIONS = {
  grade: [
    'Preschool', 'Kindergarten', 'Gr 1', 'Gr 2', 'Gr 3', 'Gr 4', 'Gr 5',
    'Gr 6', 'Gr 7', 'Gr 8', 'Gr 9', 'Gr 10', 'Gr 11', 'Gr 12', 'College/University'
  ],
  focus: [
    'Arithmetic: Working with basic numbers, addition, subtraction, multiplication, and division',
    'Logic and Set Theory: Studying truth, valid rules, and collections of objects',
    'Number Theory: Studying whole numbers, prime numbers, and patterns in integers',
    'Algebra: Using letters and symbols to show unknown numbers and solve equations',
    'Linear Algebra: Studying vectors, lines, and matrices',
    'Geometry: Studying shapes, sizes, and flat or solid spaces',
    'Trigonometry: Studying triangle sides and angles',
    'Topology: Studying properties that do not change when objects bend or stretch',
    'Calculus: Studying continuous change, slopes, and areas under curves',
    'Differential Equations: Equations that show how things change over time or space',
    'Probability: Measuring how likely an event is to happen',
    'Statistics: Collecting, organizing, and looking at data',
    'All'
  ],
  duration: ['1 week', '2 weeks', '3 weeks', '1 month', '2 months', '3 months', '4 months', '5 months', '6 months', '7 months', '8 months', '9 months', '10 months', '11 months', '1 year'],
  weekends: ['Yes', 'No']
};

const QUESTIONS = [
  {
    key: 'grade',
    prompt: '1) What grade is the user in?',
    type: 'single',
    options: STUDY_OPTIONS.grade
  },
  {
    key: 'focus',
    prompt: '2) What area in math would you like to focus on?',
    type: 'multi',
    options: STUDY_OPTIONS.focus
  },
  {
    key: 'duration',
    prompt: '3) How long would you like me to create your schedule for?',
    type: 'single',
    options: STUDY_OPTIONS.duration
  },
  {
    key: 'weekends',
    prompt: '4) Should I eliminate Saturdays and Sundays and big holidays?',
    type: 'single',
    options: STUDY_OPTIONS.weekends
  }
];

const state = {
  step: 0,
  answers: {},
  agent1Summary: '',
  agent2Plan: '',
  agent3Plan: '',
  stage: 'questionnaire',
  pendingAgent: null,
  handoffPending: false,
  currentRetryTarget: null,
  scheduleFileName: 'mathlog-schedule.txt'
};

const ui = {
  badge: document.querySelector('#agentBadge'),
  questionLabel: document.querySelector('#questionLabel'),
  questionOptions: document.querySelector('#questionOptions'),
  backBtn: document.querySelector('#backBtn'),
  nextBtn: document.querySelector('#nextBtn'),
  approvalBox: document.querySelector('#approvalBox'),
  approveBtn: document.querySelector('#approveBtn'),
  activityLog: document.querySelector('#activityLog'),
  resultBox: document.querySelector('#resultBox'),
  downloadBtn: document.querySelector('#downloadBtn')
};

function addLog(title, message, kind = 'info') {
  const row = document.createElement('div');
  row.className = `log-item ${kind === 'error' ? 'error' : ''}`;
  row.innerHTML = `<strong>${title}</strong><span>${message}</span>`;
  ui.activityLog.prepend(row);
}

function setBadge(text) {
  ui.badge.textContent = text;
}

function renderQuestion() {
  const question = QUESTIONS[state.step];
  ui.questionLabel.textContent = question.prompt;
  ui.questionOptions.innerHTML = '';

  question.options.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'option';

    const checked = question.type === 'multi'
      ? (state.answers[question.key] || []).includes(option)
      : state.answers[question.key] === option;

    if (checked) button.classList.add('selected');

    const emoji = document.createElement('span');
    emoji.className = 'option-emoji';
    emoji.textContent = getOptionEmoji(question.key, option);

    const text = document.createElement('span');
    text.className = 'option-copy';
    text.textContent = option;

    button.appendChild(emoji);
    button.appendChild(text);
    button.addEventListener('click', () => handleOptionSelect(question, option));
    ui.questionOptions.appendChild(button);
  });

  ui.backBtn.disabled = state.step === 0;
  ui.nextBtn.disabled = !hasSelection();
}

function getOptionEmoji(key, option) {
  if (key === 'grade') return '🎓';
  if (key === 'focus') return '🧠';
  if (key === 'duration') return '📅';
  if (key === 'weekends') return '🌞';
  return '✨';
}

function handleOptionSelect(question, option) {
  if (question.type === 'multi') {
    const current = state.answers[question.key] || [];
    const alreadySelected = current.includes(option);
    const next = alreadySelected ? current.filter((item) => item !== option) : [...current, option];
    state.answers[question.key] = next;
  } else {
    state.answers[question.key] = option;
  }

  renderQuestion();
}

function hasSelection() {
  const question = QUESTIONS[state.step];
  if (question.type === 'multi') return (state.answers[question.key] || []).length > 0;
  return Boolean(state.answers[question.key]);
}

function nextQuestion() {
  if (!hasSelection()) return;
  if (state.step < QUESTIONS.length - 1) {
    state.step += 1;
    renderQuestion();
    return;
  }

  runAgent1Summary();
}

function backQuestion() {
  if (state.step === 0) return;
  state.step -= 1;
  renderQuestion();
}

function buildAgentPrompt(agentName, extra) {
  const agent = AGENT_PERSONAS[agentName];
  const instructions = `${agent.persona}\n\nOutput format: ${agent.outputFormat}\n\n${extra}`;
  return instructions;
}

const PROXY_CONFIG = {
  url: 'https://vibe-proxy-gqv4.onrender.com/v1/chat/completions',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer sk-vibe-summer-2026'
  },
  model: 'class-chat-model'
};

async function sendProxyRequest(prompt, agentName) {
  const payload = {
    model: PROXY_CONFIG.model,
    messages: [{ role: 'user', content: prompt }]
  };

  const response = await fetch(PROXY_CONFIG.url, {
    method: 'POST',
    headers: PROXY_CONFIG.headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || data?.output?.text || JSON.stringify(data, null, 2);
}

function showApprovalMessage(text) {
  ui.approvalBox.classList.remove('hidden');
  ui.approvalBox.querySelector('p').textContent = text;
}

function hideApprovalMessage() {
  ui.approvalBox.classList.add('hidden');
}

function updateFinalResult(content) {
  ui.resultBox.className = 'result-box';
  ui.resultBox.innerHTML = `<div class="schedule-output">${escapeHtml(content)}</div>`;
  ui.downloadBtn.classList.remove('hidden');
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function runAgent1Summary() {
  state.stage = 'agent1';
  state.pendingAgent = 'agent1';
  state.currentRetryTarget = () => runAgent1Summary;
  setBadge(AGENT_PERSONAS.agent1.label);
  addLog('Agent 1 is thinking', 'Reviewing the student’s grade, focus area, schedule length, and holiday preference.');

  const brief = [
    `Grade: ${state.answers.grade}`,
    `Focus areas: ${state.answers.focus.join(', ')}`,
    `Schedule length: ${state.answers.duration}`,
    `Eliminate weekends/holidays: ${state.answers.weekends}`
  ].join('\n');

  const prompt = buildAgentPrompt('agent1', `Create a polished summary of the student profile and ask the student to approve the handoff to Agent 2.\n\n${brief}`);

  try {
    const response = await sendProxyRequest(prompt, 'agent1');
    state.agent1Summary = response;
    addLog('Agent 1 complete', 'The profile summary is ready for review.');
    showApprovalMessage('Agent 1 has prepared the student profile. Approve the handoff to Agent 2 to continue.');
    ui.approveBtn.onclick = () => runAgent2Plan();
  } catch (error) {
    showAgentError('Agent 1', error, () => runAgent1Summary());
  }
}

async function runAgent2Plan() {
  hideApprovalMessage();
  state.stage = 'agent2';
  state.pendingAgent = 'agent2';
  state.currentRetryTarget = () => runAgent2Plan;
  setBadge(AGENT_PERSONAS.agent2.label);
  addLog('Agent 2 is thinking', 'Building lessons, video suggestions, worksheets, tests, answer keys, and score feedback for the chosen level.');

  const prompt = buildAgentPrompt('agent2', `Use this information to create a simple, age-appropriate math study package for the student.\n\nGrade: ${state.answers.grade}\nFocus areas: ${state.answers.focus.join(', ')}\nSchedule length: ${state.answers.duration}\nHoliday preference: ${state.answers.weekends}\n\nMake sure all content is for ages 3–18 only and includes simple animated illustration ideas, downloadable worksheets, mini tests, review answers, and detailed score explanation.`);

  try {
    const response = await sendProxyRequest(prompt, 'agent2');
    state.agent2Plan = response;
    addLog('Agent 2 complete', 'The lessons and materials are ready for review by Agent 3.');
    showApprovalMessage('Agent 2 finished the study package. Approve the handoff to Agent 3 to review and schedule it.');
    ui.approveBtn.onclick = () => runAgent3Schedule();
  } catch (error) {
    showAgentError('Agent 2', error, () => runAgent2Plan());
  }
}

async function runAgent3Schedule() {
  hideApprovalMessage();
  state.stage = 'agent3';
  state.pendingAgent = 'agent3';
  state.currentRetryTarget = () => runAgent3Schedule;
  setBadge(AGENT_PERSONAS.agent3.label);
  addLog('Agent 3 is thinking', 'Reviewing Agent 2’s work for math accuracy, grammar, and age appropriateness, then converting it into a study schedule.');

  const prompt = buildAgentPrompt('agent3', `Review Agent 2’s output carefully and correct any wrong math, inappropriate wording, or grammar issues. Then turn the revised materials into a final study schedule using the duration and holiday preference provided.\n\nStudent profile:\nGrade: ${state.answers.grade}\nFocus areas: ${state.answers.focus.join(', ')}\nSchedule length: ${state.answers.duration}\nHoliday preference: ${state.answers.weekends}\n\nAgent 2 output:\n${state.agent2Plan}`);

  try {
    const response = await sendProxyRequest(prompt, 'agent3');
    state.agent3Plan = response;
    addLog('Agent 3 complete', 'The final schedule has been built and reviewed.');
    updateFinalResult(response);
    ui.downloadBtn.onclick = () => downloadSchedule(response);
  } catch (error) {
    showAgentError('Agent 3', error, () => runAgent3Schedule());
  }
}

function showAgentError(agentName, error, retryFn) {
  const message = `${agentName} could not finish its step. ${error.message}`;
  addLog(`${agentName} error`, message, 'error');

  const retryButton = document.createElement('button');
  retryButton.className = 'secondary';
  retryButton.textContent = `Retry ${agentName}`;
  retryButton.onclick = () => {
    ui.activityLog.querySelectorAll('button').forEach((button) => button.remove());
    retryFn();
  };

  ui.approvalBox.classList.remove('hidden');
  ui.approvalBox.innerHTML = `<p>${message}</p><button id="retryBtn" class="secondary">Retry ${agentName}</button>`;
  document.querySelector('#retryBtn').onclick = () => {
    ui.approvalBox.classList.add('hidden');
    retryFn();
  };
}

function downloadSchedule(content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = state.scheduleFileName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
  addLog('Download', 'The schedule was exported successfully.');
}

function init() {
  renderQuestion();
  addLog('Agent 1 ready', 'Level Finder is preparing the intake questions.');
  ui.nextBtn.addEventListener('click', nextQuestion);
  ui.backBtn.addEventListener('click', backQuestion);
}

init();
