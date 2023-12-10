// @ts-ignore
import NiconiComments from '@xpadev-net/niconicomments';
import CHANNELS from './channels';
import './nicotver.scss';


let offset = 0;
let intervalId: number | null = null;

async function buildControl() {
  try {
    let titles = await getTitles();
    if (document.querySelector('.nicotver__controls')) return;  // 2重実行を防止する。awaitの後じゃないと2重に実行する隙がある
    titles.insertAdjacentHTML('beforebegin', HTMLS.CONTROL);
    reset(0);

    const info = getProgramInfo();
    const channel = document.querySelector<HTMLSelectElement>('.nicotver__condition__channel')!;
    if (info.channel) channel.value = info.channel;
    const date = document.querySelector<HTMLInputElement>('.nicotver__condition__date')!;
    if (info.date) date.value = info.date;

    const buttons = document.querySelectorAll<HTMLButtonElement>('.nicotver__offsets__button');
    for (let button of buttons) {
      button.addEventListener('click', () => {
        updateOffset(Number(button.dataset.offset) + offset);
      })
    }
    const offsetInput = document.querySelector<HTMLInputElement>('.nicotver__offsets__offset')!;
    offsetInput.addEventListener('input', () => {
      const newOffset = (offsetInput.value === '') ? null : Number(offsetInput.value);
      updateOffset(newOffset, false);
    })

    const execute = document.querySelector<HTMLButtonElement>('.nicotver__conditions__execute')!;
    execute.addEventListener('click', () => {
      const channel = document.querySelector<HTMLSelectElement>('.nicotver__condition__channel')!;
      const date = document.querySelector<HTMLInputElement>('.nicotver__condition__date')!;
      const time = document.querySelector<HTMLInputElement>('.nicotver__condition__time')!;
      const duration = document.querySelector<HTMLSelectElement>('.nicotver__condition__duration')!;
      prepareComment(
        channel.value,
        `${date.value}T${time.value}+09:00`,
        Number(duration.value)
      );
    });

    const scroll = document.querySelector('.nicotver__comments__button.-scroll')!;
    scroll.addEventListener('click', scrollToPlayingPosition);

    const parts = document.querySelectorAll<HTMLButtonElement>('.nicotver__comments__button.-part')!;
    for (let part of parts) {
      part.addEventListener('click', () => scrollToPart(part.dataset.part as string));
    }

  } catch (e) {
    alert('nicotverの初期化に失敗しました。');
    throw e;
  }
}


function getTitles() {
  return new Promise<Element>((resolve, reject) => {
    let retryCount = 0;
    let timer = setInterval(() => {
      const titles = document.querySelector('[class^=titles_container]');
      if (titles) {
        clearInterval(timer);
        resolve(titles);
      } else {
        if (retryCount < 30) {
          retryCount++;
        } else {
          clearInterval(timer);
          reject();
        }
      }
    }, 1000);
  });
}


function updateOffset(newOffset: number | null, updateInput = true) {
  offset = newOffset || 0;
  if (updateInput) {
    const current = document.querySelector<HTMLInputElement>('.nicotver__offsets__offset')!;
    current.value = String(offset);
  }
}


function getProgramInfo() {
  const metas = document.querySelectorAll('[class^=description_metaDetail]');
  if (metas.length === 0) return {};

  const info: {channel?: string, date?: string} = {};
  const [channel, date] = metas;
  const channelText = (channel as HTMLElement)?.innerText;
  const dateText = (date as HTMLElement)?.innerText;
  for (let name in CHANNELS) {
    if (channelText.startsWith(name)) {
      info.channel = CHANNELS[name];
      break;
    }
  }

  const m = dateText.match(/(\d+)月(\d+)日/);
  if (m) {
    // 番組の年は取得できないので今年と推定するが、その結果未来日になるようなら1年前と推定する
    const current = new Date();
    const year = current.getFullYear();
    const month = m[1].padStart(2, '0');
    const day = m[2].padStart(2, '0');
    const assumed = new Date(`${year}-${month}-${day}`);
    if (current.getTime() < assumed.getTime()) {
      assumed.setFullYear(assumed.getFullYear() - 1);
    }
    info.date = assumed.toISOString().substring(0, 10);
  }

  return info;
}


async function prepareComment(channel: string, startTime: string, duration: number) {
  status('コメントの描画領域を構築しています・・・')

  let dom!: ReturnType<typeof buildCanvas>;
  try {
    reset();
    dom = buildCanvas();
  } catch (e: any) {
    status(`TVer側の準備がまだできていないかもです。少し待ってコメントを再取得してください。（${e.message} is not found）。`)
    return;
  }

  status('コメントを取得しています・・・');

  let comments = null;
  try {
    comments = await loadComments(channel, startTime, duration);
    if (!comments.length) {
      status('コメントの取得に成功しましたが、0件でした。');
      return;
    }
  } catch (e: any) {
    status(`コメントの取得に失敗しました（${e.message}）。`);
    return;
  }

  status('コメント描画の前処理をしています・・・');

  buildComments(comments);

  const niconiComments = new NiconiComments(dom.canvas, comments);
  intervalId = setInterval(() => {
    const commentTime = Math.floor((dom.video!.currentTime + offset) * 100);
    niconiComments.drawCanvas(commentTime);
  }, 10);

  status('コメントを再生する準備が完了しました！');
}


function reset(newOffset = offset) {
  updateOffset(newOffset);
  if (intervalId !== null) clearInterval(intervalId);
  const canvas = document.querySelector('.nicotver__canvas');
  if (canvas) canvas.remove();
  const body = document.querySelector('.nicotver__comments tbody');
  if (body) body.replaceChildren();
}


function buildCanvas(): {canvas: HTMLCanvasElement, video: HTMLMediaElement} {
  const container = document.querySelector('video-js');
  if (!container) {
    throw new Error('container is not found.');
  }
  container.insertAdjacentHTML('beforeend', HTMLS.CANVAS);
  const canvas = document.querySelector<HTMLCanvasElement>('.nicotver__canvas')!;

  const video = document.querySelector<HTMLMediaElement>('.vjs-tech');
  if (!video) {
    throw new Error('video is not found.');
  }

  return { canvas, video };
}


async function loadComments(channel: string, startTime: string, duration: number) {
  const start = Math.floor(new Date(startTime).getTime() / 1000);
  const end = start + duration * 60;
  const req = await fetch(`https://jikkyo.tsukumijima.net/api/kakolog/${channel}?starttime=${start}&endtime=${end}&format=json`);
  const json = await req.json() as {packet?: [any], error?: string};
  if (json.error) {
    console.error('[nicotver] faild to load comment.', json);
    throw new Error(json.error);
  }

  const rawComments = json.packet!;
  const comments = rawComments.map((comment) => {
    const chat = comment.chat;
    if (chat) {
      ['no', 'date', 'nicoru', 'premium', 'anonymity', 'score'].forEach(prop => {
        chat[prop] = toNumber(chat[prop]);
      });

      // vposは生放送が始まってからの時間になっているので、コメントの投稿時刻とAPIの取得開始時刻を使って調整する
      const date = Number(`${chat.date}.${chat.date_usec}`);
      chat.vpos = Math.floor((date - start) * 100);
    }
    return comment as Comment;
  });

  return comments;
}


function buildComments(comments: Array<Comment>) {
  const body = document.querySelector('.nicotver__comments tbody')!;
  const trs = comments.map(comment => {
    const chat = comment.chat;

    const tr = document.createElement('tr');  // 一応XSS考慮してcreateElementでいきます
    tr.title = chat.content;
    tr.classList.add('nicotver__comments__row');
    tr.dataset.vpos = String(chat.vpos);
    tr.addEventListener('click', updateOffsetToComment);

    const timeTd = document.createElement('td');
    timeTd.textContent = vposToTime(chat.vpos);
    timeTd.classList.add('nicotver__comments__time');
    tr.appendChild(timeTd);

    const commentTd = document.createElement('td');
    commentTd.textContent = chat.content;
    commentTd.classList.add('nicotver__comments__comment');
    tr.appendChild(commentTd);

    return tr;
  });
  body.append(...trs);
}

function updateOffsetToComment(e: Event) {
  const video = document.querySelector<HTMLMediaElement>('.vjs-tech');
  if (!video) return;
  const vpos = Number((e.currentTarget as HTMLTableRowElement).dataset.vpos);
  updateOffset(Math.floor(vpos / 100 - video.currentTime));
}

function scrollToPlayingPosition() {
  const comments = document.querySelectorAll<HTMLTableRowElement>('.nicotver__comments__wrapper tbody tr');
  const video = document.querySelector<HTMLMediaElement>('.vjs-tech');
  if (!video) return;

  const currentVpos = (video.currentTime + offset) * 100;
  let currentComment = Array.from(comments).find(comment => {
    return Number(comment.dataset.vpos) > currentVpos;
  });
  if (!currentComment) {
    currentComment = comments[comments.length - 1];
    if (!currentComment) return;
  }

  scrollToComment(currentComment);
}

function scrollToComment(comment: HTMLTableRowElement) {
  const wrapper = document.querySelector('.nicotver__comments__wrapper')!;
  const header = wrapper.querySelector<HTMLTableRowElement>('thead tr')!;
  const wrapperHeight = wrapper.getBoundingClientRect().height;
  const headerHeight = header.getBoundingClientRect().height;
  wrapper.scrollTop = comment.offsetTop - headerHeight - wrapperHeight / 2;
}

function scrollToPart(part: string) {
  const comments = document.querySelectorAll<HTMLTableRowElement>('.nicotver__comments__wrapper tbody tr');
  let count = 0;
  for (let comment of comments) {
    const text = comment.querySelector('.nicotver__comments__comment')?.textContent;
    const nomalized = normalize(text);
    if (nomalized === part) {
      count++;
    }
    if (count >= 5) {
      scrollToComment(comment);
      return;
    }
  }
  alert(`${part}パートと思しき箇所が見つかりませんでした。`);
}

function normalize(str: string | null | undefined) {
  return (str || '').replace(/[Ａ-Ｚａ-ｚ０-９！-～]/g, function(s) {
      return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
  }).toUpperCase();
}


function toNumber(string: string): number {
  try {
    return (string) ? Number(string) : 0;
  } catch {
    return 0;
  }
}

function vposToTime(vpos: number) {
  const secondVpos = Math.floor(vpos / 100);
  const minute = Math.floor(secondVpos / 60);
  const second = String(secondVpos % 60).padStart(2, '0');
  return `${minute}:${second}`;
}


function status(message: string) {
  console.log(`[nicotver] ${message}`);
  const status = document.querySelector('.nicotver__status')!;
  status.innerHTML = message;
}




chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'NAVIGATION') {
    onNavigation(request.payload.details.url);
  }

  // Send an empty response
  // See https://github.com/mozilla/webextension-polyfill/issues/130#issuecomment-531531890
  sendResponse({});
  return true;
});

// background.ts → nicotver.tsの順で実行されるので、初回はbackgroundからのBUILD_CONTROLメッセージを受け取る先がなくて
// エラーが発生する問題の対応として、nicotver実行後にbackgroundを初期化する
chrome.runtime.sendMessage({ type: 'OBSERVE_NAVIGATION' });

function onNavigation(url: string) {
  // console.log('onNavigation', url)
  // TVerがNextJSを使用しているため？manifest.jsonのmatchesを"*://tver.jp/episodes/*"にしていると
  // 視聴ページ以外からTVerに入ってから視聴ページに遷移した場合、nicotverが読み込まれなくなる。
  // そのためmatchesを"*://tver.jp/*"とし、Controlはepisodes以下だけで表示するようにする。
  if (url.match(/:\/\/tver\.jp\/episodes\/.+/)) {
    buildControl();
  }
}



onNavigation(window.location.href);




const HTMLS = {
  CANVAS: `<canvas class="nicotver__canvas" width="1920" height="1080"></canvas>`,
  CONTROL: `
    <section class="nicotver__controls">

      <div class="nicotver__load">
        <dl class="nicotver__conditions">
          <div class="nicotver__condition">
            <dt>チャンネル</dt>
            <dd>
              <select class="nicotver__condition__channel">
                <optgroup label="地デジ">
                  <option value="jk1">jk1: NHK総合</option>
                  <option value="jk2">jk2: NHK Eテレ </option>
                  <option value="jk4">jk4: 日本テレビ</option>
                  <option value="jk5">jk5: テレビ朝日</option>
                  <option value="jk6">jk6: TBSテレビ</option>
                  <option value="jk7">jk7: テレビ東京</option>
                  <option value="jk8">jk8: フジテレビ</option>
                  <option value="jk9">jk9: TOKYO MX</option>
                  <option value="jk10">jk10: テレ玉</option>
                  <option value="jk11">jk11: tvk</option>
                  <option value="jk12">jk12: チバテレビ</option>
                </optgroup>
                <optgroup label="BS・CS">
                  <option value="jk101">jk101: NHK BS1</option>
                  <option value="jk103">jk103: NHK BSプレミアム</option>
                  <option value="jk141">jk141: BS日テレ</option>
                  <option value="jk151">jk151: BS朝日</option>
                  <option value="jk161">jk161: BS-TBS</option>
                  <option value="jk171">jk171: BSテレ東</option>
                  <option value="jk181">jk181: BSフジ</option>
                  <option value="jk191">jk191: WOWOW PRIME</option>
                  <option value="jk192">jk192: WOWOW LIVE</option>
                  <option value="jk193">jk193: WOWOW CINEMA</option>
                  <option value="jk211">jk211: BS11</option>
                  <option value="jk222">jk222: BS12 トゥエルビ</option>
                  <option value="jk236">jk236: BSアニマックス</option>
                  <option value="jk252">jk252: WOWOW PLUS</option>
                  <option value="jk260">jk260: BS松竹東急</option>
                  <option value="jk263">jk263: BSJapanext</option>
                  <option value="jk265">jk265: BSよしもと</option>
                  <option value="jk333">jk333: AT-X</option>
                </optgroup>
              </select>
            </dd>
          </div>
          <div class="nicotver__condition">
            <dt>開始日時</dt>
            <dd>
              <input class="nicotver__condition__date" type="date">
              <input class="nicotver__condition__time" type="time" value="00:00">
            </dd>
          </div>
          <div class="nicotver__condition">
            <dt>番組時間</dt>
            <dd>
              <select class="nicotver__condition__duration">
                <option value="5" selected>5分</option>
                <option value="15">15分</option>
                <option value="30">30分</option>
                <option value="60">60分</option>
                <option value="90">90分</option>
                <option value="120">120分</option>
                <option value="150">150分</option>
                <option value="180">180分</option>
              </select>
            </dd>
          </div>
        </dl>

        <button class="nicotver__conditions__execute">コメント取得</button>

        <div class="nicotver__offsets">
          <div>コメント時間オフセット</div>
          <button class="nicotver__offsets__button" data-offset="-15">-15</button>
          <div class="nicotver__offsets__offsetWrapper">
            <input class="nicotver__offsets__offset" type="text" value="0">秒
          </div>
          <button class="nicotver__offsets__button" data-offset="15">+15</button>
        </div>

        <p class="nicotver__status"></p>
      </div>

      <div class="nicotver__comments">
        <div class="nicotver__comments__buttons">
          <button class="nicotver__comments__button -scroll">再生位置までスクロール</button>
          <button class="nicotver__comments__button -part" data-part="A">A</button>
          <button class="nicotver__comments__button -part" data-part="B">B</button>
          <button class="nicotver__comments__button -part" data-part="C">C</button>
        </div>
        <div class="nicotver__comments__wrapper">
          <table>
            <thead>
              <tr>
                <th>時間</th>
                <th>コメント</th>
              </tr>
            </thead>
            <tbody>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `
}


type Comment = {
  chat: {
    thread: string;
    no: number;
    vpos: number;
    date: number;
    mail: string;
    user_id: string;
    anonymity: number;
    date_usec: number;
    content: string;
  }
};
