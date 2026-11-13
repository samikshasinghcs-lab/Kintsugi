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
    progress.style.width = Math.round((step / total) * 100) + '%';
    progressLabel.textContent = 'Step ' + step + ' of ' + total;
    stepLabel.textContent = path === 'fraud' ? 'Fraud safety guide' : 'Payment support guide';
  }

  function renderOptions(options, onSelect) {
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
      button.addEventListener('click', () => onSelect(value));
      answers.append(button);
    });
  }

  function start(selectedPath) {
    path = selectedPath;
    urgency = '';
    nextStep = '';
    document.querySelectorAll('[data-path]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.path === selectedPath));
    });
    guide.classList.remove('hidden');
    result.classList.add('hidden');
    setProgress(1);
    message.textContent = paths[path].first;
    renderOptions(paths[path].options, path === 'fraud' ? handleFraud : handleHardship);
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
        ['I transferred money because someone instructed me', 'transfer-under-deception'],
        ['I cannot reach my bank', 'cannot-reach-bank'],
        ['I need a person to review this', 'human-review'],
        ['I need help understanding what happened', 'need-help']
      ], (answer) => finish({
        'bank-contacted': 'Money moved or may be pending. The customer says they contacted their bank.',
        'transfer-under-deception': 'The customer made a transfer because someone instructed or deceived them. Treat as urgent suspected fraud and request specialist bank review. Do not imply reimbursement is guaranteed.',
        'cannot-reach-bank': 'Money movement is urgent. The customer cannot currently reach their bank.',
        'human-review': 'The customer wants a human specialist to review a suspected fraud incident. This demo prepares a summary only; it does not send or route a case.',
        'need-help': 'The customer needs a human explanation of a suspected fraud incident.'
      }[answer]));
      return;
    }
    urgency = 'No immediate movement reported';
    nextStep = 'Do not reply to suspicious messages or share codes. If account access or transactions may be at risk, contact your bank through its official channel.';
    message.textContent = 'What happened that made you concerned?';
    renderOptions([
      ['I received a suspicious call or message', 'suspicious-contact'],
      ['Someone asked me to share a code', 'code-request'],
      ['I noticed an unknown transaction', 'unknown-transaction'],
      ['I am still unsure', 'unsure-event']
    ], (answer) => finish({
      'suspicious-contact': 'The customer received a suspicious call or message.',
      'code-request': 'Someone requested an authentication code.',
      'unknown-transaction': 'The customer noticed a transaction they do not recognise.',
      'unsure-event': 'The customer is unsure what happened.'
    }[answer]));
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
    ], (answer) => finish({
      'prepare-request': 'The customer wants to prepare a hardship-support request.',
      'human-support': 'The customer prefers to speak with a person.',
      'not-sure': 'The customer needs help identifying the right support route.'
    }[answer]));
  }

  function finish(detail) {
    setProgress(3);
    message.textContent = 'Here is a short summary you can take to your bank or a trusted adviser. Nothing has been sent or submitted.';
    answers.replaceChildren();
    summary.textContent = [
      'KINTSUGI — CUSTOMER-PREPARED SUMMARY',
      'Support area: ' + paths[path].title,
      'Situation: ' + detail,
      'Urgency: ' + (urgency || 'Not assessed'),
      'Suggested next step: ' + nextStep,
      '',
      'This summary was prepared in a local demo. No bank action or case submission has occurred.'
    ].join('\n');
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
    summary.textContent = '';
    $('#copy-status').textContent = '';
    document.querySelectorAll('[data-path]').forEach((button) => button.setAttribute('aria-pressed', 'false'));
    path = '';
    urgency = '';
    nextStep = '';
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
      status.textContent = 'Copy is unavailable in this browser. Select the summary text and copy it manually.';
    }
  });


  // Progressive scroll reveals and a gentle upward-moving hero artwork.
  document.documentElement.classList.add('js');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealTargets = document.querySelectorAll('.reveal, .reveal-section');
  if ('IntersectionObserver' in window && !reducedMotion) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealTargets.forEach((element) => revealObserver.observe(element));
  } else {
    revealTargets.forEach((element) => element.classList.add('is-visible'));
  }

  const heroBackdrop = document.querySelector('.hero-backdrop');
  let scrollQueued = false;
  function moveHeroArtwork() {
    if (!heroBackdrop || reducedMotion) return;
    const distance = Math.min(window.scrollY * -0.22, 0);
    heroBackdrop.style.setProperty('--hero-shift', distance + 'px');
    scrollQueued = false;
  }
  window.addEventListener('scroll', () => {
    if (!scrollQueued) {
      window.requestAnimationFrame(moveHeroArtwork);
      scrollQueued = true;
    }
  }, { passive: true });
  moveHeroArtwork();

})();