// @ts-ignore
import NiconiComments from '@xpadev-net/niconicomments';
import './nicotver.scss';


let offset = 0;
let intervalId: number | null = null;


function buildControl(retryCount = 0) {
  const titles = document.querySelector('[class^=titles_container]');
  if (!titles) {
    if (retryCount < 30) {
      console.log({retryCount})
      setTimeout(() => buildControl(++retryCount), 1000);
    } else {
      alert('nicotverの初期化に失敗しました。');
    }
    return;
  }

  titles.insertAdjacentHTML('beforebegin', HTMLS.CONTROL);
  updateOffset(0);

  const buttons = document.querySelectorAll<HTMLButtonElement>('.nicotver__offsets__button');
  for (let button of buttons) {
    button.addEventListener('click', () => {
      updateOffset(Number(button.dataset.offset));
    })
  }

  const execute = document.querySelector<HTMLButtonElement>('.nicotver__conditions__execute')!;
  execute.addEventListener('click', () => {
    const channel = document.querySelector<HTMLSelectElement>('.nicotver__conditions__channel')!;
    const date = document.querySelector<HTMLInputElement>('.nicotver__conditions__date')!;
    const time = document.querySelector<HTMLInputElement>('.nicotver__conditions__time')!;
    const duration = document.querySelector<HTMLSelectElement>('.nicotver__conditions__duration')!;
    prepareComment(
      channel.value,
      `${date.value}T${time.value}+09:00`,
      Number(duration.value)
    );
  });
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

  const niconiComments = new NiconiComments(dom.canvas, comments);
  intervalId = setInterval(() => {
    const commentTime = Math.floor((dom.video!.currentTime + offset) * 100);
    niconiComments.drawCanvas(commentTime);
  }, 10);

  status('コメントを再生する準備が完了しました！');
}


function reset() {
  offset = 0;
  if (intervalId !== null) clearInterval(intervalId);
  const canvas = document.querySelector('.nicotver__canvas');
  if (canvas) canvas.remove();
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


function updateOffset(delta: number) {
  offset += delta;
  const current = document.querySelector<HTMLInputElement>('.nicotver__offsets__offset')!;
  current.value = String(offset);
}


async function loadComments(channel: string, startTime: string, duration: number) {
  const start = Math.floor(new Date(startTime).getTime() / 1000);
  const end = start + duration * 60;
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
      ['no', 'date', 'nicoru', 'premium', 'anonymity', 'score'].forEach(prop => {
        chat[prop] = toNumber(chat[prop]);
      });

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
  const status = document.querySelector('.nicotver__status')!;
  status.innerHTML = message;
}




buildControl();







const HTMLS = {
  CANVAS: `<canvas class="nicotver__canvas" width="1920" height="1080"></canvas>`,
  CONTROL: `
    <section class="nicotver__controls">

      <div class="nicotver__load">
        <dl class="nicotver__conditions">
          <dt>チャンネル</dt>
          <dd>
            <select class="nicotver__conditions__channel">
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
            </select>
          </dd>
          <dt>開始日時</dt>
          <dd>
            <input class="nicotver__conditions__date" type="date">
            <input class="nicotver__conditions__time" type="time" value="00:00">
          </dd>
          <dt>番組時間</dt>
          <dd>
            <select class="nicotver__conditions__duration">
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
          <button class="nicotver__conditions__execute">コメント取得</button>
        </dl>
        <p class="nicotver__status"></p>
      </div>

      <div class="nicotver__offsets">
        <div>コメント時間オフセット</div>
        <button class="nicotver__offsets__button" data-offset="-15">-15</button>
        <input class="nicotver__offsets__offset" type="text">
        <button class="nicotver__offsets__button" data-offset="15">+15</button>
      </div>
    </section>
  `
}