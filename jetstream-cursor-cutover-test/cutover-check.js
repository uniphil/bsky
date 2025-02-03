"use strict";

// diagnostics on page
const streamSelect = document.querySelector('.stream');
const streamInfo = document.querySelector('.stream-info');
const button = document.querySelector('.start');
const tailingEl = document.querySelector('.tailing');
const catchingEl = document.querySelector('.catching');
const results = document.querySelector('.results');

let wsTailing, wsCatching; // websockets
let stream;
let tail, recovered; // arrays of event time_us

const CATCH_UP_AFTER_US = 1500000; // presumably must be more than 1s (jetstream's "cutoverThresholdUS")
const FOLLOW_FOR = 1500000;

button.addEventListener('click', function toggleGo() {
  if (!wsTailing) begin();
  else end();
});

function begin() {
  stream = streamSelect.value;
  streamSelect.disabled = true;
  streamInfo.textContent = `using ${stream}`;

  const wsUrl = 'wss://' + stream + '/subscribe';
  wsTailing = new WebSocket(wsUrl);
  wsTailing.onopen = () => {
    tailingEl.textContent = 'tail: connected';
    button.textContent = 'stop';
  };
  wsTailing.onclose = e => {
    tailingEl.textContent = 'tail: disconnected';
    streamInfo.textContent = '';
    button.textContent = 'restart';
    if (e.reason) console.warn('tail closed for reason', e);
    wsTailing = null;
  };
  wsTailing.onerror = e => {
    console.error('tailing:', e);
    wsTailing.close();
  };
  wsTailing.onmessage = getTime(handleTimeTailing);

  tail = [];
  recovered = null;
  results.textContent = null;
  button.textContent = 'connecting';
}

function beginCatchup(first_t) {
  const wsUrl = 'wss://' + stream + '/subscribe?cursor=' + first_t;

  wsCatching = new WebSocket(wsUrl);
  wsCatching.onopen = () => {
    catchingEl.textContent = 'catch: connected';
  };
  wsCatching.onclose = e => {
    catchingEl.textContent = 'catch: disconnected';
    if (e.reason) console.warn('catch closed for reason', e);
    wsCatching = null;
  };
  wsCatching.onerror = e => {
    console.error('tailing:', e);
    wsCatching.close();
  };
  wsCatching.onmessage = getTime(handleTimeCatching, null);

  recovered = [];
}

const getTime = (then, extra) => message => {
  if (!message.data) {
    console.warn('missing message data.');
    return;
  }
  let data;
  try {
    data = JSON.parse(message.data);
  } catch (e) {
    console.warn('failed to parse message json.');
    return;
  }
  let time = data.time_us;
  if (!time) {
    console.warn('message json was missing time_us.');
    return;
  }
  then(time, extra);
}

function handleTimeTailing(t) {
  tail.push(t);
  const first_t = tail[0];
  const dt = t - first_t;

  tailingEl.textContent = `tail: now at ${t} (${(dt / 1000000).toFixed(1)})`;
  if (recovered === null && dt > CATCH_UP_AFTER_US) {
    beginCatchup(first_t);
  } else if (dt > (CATCH_UP_AFTER_US + FOLLOW_FOR)) {
    end(stream);
  }
}

function handleTimeCatching(t) {
  recovered.push(t);
  catchingEl.textContent = `catchup: now at ${t} (${((tail[tail.length-1] - t) / 1000000).toFixed(1)})`;
}

function end() {
  wsTailing.close();
  if (wsCatching) wsCatching.close();
  streamSelect.disabled = false;

  const classed = (t, cls) => {
    const el = document.createElement('span');
    el.classList.add(cls);
    el.textContent = t;
    return el;
  }
  const start = tail[0];

  results.textContent = `results for ${stream}:

dt\ttailed event time\tcursor catchup event time`;

  let holdback = 0;
  let misses = 0;
  let disordered = 0;
  let weirds = 0;

  tail.forEach((t, i) => {
    const dt = ((t - start) / 1000000).toFixed(2);
    const r = recovered[i-holdback];
    results.appendChild(document.createElement('br'));
    if (t === r) {
      results.appendChild(classed(`${dt}\t${t}\t${r}`, 'nice'));
    } else if (t < r) {
      holdback += 1;
      misses += 1;
      results.appendChild(classed(`${dt}\t${t}`, 'boo'));
    } else if ((i-holdback) >= recovered.length) {
      // r is done
      results.appendChild(classed(`${dt}\t${t}`, 'plain'));
    } else {
      if (holdback > 0) holdback -= 1;
      const weirdDt = ((r - t) / 1000000).toFixed(2);
      if (tail.slice(0, i+1).includes(r)) {
        results.appendChild(classed(`${dt}\t${t}\t${r} (${weirdDt})`, 'hmm'));
        disordered += 1;
      } else {
        results.appendChild(classed(`${dt}\t${t}\t${r} (${r - t} ???)`, 'boo'));
        weirds += 1;
      }
    }
  });

  results.appendChild(classed(`

total from tail:   ${tail.length}. First: ${tail[0]}, last: ${tail[tail.length-1]}
total from cursor: ${recovered.length}. First: ${recovered[0]}, last: ${recovered[recovered.length-1]}

initial misses: ${misses}
out of order(?) events: ${disordered}
weird events: ${weirds}

cursor websocket finished with: ${holdback} events missing

`, 'plain'));

  stream = null;
}
