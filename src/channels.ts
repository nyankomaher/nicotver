const CHANNELS: {[key: string]: string} = {};

function registerChannels(code: string, channelsString: string) {
  channelsString.split('\n')
    .map(c => c.trim())
    .filter(c => c)
    .forEach(c => CHANNELS[c] = code);
}

registerChannels('jk1', 'NHK総合');
registerChannels('jk2', 'NHK Eテレ');

registerChannels('jk4', `
  日テレ
  読売テレビ
  中京テレビ
  札幌テレビ
  FBS福岡放送
  RAB青森放送
  テレビ岩手
  福島中央テレビ
  山梨放送
  TeNY
  テレビ信州
  福井放送
  Daiichi-TV
  日本海テレビ
  広島テレビ
  山口放送
  四国放送
  南海放送
  高知放送
  長崎国際テレビ
  KKTくまもと県民テレビ
  鹿児島読売テレビ
  BS日テレ
`);

registerChannels('jk5', `
  テレビ朝日
  ABCテレビ
  KBCテレビ
  KFB福島放送
  新潟テレビ21
  静岡朝日テレビ
  広島ホームテレビ
  愛媛朝日テレビ
  KAB熊本朝日放送
`);

registerChannels('jk6', `
  TBS
  MBS毎日放送
  CBCテレビ
  HBC北海道放送
  RKB毎日放送
  TUYテレビユー山形
  TUFテレビユー福島
  BSN
  SBC信越放送
  チューリップテレビ
  MRO
  SBSテレビ
  BSS山陰放送
  RSK山陽放送
  RCCテレビ
  RKK熊本放送
`);

registerChannels('jk7', `
  テレビ東京
  テレビ大阪
  TVQ九州放送
  テレビ北海道
`);

registerChannels('jk8', `
  フジテレビ
  関西テレビ
  東海テレビ
  北海道文化放送
  テレビ西日本
  仙台放送
  秋田テレビ
  福島テレビ
  福井テレビ
  さんいん中央テレビ
  OHK岡山放送
  テレビ新広島
  テレビ愛媛
  テレビ長崎
  テレビ熊本
  沖縄テレビ
`);

registerChannels('jk9', 'TOKYO MX');
registerChannels('jk10', 'テレ玉');
registerChannels('jk11', 'tvk');
registerChannels('jk12', 'チバテレ');
registerChannels('jk141', 'ＢＳ日テレ');
registerChannels('jk151', 'ＢＳ朝日');
registerChannels('jk161', 'BS-TBS');
registerChannels('jk171', 'ＢＳテレ東');
registerChannels('jk181', 'ＢＳフジ');
registerChannels('jk211', 'BS11');
registerChannels('jk222', 'BS12');


export default CHANNELS;