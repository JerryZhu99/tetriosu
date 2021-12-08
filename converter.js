
const maniaTemplate = ({
  title = '',
  artist = '',
  creator = 'tetriosumania',
  version = '',
  tag = '',
  keyCount = 8,
  hitObjects = '',
}) => {
  return `osu file format v14

[General]
AudioFilename: audio.mp3
AudioLeadIn: 0
PreviewTime: -1
Countdown: 0
SampleSet: None
StackLeniency: 0.7
Mode: 3
LetterboxInBreaks: 0
WidescreenStoryboard: 1

[Editor]
DistanceSpacing: 0.3
BeatDivisor: 6
GridSize: 32
TimelineZoom: 1

[Metadata]
Title:${title}
TitleUnicode:${title}
Artist:${artist}
ArtistUnicode:${artist}
Creator:${creator}
Version:${version}
Source:TETR.IO
Tags:${tag}
BeatmapID:0
BeatmapSetID:-1

[Difficulty]
HPDrainRate:8
CircleSize:${keyCount}
OverallDifficulty:8
ApproachRate:5
SliderMultiplier:1.4
SliderTickRate:1

[Events]
//Background and Video events
//Break Periods
//Storyboard Layer 0 (Background)
//Storyboard Layer 1 (Fail)
//Storyboard Layer 2 (Pass)
//Storyboard Layer 3 (Foreground)
//Storyboard Layer 4 (Overlay)
//Storyboard Sound Samples

[TimingPoints]
0,500,4,2,0,100,1,0


[HitObjects]
${hitObjects}
`
}


const defaultReleaseKeys = ['moveLeft', 'softDrop', 'moveRight']

const defaultMapping = [
  'rotate180', 'hold', 'rotateCCW', 'rotateCW', 'hardDrop', 'moveLeft', 'softDrop', 'moveRight'
]

const defaultOptions = {
  offset: 0,
  playerIndex: 0,
  roundIndex: 0,
}

const getInputs = (events, offset = 0) => events
  .filter(e => ['keydown', 'keyup'].includes(e.type))
  .map(e => ({
    type: e.type,
    time: (e.frame + e.data.subframe) * 1000 / 60.0 + offset,
    key: e.data.key,
  }))

const convertInputs = (inputs, mapping, releaseKeys, offset) => {
  const keysHeld = new Map();
  const notes = [];

  inputs.forEach(({ type, time, key }) => {
    if (!mapping.includes(key)) return;

    if (type === 'keydown') {
      const note = {
        time,
        lane: mapping.indexOf(key),
      };
      notes.push(note);
      keysHeld.set(key, note);
    } else if (releaseKeys.includes(key)) {
      const note = keysHeld.get(key);
      note.isHold = true;
      note.endTime = time;
    }
  });

  const keyCount = mapping.length;

  const hitObjects = notes.map(note => {
    const x = Math.round((note.lane + 0.5) * 512 / keyCount);
    const y = 192;
    const time = Math.floor(note.time);
    const type = note.isHold ? 128 : 1;
    const hitSound = 0;
    const endTime = Math.floor(note.endTime);
    const hitSample = '0:0:0:0:';

    return [x, y, time, type, hitSound,
      note.isHold ? `${endTime}:${hitSample}` : hitSample].join(',');
  }).join('\n');

  return hitObjects;
}

const convertTtr = (
  ttrData,
  mapping = defaultMapping,
  releaseKeys = defaultReleaseKeys,
  options = defaultOptions
) => {
  const { user, endcontext, gametype, data } = ttrData;
  const { username } = user;
  const { score, finalTime } = endcontext;
  const { offset } = options;

  let title = '';
  if (gametype === 'blitz') {
    title = `TETR.IO BLITZ - ${score} by ${username.toUpperCase()}`
  } else {
    title = `TETR.IO 40L - ${(finalTime / 1000.0).toFixed(3)}s by ${username.toUpperCase()}`
  }

  const artist = username.toUpperCase();
  const version = gametype === 'blitz' ? score : `${(finalTime / 1000.0).toFixed(3)}s`
  const keyCount = mapping.length;

  const inputs = getInputs(data.events, offset);
  const hitObjects = convertInputs(inputs, mapping, releaseKeys, offset);

  return maniaTemplate({
    title, artist, version, keyCount, hitObjects
  });
}

const convertTtrm = (
  ttrmData,
  mapping = defaultMapping,
  releaseKeys = defaultReleaseKeys,
  options = defaultOptions,
) => {
  const { endcontext, gametype, data } = ttrmData;
  const { offset, roundIndex, playerIndex } = options;

  const user = endcontext[playerIndex];
  const username = user.user.username.toUpperCase();
  const user1 = endcontext[0].user.username.toUpperCase();
  const user2 = endcontext[1].user.username.toUpperCase();

  let title = '';
  if (gametype === 'league') {
    title = `TETRA LEAGUE - ${user1} vs. ${user2}`
  } else {
    title = `TETR.IO VERSUS - ${user1} vs. ${user2}`
  }

  const artist = username.toUpperCase();
  const version = `${username.toUpperCase()} - Round ${roundIndex + 1}/${data.length}`
  const keyCount = mapping.length;

  const events = data[roundIndex].replays[playerIndex].events;
  const inputs = getInputs(events, offset);
  const hitObjects = convertInputs(inputs, mapping, releaseKeys, offset);

  return maniaTemplate({
    title, artist, version, keyCount, hitObjects
  });
}

const fileInput = document.getElementById('file-input');
const options = document.getElementById('options');
const saveButton = document.getElementById('save-button');

const readFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(file, 'UTF-8');
    reader.addEventListener('load', e => resolve(e.target.result));
    reader.addEventListener('error', reject);
  });
};

const saveFile = (data, filename, type) => {
  console.log(data)
  var file = new Blob([data]);
  const a = document.createElement("a");
  const url = URL.createObjectURL(file);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}


const initOptions = () => {
  const createKeyOption = (value, num) => {
    return `
<label class="col-sm-2 col-form-label">Key ${num + 1}</label>
<div class="col-sm-5">
  <select class="form-select" id="key-${num}-select">
    <option value="" ${num === 0 ? 'selected' : ''}>None</option>
    <option value="rotate180" ${num === 0 ? 'selected' : ''}>Rotate 180</option>
    <option value="hold" ${num === 1 ? 'selected' : ''}>Hold</option>
    <option value="rotateCCW" ${num === 2 ? 'selected' : ''}>Rotate CCW</option>
    <option value="rotateCW" ${num === 3 ? 'selected' : ''}>Rotate CW</option>
    <option value="hardDrop" ${num === 4 ? 'selected' : ''}>Hard Drop</option>
    <option value="moveLeft" ${num === 5 ? 'selected' : ''}>Move Left</option>
    <option value="softDrop" ${num === 6 ? 'selected' : ''}>Soft Drop</option>
    <option value="moveRight" ${num === 7 ? 'selected' : ''}>Move Right</option>
  </select>
</div>
<div class="col-sm-5">
  <div class="form-check">
    <input class="form-check-input" type="checkbox" id="key-${num}-release" ${defaultReleaseKeys.includes(value) ? 'checked' : ''}>
    <label class="form-check-label" for="key-${num}-release">
      Include Release
    </label>
  </div>
</div>
`
  }

  const html = defaultMapping.map(createKeyOption).join('')
  options.innerHTML = html;
}

const roundSelect = document.getElementById('round-select');
const playerSelect = document.getElementById('player-select');
const offsetInput = document.getElementById('offset')

initVersusOptions = async () => {
  const file = fileInput.files[0];
  if (file && file.name.endsWith('.ttrm')) {
    const fileData = JSON.parse(await readFile(file));
    const numRounds = fileData.data.length;
    roundSelect.options.length = 0;
    for (let i = 0; i < numRounds; i++) {
      roundSelect.options[i] = new Option(i + 1, i);
    }

    const players = fileData.endcontext.map(e => e.user.username);
    playerSelect.options.length = 0;
    for (let i = 0; i < players.length; i++) {
      playerSelect.options[i] = new Option(players[i], i);
    }
    roundSelect.disabled = false;
    playerSelect.disabled = false;
  } else {
    roundSelect.options.length = 0;
    playerSelect.options.length = 0;
    roundSelect.options[0] = new Option('N/A', '');
    playerSelect.options[0] = new Option('N/A', '');


    roundSelect.disabled = true;
    playerSelect.disabled = true;
  }
}

initOptions();
initVersusOptions();

fileInput.addEventListener('change', () => {
  initVersusOptions();
})

saveButton.addEventListener('click', async () => {
  let mapping = []
  let releaseKeys = [];
  new Array(8).fill(0).map((e, i) => {
    const selectElem = document.getElementById(`key-${i}-select`);
    const checkElem = document.getElementById(`key-${i}-release`);
    if (selectElem.value) mapping.push(selectElem.value);
    if (checkElem.checked) releaseKeys.push(selectElem.value);
  })

  const file = fileInput.files[0];
  const fileData = JSON.parse(await readFile(file));

  const options = {
    ...defaultOptions,
    offset: parseInt(offsetInput.value),
    roundIndex: parseInt(roundSelect.value),
    playerIndex: parseInt(playerSelect.value),
  }

  let osuFile
  if (file.name.endsWith('.ttrm')) {
    osuFile = convertTtrm(fileData, mapping, releaseKeys, options);
  } else {
    osuFile = convertTtr(fileData, mapping, releaseKeys, options);
  }

  const filename = file.name.split('.').slice(0, -1).join('.') + '.osu'
  saveFile(osuFile, filename);
})