
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'OBSERVE_NAVIGATION') {
    observeNavigation();
  }

  // Send an empty response
  // See https://github.com/mozilla/webextension-polyfill/issues/130#issuecomment-531531890
  sendResponse({});
  return true;
});

function observeNavigation() {
  chrome.webNavigation.onHistoryStateUpdated.addListener(function(details) {

    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tab = tabs[0];
      chrome.tabs.sendMessage(tab.id!, {
        type: 'NAVIGATION',
        payload: {
          details
        }
      });
    });
  });
}