import React, { PropsWithChildren, useEffect, useRef, useState } from 'react';

const cPlotPadding = 40 as const;

interface DataSink {
  sampleRate: number;
  bufferLength: number;
  maxBufferIndex: number;
  rawData: Array<{
    timeStart: number;
    data: Uint8Array;
  }>;
  data: number[];
}

const Button: React.FC<PropsWithChildren<{ onClick?: () => void }>> = ({
  onClick,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="text-gray-900 bg-white border border-gray-300 focus:outline-none hover:bg-gray-100 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-600">
    {children}
  </button>
);

const Toggle: React.FC<
  PropsWithChildren<{ value: boolean; onToggle: () => void }>
> = ({ value, onToggle, children }) => {
  return (
    <label className="inline-flex items-center cursor-pointer mx-6">
      <input
        type="checkbox"
        value={value ? '1' : '0'}
        className="sr-only peer"
        checked={value}
        onChange={onToggle}
      />
      <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600" />
      <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">
        {children}
      </span>
    </label>
  );
};

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const aCtxRef = useRef<AudioContext | null>(null);
  const [eLogData, setELogData] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showAxes, setShowAxes] = useState(true);

  const getAudioContext = () => {
    if (!aCtxRef.current) {
      aCtxRef.current = new AudioContext();
    }

    return aCtxRef.current;
  };

  const getCanvas = () => {
    const canvas = canvasRef.current;
    const cvsCtx = canvasRef.current?.getContext('2d');

    if (!canvas || !cvsCtx) {
      throw new Error('Canvas or context not found');
    }

    return {
      canvas,
      cvsCtx,
    };
  };

  const createAnalyserWithDataSink = () => {
    const aCtx = getAudioContext();

    const analyser = aCtx.createAnalyser();
    analyser.fftSize = 2048;

    const bufferLength = analyser.frequencyBinCount;

    const dataSink: DataSink = {
      sampleRate: aCtx.sampleRate,
      bufferLength,
      maxBufferIndex: 100,
      rawData: [],
      data: [],
    };

    for (let i = 0; i < dataSink.maxBufferIndex; i += 1) {
      dataSink.rawData.push({
        timeStart: -1,
        data: new Uint8Array(bufferLength),
      });
    }

    return { analyser, dataSink };
  };

  const clearData = (dataSink: DataSink) => {
    const frameTimeInc = 1.0 / dataSink.sampleRate;
    const dataMap: Record<number, number> = {};

    for (let i = 0; i < dataSink.rawData.length; i += 1) {
      if (dataSink.rawData[i].timeStart < 0) {
        continue;
      }

      let time = dataSink.rawData[i].timeStart;

      for (let j = 0; j < dataSink.bufferLength; j += 1) {
        dataMap[time] = dataSink.rawData[i].data[j];

        time += frameTimeInc;
      }
    }

    let epsilon = 1 * frameTimeInc;
    let start = dataSink.rawData[0].timeStart - epsilon;
    let end = dataSink.rawData[0].timeStart + epsilon;

    const entries = Object.entries(dataMap) as [string, number][];
    const outputData = [];

    for (let i = 0; i < entries.length; i += 1) {
      const [fTimeStr, value] = entries[i];
      const fTime = parseFloat(fTimeStr);

      if (fTime >= start && fTime <= end) {
        outputData.push(value);
        start += 2 * epsilon;
        end += 2 * epsilon;
      }
    }

    dataSink.data = outputData;
  };

  const drawAxes = () => {
    const { canvas, cvsCtx } = getCanvas();

    cvsCtx.lineWidth = 2;
    cvsCtx.strokeStyle = '#888888';

    cvsCtx.beginPath();
    cvsCtx.moveTo(0, canvas.height / 2);
    cvsCtx.lineTo(canvas.width, canvas.height / 2);
    cvsCtx.stroke();

    cvsCtx.beginPath();
    cvsCtx.moveTo(cPlotPadding, 0);
    cvsCtx.lineTo(cPlotPadding, canvas.height);
    cvsCtx.stroke();
  };

  const drawGrid = () => {
    const { canvas, cvsCtx } = getCanvas();

    cvsCtx.lineWidth = 1;
    cvsCtx.strokeStyle = '#eeeeee';

    const inc = Math.max(canvas.width / 60, canvas.height / 60);

    const xStart = cPlotPadding - Math.floor(cPlotPadding / inc) * inc;
    for (let i = xStart; i < canvas.width; i += inc) {
      cvsCtx.beginPath();
      cvsCtx.moveTo(i, 0);
      cvsCtx.lineTo(i, canvas.height);
      cvsCtx.stroke();
    }

    const yStart =
      canvas.height / 2 - Math.floor(canvas.height / 2 / inc) * inc;

    for (let i = yStart; i < canvas.height; i += inc) {
      cvsCtx.beginPath();
      cvsCtx.moveTo(0, i);
      cvsCtx.lineTo(canvas.width, i);
      cvsCtx.stroke();
    }
  };

  const clear = () => {
    const { canvas, cvsCtx } = getCanvas();

    cvsCtx.clearRect(0, 0, canvas.width, canvas.height);

    if (showGrid) {
      drawGrid();
    }

    if (showAxes) {
      drawAxes();
    }
  };

  const drawData = (dataSink: DataSink) => {
    const { canvas, cvsCtx } = getCanvas();

    clear();

    cvsCtx.lineWidth = 1;
    cvsCtx.strokeStyle = '#abcdef';

    cvsCtx.beginPath();

    const xIncrement = (canvas.width - cPlotPadding) / dataSink.data.length;
    let x = cPlotPadding;

    const getY = (v: number) => (v * canvas.height) / 256.0;

    cvsCtx.moveTo(0, getY(dataSink.data[0]));

    for (let i = 1; i < dataSink.data.length; i += 1) {
      cvsCtx.lineTo(x, getY(dataSink.data[i]));
      x += xIncrement;
    }

    cvsCtx.stroke();
  };

  const logData = (dataSink: DataSink) => {
    if (eLogData) {
      console.log(dataSink);
    }
  };

  const gatherData = (
    analyser: AnalyserNode,
    dataSink: DataSink,
    endTime: number,
    currentIndex: number,
  ) => {
    const aCtx = getAudioContext();

    if (aCtx.currentTime >= endTime || currentIndex > dataSink.maxBufferIndex) {
      clearData(dataSink);
      logData(dataSink);
      drawData(dataSink);

      return;
    }

    dataSink.rawData[currentIndex].timeStart = aCtx.currentTime;
    analyser.getByteTimeDomainData(dataSink.rawData[currentIndex].data);

    requestAnimationFrame(() =>
      gatherData(analyser, dataSink, endTime, currentIndex + 1),
    );
  };

  const createNoiseBuffer = (inBufferSize?: number) => {
    const aCtx = getAudioContext();
    const bufferSize = inBufferSize ?? aCtx.sampleRate;

    const buffer = aCtx.createBuffer(1, bufferSize, aCtx.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i += 1) {
      output[i] = Math.random() * 2 - 1;
    }

    return buffer;
  };

  const onKickPress = () => {
    const aCtx = getAudioContext();
    const { analyser, dataSink } = createAnalyserWithDataSink();

    const params = {
      decay: 0.2,
      tone: 164,
      volume: 1,
    };

    const oscillator = aCtx.createOscillator();
    const gain = aCtx.createGain();

    const tNow = aCtx.currentTime;

    oscillator.connect(gain);
    gain.connect(aCtx.destination);
    gain.connect(analyser);

    gatherData(analyser, dataSink, tNow + params.decay, 0);

    oscillator.frequency.setValueAtTime(0, tNow);
    oscillator.frequency.setValueAtTime(params.tone, tNow + 0.01);
    oscillator.frequency.exponentialRampToValueAtTime(10, tNow + params.decay);

    gain.gain.setValueAtTime(0, tNow);
    gain.gain.setValueAtTime(params.volume, tNow + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, tNow + params.decay);

    oscillator.start(tNow);
    oscillator.stop(tNow + params.decay);
  };

  const onHiHatPress = () => {
    const aCtx = getAudioContext();

    const { analyser, dataSink } = createAnalyserWithDataSink();
    const bandpassFilter = aCtx.createBiquadFilter();
    const highpassFilter = aCtx.createBiquadFilter();
    const gain = aCtx.createGain();

    const tNow = aCtx.currentTime;
    const tEnd = tNow + 0.3;

    const params = {
      tone: 40,
      decay: 0.3,
      ratios: [2, 3, 4.16, 5.43, 6.79, 8.21],
      bandpassFilterFrequency: 10000,
      highpassFilterFrequency: 7000,
    };

    bandpassFilter.type = 'bandpass';
    bandpassFilter.frequency.value = params.bandpassFilterFrequency;

    highpassFilter.type = 'highpass';
    highpassFilter.frequency.value = params.highpassFilterFrequency;

    bandpassFilter.connect(highpassFilter);
    highpassFilter.connect(gain);

    gain.connect(aCtx.destination);
    gain.connect(analyser);

    gatherData(analyser, dataSink, tEnd, 0);

    params.ratios.forEach((ratio) => {
      const oscillator = aCtx.createOscillator();
      oscillator.type = 'square';
      oscillator.frequency.value = params.tone * ratio;
      oscillator.connect(bandpassFilter);
      oscillator.start(tNow);
      oscillator.stop(tEnd);
    });

    gain.gain.setValueAtTime(0.0001, tNow);
    gain.gain.exponentialRampToValueAtTime(1, tNow + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.33, tNow + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, tEnd);
  };

  const onClapPress = () => {
    const aCtx = getAudioContext();
    const { analyser, dataSink } = createAnalyserWithDataSink();

    const params = {
      tone: 820,
      volume: 1,
      decay: 0.2,
      pulseWidth: 0.008,
      pulseCount: 4,
      fxAmount: 0,
    };

    const noise = aCtx.createBufferSource();
    noise.buffer = createNoiseBuffer(aCtx.sampleRate);

    const filter = aCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = params.tone * 2;

    const envelope = aCtx.createGain();

    // const feedback = aCtx.createGain();
    // feedback.gain.value = (0.99 * params.fxAmount) / 100.0;

    // const echo = aCtx.createDelay();
    // echo.delayTime.value = 1 / 3.0;

    noise.connect(filter);
    filter.connect(envelope);

    // envelope.connect(echo);
    // echo.connect(feedback);
    // feedback.connect(echo);

    envelope.connect(aCtx.destination);
    // feedback.connect(aCtx.destination);

    envelope.connect(analyser);

    // feedback.connect(analyser);

    const tNow = aCtx.currentTime;

    gatherData(analyser, dataSink, tNow + params.decay, 0);

    for (let i = 0; i < params.pulseCount - 1; i += 1) {
      envelope.gain.setValueAtTime(params.volume, tNow + i * params.pulseWidth);

      envelope.gain.exponentialRampToValueAtTime(
        0.1,
        tNow + (i + 1) * params.pulseWidth,
      );
    }

    envelope.gain.setValueAtTime(
      params.volume,
      tNow + (params.pulseCount - 1) * params.pulseWidth,
    );

    envelope.gain.exponentialRampToValueAtTime(0.001, tNow + params.decay);

    noise.start(tNow);
    noise.stop(tNow + params.decay);
  };

  const onSnarePress = () => {
    const aCtx = getAudioContext();
    const { analyser, dataSink } = createAnalyserWithDataSink();

    const params = {
      tone: 261,
      decay: 0.2,
      volume: 1,
    };

    /* Noise source */
    const noise = aCtx.createBufferSource();
    noise.buffer = createNoiseBuffer(aCtx.sampleRate);
    noise.loop = true;

    const noiseEnvelope = aCtx.createGain();

    noise.connect(noiseEnvelope);

    const noiseFilter = aCtx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 3400;

    noiseEnvelope.connect(noiseFilter);
    noiseFilter.connect(aCtx.destination);
    noiseFilter.connect(analyser);

    /* Oscillator source */
    const oscillator = aCtx.createOscillator();
    const oscillatorEnvelope = aCtx.createGain();

    oscillator.connect(oscillatorEnvelope);
    oscillatorEnvelope.connect(aCtx.destination);
    oscillatorEnvelope.connect(analyser);

    const tNow = aCtx.currentTime;

    gatherData(analyser, dataSink, tNow + params.decay, 0);

    /* Noise source */
    noiseEnvelope.gain.setValueAtTime(params.volume / 2, tNow);
    noiseEnvelope.gain.exponentialRampToValueAtTime(0.001, tNow + params.decay);

    /* Oscillator source */
    oscillator.frequency.setValueAtTime(params.tone, tNow);
    oscillator.frequency.exponentialRampToValueAtTime(
      0.01,
      tNow + params.decay,
    );

    oscillatorEnvelope.gain.setValueAtTime(params.volume, tNow);
    oscillatorEnvelope.gain.exponentialRampToValueAtTime(
      0.001,
      tNow + params.decay,
    );

    oscillator.start(tNow);
    oscillator.stop(tNow + params.decay);

    noise.start(tNow);
    noise.stop(tNow + params.decay);
  };

  useEffect(() => {
    clear();
  }, []);

  return (
    <div className="flex flex-col items-center pt-4">
      <div className="py-4 flex flex-row justify-center items-center">
        <Button onClick={onKickPress}>Kick</Button>
        <Button onClick={onHiHatPress}>Hi-Hat</Button>
        <Button onClick={onClapPress}>Clap</Button>
        <Button onClick={onSnarePress}>Snare</Button>
      </div>
      <canvas
        ref={canvasRef}
        width={1000}
        height={1000}
        className="rounded bg-white"
      />
      <div className="py-4 flex flex-row justify-center items-center">
        <Button onClick={clear}>Clear</Button>
        <Toggle
          value={eLogData}
          onToggle={() => {
            setELogData((prev) => !prev);
          }}>
          Log data
        </Toggle>
        <Toggle
          value={showAxes}
          onToggle={() => {
            setShowAxes((prev) => !prev);
            clear();
          }}>
          Show axes
        </Toggle>
        <Toggle
          value={showGrid}
          onToggle={() => {
            setShowGrid((prev) => !prev);
            clear();
          }}>
          Show grid
        </Toggle>
      </div>
    </div>
  );
}

export default App;
