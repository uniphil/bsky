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
let tail, catchup; // arrays of event time_us

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
  catchup = null;
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

  catchup = [];
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
  if (catchup === null && dt > CATCH_UP_AFTER_US) {
    beginCatchup(first_t);
  } else if (dt > (CATCH_UP_AFTER_US + FOLLOW_FOR)) {
    end(stream);
  }
}

function handleTimeCatching(t) {
  catchup.push(t);
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

  let catchup_offset = 0;

  let oks = 0;
  let misses = 0;
  let finds = 0;
  let disordered = 0;

  tail.forEach((t, i) => {
    const dt = ((t - start) / 1000000).toFixed(2);
    let catchup_i = i - catchup_offset;
    let c = catchup[catchup_i];
    results.appendChild(document.createElement('br'));

    if (t === c) {
      // normal case: same time_us from tail and catchup
      results.appendChild(classed(`${dt}\t${t}\t${c}`, 'nice'));
      oks += 1;

    } else if (c > t) {
      // catchup time jumped ahead of tail: we probably lost events
      catchup_offset += 1;
      results.appendChild(classed(`${dt}\t${t}`, 'boo'));
      misses += 1;

    } else if ((i-catchup_offset) >= catchup.length) {
      // inconsequential: tail usually receives events first, so it often finishes with one extra
      results.appendChild(classed(`${dt}\t${t}`, 'plain'));

    } else { // c < t
      // catchup fell *behind* tail: catchup is out of order, or something very weird

      // out-of-order case appears as a "live" event jumping ahead of other catchup events
      const prev_c = catchup[catchup_i-1];
      const fell_behind = c < prev_c;
      if (!fell_behind) {
        results.appendChild(classed(`ERR: unexpected weird case: catchup fell behind tail but not itself`, 'boo'));
        throw new Error('weird: catchup fell behind tail but not itself');
      }

      disordered += 1; // single count for each series of disoredered events in catchup

      // roll the catchup events forward until they meet up with tail again
      while (c < t) {
        if (!tail.slice(0, i).includes(c)) {
          results.appendChild(classed(`ERR: unexpected weird case: catchup has an event that we didn't see in tail yet`, 'boo'));
          throw new Error('weird: catchup had extra event');
        }
        results.appendChild(classed(`\t                   \t${c}`, 'hmm'));
        results.appendChild(document.createElement('br'));
        finds += 1; // we presumably missed the event before, but found it now.

        catchup_offset -= 1;
        catchup_i = i - catchup_offset;
        c = catchup[catchup_i];
      }
      // catchup caught up, need to now print the normal case
      results.appendChild(classed(`${dt}\t${t}\t${c}`, 'nice'));

    }
  });

  const tail_dups = tail.length - new Set(tail).size;
  const catchup_dups = catchup.length - new Set(catchup).size;

  results.appendChild(classed(`

total from tail:    ${tail.length}. First: ${tail[0]}, last: ${tail[tail.length-1]}, duplicates: ${tail_dups}
total from catchup: ${catchup.length}. First: ${catchup[0]}, last: ${catchup[catchup.length-1]}, duplicates: ${catchup_dups}

initial misses: ${misses}
eventual finds: ${finds} (catchup events that did show up later, after an out-of-order event)
out-of-order occurrences: ${disordered}

catchup websocket finished with a ${catchup_offset}-event offset (likely the total count of missed events)

`, 'plain'));

  stream = null;
}
