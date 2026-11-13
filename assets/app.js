(() => {
  const $ = (selector) => document.querySelector(selector);
  const guide = $('#guide');
  const message = $('#message');
  const answers = $('#answers');
  const result = $('#result');
  const summary = $('#summary');
  const progress = $('#progress');
  const progressLabel = $('#progress-label');
  const stepLabel = $('#guide-step');
  let path = '';
  let incident = '';
  let urgency = '';
  let nextStep = '';

  const paths = {
    fraud: {
      title: 'Suspected scam',
      first: 'Has money moved recently, or is a transfer still pending?',
      options: [
        ['Yes, money moved or is pending', 'active'],
        ['No money has moved', 'not-moved'],
        ['I am not sure', 'unsure']
      ]
    },
    hardship: {
      title: 'Payment hardship',
      first: 'What best describes your situation?',
      options: [
        ['My income has stopped', 'income-stopped'],
        ['My income has reduced', 'income-reduced'],
        ['A payment or bill is overdue', 'overdue'],
        ['Unexpected essential costs', 'unexpected-costs']
      ]
    }
  };

  function setProgress(step, total = 3) {
    const value = Math.round((step / total) * 100);
    progress.style.width = value + '%';
    progressLabel.textContent = 'Step ' + step + ' of ' + total;
    stepLabel.textContent = path === 'fraud' ? 'Fraud safety guide' : 'Payment support guide';
  }

  function renderOptions(options) {
    answers.replaceChildren();
    options.forEach(([label, value]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'answer-button';
      const text = document.createElement('span');
      text.textContent = label;
      const arrow = document.createElement('span');
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '→';
      button.append(text, arrow);
      button.addEventListener('click', () => {
        incident = value;
        if (path === 'fraud') handleFraud(value);
        else handleHardship(value);
      });
      answers.append(button);
    });
  }

  function start(selectedPath) {
    path = selectedPath;
    incident = '';
    urgency = '';
    nextStep = '';
    document.querySelectorAll('[data-path]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.path === selectedPath));
    });
    guide.classList.remove('hidden');
    result.classList.add('hidden');
    setProgress(1);
    message.textContent = paths[path].first;
    renderOptions(paths[path].options);
    guide.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  function handleFraud(value) {
    setProgress(2);
    if (value === 'active' || value === 'unsure') {
      urgency = value === 'active' ? 'Immediate — money moved or pending' : 'Urgent — movement unclear';
      message.textContent = 'Please contact your bank now using its official app or the phone number printed on your card. Ask the bank to secure the affected card or account and review any pending transfer. Do not use a number sent by the caller or message.';
      nextStep = 'Contact your bank through an official channel immediately.';
      renderOptions([
        ['I have contacted my bank', 'bank-contacted'],
        ['I cannot reach my bank', 'cannot-reach-bank'],
        ['I need help understanding what happened', 'need-help']
      ]);
      return;
    }
    urgency = 'No immediate movement reported';
    message.textContent = 'What happened that made you concerned?';
    renderOptions([
      ['I received a suspicious call or message', 'suspicious-contact'],
      ['Someone asked me to share a code', 'code-request'],
      ['I noticed an unknown transaction', 'unknown-transaction'],
      ['I am still unsure', 'unsure-event']
    ]);
  }

  function handleHardship(value) {
    setProgress(2);
    urgency = value === 'overdue' ? 'Payment needs review' : 'Support options to explore';
    const labels = {
      'income-stopped': 'Your income has stopped.',
      'income-reduced': 'Your income has reduced.',
      overdue: 'A payment or bill is overdue.',
      'unexpected-costs': 'You have unexpected essential costs.'
    };
    message.textContent = labels[value] + ' You can ask your bank or provider whether a temporary reduced payment, payment-date change, hardship review, or fee review is available. These are requests, not guaranteed approvals.';
    nextStep = 'Ask the provider about hardship support and get any agreement in writing.';
    renderOptions([
      ['I want to prepare what to ask', 'prepare-request'],
      ['I would rather speak to a person', 'human-support'],
      ['I am not sure where to start', 'not-sure']
    ]);
  }

  function finish(detail) {
    setProgress(3);
    message.textContent = 'Here is a short summary you can take to your bank or a trusted adviser. Nothing has been sent or submitted.';
    answers.replaceChildren();
    const pathName = paths[path].title;
    const summaryText = [
      'KINTSUGI — CUSTOMER-PREPARED SUMMARY',
      'Support area: ' + pathName,
      'Situation: ' + detail,
      'Urgency: ' + (urgency || 'Not assessed'),
      'Suggested next step: ' + nextStep,
      '',
      'This summary was prepared in a local demo. No bank action or case submission has occurred.'
    ].join('\n');
    summary.textContent = summaryText;
    result.classList.remove('hidden');
    result.scrollIntoView({ behavior: 'auto', block: 'nearest' });
  }

  document.querySelectorAll('[data-path]').forEach((button) => {
    button.addEventListener('click', () => start(button.dataset.path));
  });

  $('#restart').addEventListener('click', () => {
    guide.classList.add('hidden');
    result.classList.add('hidden');
    answers.replaceChildren();
    message.textContent = '';
    document.querySelectorAll('[data-path]').forEach((button) => button.setAttribute('aria-pressed', 'false'));
    path = '';
  });

  $('#finish-reset').addEventListener('click', () => {
    $('#restart').click();
    $('#start').scrollIntoView({ behavior: 'auto' });
  });

  $('#copy-summary').addEventListener('click', async () => {
    const status = $('#copy-status');
    try {
      await navigator.clipboard.writeText(summary.textContent);
      status.textContent = 'Summary copied. Share it only through a channel you trust.';
    } catch {
      status.textContent = 'Copy is unavailable in this browser. You can select the summary text and copy it manually.';
    }
  });

  answers.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const selected = button.querySelector('span')?.textContent || '';
    if (path === 'fraud') {
      const details = {
        'bank-contacted': 'Money moved or may be pending. The customer says they contacted their bank.',
        'cannot-reach-bank': 'Money movement is urgent. The customer cannot currently reach their bank.',
        'need-help': 'The customer needs a human explanation of a suspected fraud incident.',
        'suspicious-contact': 'The customer received a suspicious call or message.',
        'code-request': 'Someone requested an authentication code.',
        'unknown-transaction': 'The customer noticed a transaction they do not recognise.',
        'unsure-event': 'The customer is unsure what happened.'
      };
      if (Object.prototype.hasOwnProperty.call(details, incident)) finish(details[incident]);
    } else {
      const details = {
        'prepare-request': 'The customer wants to prepare a hardship-support request.',
        'human-support': 'The customer prefers to speak with a person.',
        'not-sure': 'The customer needs help identifying the right support route.'
      };
      if (Object.prototype.hasOwnProperty.call(details, incident)) finish(details[incident]);
    }
  });
})();
