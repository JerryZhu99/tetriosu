
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


const pressKeys = ['rotateCW', 'rotateCCW', 'rotate180', 'hold', 'hardDrop']

const defaultMapping = [
  'rotate180', 'hold', 'rotateCCW', 'rotateCW', 'hardDrop', 'moveLeft', 'softDrop', 'moveRight'
]

const defaultOptions = {
  offset: 0,
}

const getInputs = events => events
  .filter(e => ['keydown', 'keyup'].includes(e.type))
  .map(e => ({
    type: e.type,
    time: (e.frame + e.data.subframe) * 1000 / 60.0,
    key: e.data.key,
  }))

const convertTtr = (ttrData, mapping = defaultMapping, options = defaultOptions) => {
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

  const keysHeld = new Array(mapping.length).fill(null);
  const notes = [];

  const inputs = getInputs(data.events);
  inputs.forEach(({ type, time, key }) => {
    if (!mapping.includes(key)) return;

    if (pressKeys.includes(key)) {
      if (type === 'keydown') {
        notes.push({
          time,
          lane: mapping.indexOf(key),
        });
      }
    } else {
      if (type === 'keydown') {
        keysHeld[key] = time;
      } else {
        notes.push({
          time: keysHeld[key],
          endTime: time,
          lane: mapping.indexOf(key),
          isHold: true,
        });
        keysHeld[key] = null;
      }
    }
  });

  keysHeld.forEach((time, key) => {
    if (time) {
      notes.push({
        time,
        lane: mapping.indexOf(key),
      });
    }
  })

  const keyCount = mapping.length;

  const hitObjects = notes.map(note => {
    const x = Math.round((note.lane + 0.5) * 512 / keyCount);
    const y = 192;
    const time = Math.floor(note.time) + offset;
    const type = note.isHold ? 128 : 1;
    const hitSound = 0;
    const endTime = Math.floor(note.endTime) + offset;
    const hitSample = '0:0:0:0:';

    return [x, y, time, type, hitSound,
      note.isHold ? `${endTime}:${hitSample}` : hitSample].join(',');
  }).join('\n');

  return maniaTemplate({
    title, artist, version, keyCount, hitObjects
  });
}

const fileInput = document.getElementById('file-input');
const output = document.getElementById('output');

const readFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(file, 'UTF-8');
    reader.addEventListener('load', e => resolve(e.target.result));
    reader.addEventListener('error', reject);
  });
};

const saveFile = (data, filename, type) => {
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

fileInput.addEventListener('change', async (event) => {
  const file = fileInput.files[0];
  const fileData = JSON.parse(await readFile(file));
  const osuFile = convertTtr(fileData, defaultMapping);

  output.value = osuFile;

  const filename = file.name.split('.').slice(0, -1).join('.') + '.osu'
  saveFile(osuFile, filename);
})