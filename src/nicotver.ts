// @ts-ignore
import NiconiComments from '@xpadev-net/niconicomments';


let offset = 0;


async function play(channel: string, startTime: string, duration: number) {
  status('コメントの再生準備を開始します。')

  let dom!: ReturnType<typeof buildCanvas>;
  try {
    dom = buildCanvas();
    buildControl();
  } catch (e: any) {
    status(`DOMが構築できませんでした（${e.message} is not found）。`)
  }

  status('DOMの構築が完了しました。コメントの取得を開始します。');

  let comments = null;
  try {
    comments = await fetchComments(channel, startTime, duration);
    if (comments.length) {
      status('コメントの取得に成功しました。');
    } else {
      status('コメントの取得に成功しましたが、0件でした。');
      return;
    }
  } catch (e: any) {
    status(`コメントの取得に失敗しました（${e.message}）。`);
    return;
  }

  const niconiComments = new NiconiComments(dom.canvas, comments);
  setInterval(() => {
    const commentTime = Math.floor((dom.video!.currentTime + offset) * 100);
    niconiComments.drawCanvas(commentTime);
  }, 10);

  status('コメントを再生する準備が完了しました。');
}


function buildCanvas(): {canvas: HTMLCanvasElement, video: HTMLMediaElement} {

  const container = document.querySelector('video-js');
  if (!container) {
    throw new Error('container is not found.');
  }
  const canvas = document.createElement('canvas');
  canvas.setAttribute('style', 'position: absolute;top: 0;left: 0;width: 100%;height: 100%;');
  canvas.setAttribute('width', '1920');
  canvas.setAttribute('height', '1080');
  container.appendChild(canvas);

  const video = document.querySelector<HTMLMediaElement>('.vjs-tech');
  if (!video) {
    throw new Error('video is not found.');
  }

  return { canvas, video };
}


function buildControl() {
  const titles = document.querySelector('[class^=titles_container]');
  if (!titles) {
    throw new Error('titles is not found.');
  }
  const container = document.createElement('div');
  container.setAttribute('style', 'display: flex;');
  const label = document.createElement('div');
  label.setAttribute('style', 'margin-right: 15px;');
  label.innerHTML = 'コメント時間';
  const plus15 = buildControlButton('+15', 15);
  const minus15 = buildControlButton('-15', -15);
  const current = document.createElement('div');
  current.id = 'currentOffset';
  current.setAttribute('style', 'color: white; margin: 0 15px;');

  titles.parentNode!.insertBefore(container, titles);
  container.appendChild(label);
  container.appendChild(plus15);
  container.appendChild(current);
  container.appendChild(minus15);

  updateOffset(0);
}


function buildControlButton(label: string, delta: number) {
  const div = document.createElement('div');
  const button = document.createElement('button');
  button.setAttribute('style', 'background-color: transparent; color: white;');
  button.innerHTML = label;
  button.addEventListener('click', () => updateOffset(delta));
  return button;
}


function updateOffset(delta: number) {
  offset += delta;
  const current = document.getElementById('currentOffset')!;
  current.innerHTML = String(offset);
}


async function fetchComments(channel: string, startTime: string, duration: number) {
  const start = Math.floor(new Date(startTime).getTime() / 1000);
  const end = start + duration * 60;
  console.log(`https://jikkyo.tsukumijima.net/api/kakolog/${channel}?starttime=${start}&endtime=${end}&format=json`)
  const req = await fetch(`https://jikkyo.tsukumijima.net/api/kakolog/${channel}?starttime=${start}&endtime=${end}&format=json`);
  const json = await req.json();
  if (json.error) {
    console.error('[nicotver] faild to load comment.', json);
    throw new Error(json.error);
  }

  const rawComments = json.packet;
  const comments = rawComments.map((comment: any) => {
    const chat = comment.chat;
    if (chat) {
      chat.no = toNumber(chat.no);
      chat.date = toNumber(chat.date);
      chat.nicoru = toNumber(chat.nicoru);
      chat.premium = toNumber(chat.premium);
      chat.anonymity = toNumber(chat.anonymity);
      chat.score = toNumber(chat.score);

      // vposは生放送が始まってからの時間になっているので、コメントの投稿時刻とAPIの取得開始時刻を使って調整する
      const date = Number(`${chat.date}.${chat.date_usec}`);
      chat.vpos = Math.floor((date - start) * 100);
    }
    return comment;
  });
  return comments;
}


function toNumber(string: string): number {
  try {
    return (string) ? Number(string) : 0;
  } catch {
    return 0;
  }
}


function status(message: string) {
  console.log(`[nicotver] ${message}`);
  chrome.runtime.sendMessage(
    {
      type: 'STATUS',
      payload: { message },
    },
  );
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('request', request);
  if (request.type === 'PLAY') {
    const payload = request.payload;
    play(payload.channel, payload.startTime, payload.duration);
  }

  // Send an empty response
  // See https://github.com/mozilla/webextension-polyfill/issues/130#issuecomment-531531890
  sendResponse({});
  return true;
});
