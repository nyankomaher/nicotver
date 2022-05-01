'use strict';

import './popup.css';

(function() {
  document.addEventListener('DOMContentLoaded', () => {
    const playButton = document.getElementById('play');
    playButton?.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        const tab = tabs[0];
        const channel = document.getElementById('channel') as HTMLSelectElement;
        const date = document.getElementById('date') as HTMLInputElement;
        const time = document.getElementById('time') as HTMLInputElement;
        const duration = document.getElementById('duration') as HTMLSelectElement;
        chrome.tabs.sendMessage(tab.id!, {
          type: 'PLAY',
          payload: {
            channel: channel.value,
            startTime: `${date.value}T${time.value}+09:00`,
            duration: duration.value,
          }
        });
      });
    })
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'STATUS') {
      const status = document.getElementById('status');
      status!.innerHTML = request.payload.message;
    }

    // Send an empty response
    // See https://github.com/mozilla/webextension-polyfill/issues/130#issuecomment-531531890
    sendResponse({});
    return true;
  });

})();
