import array
import json
import sys
import threading

import sounddevice as sd
from vosk import KaldiRecognizer, Model

SAMPLE_RATE = 16000
BLOCKSIZE = 4000          # 250 ms: resposta mais rápida que os 500 ms anteriores
NOISE_GATE = 120          # ruído de fundo abaixo disso vira silêncio digital
MIN_CONFIDENCE = 0.15     # descarta alucinações do modelo em ruído
TARGET_PEAK = 12000

model = Model(sys.argv[1])
recognizer = KaldiRecognizer(model, SAMPLE_RATE)
recognizer.SetWords(True)
muted = False


def read_commands():
    """MUTE/UNMUTE vindos do Node, sem depender de select() no Windows."""
    global muted
    for line in sys.stdin:
        command = line.strip().upper()
        if command == "MUTE":
            muted = True
        elif command == "UNMUTE":
            muted = False


threading.Thread(target=read_commands, daemon=True).start()


def clean_audio(indata):
    """Remove DC, aplica noise gate e ganho leve — sem dependências extras."""
    samples = array.array('h')
    samples.frombytes(bytes(indata))
    if not samples:
        return b''

    mean = sum(samples) / len(samples)
    cleaned = array.array('h', [0]) * len(samples)
    peak = 0
    for i, raw in enumerate(samples):
        value = int(raw - mean)
        if abs(value) < NOISE_GATE:
            value = 0
        cleaned[i] = value
        if abs(value) > peak:
            peak = abs(value)

    if 0 < peak < TARGET_PEAK:
        gain = min(2.5, TARGET_PEAK / peak)
        for i, value in enumerate(cleaned):
            boosted = int(value * gain)
            cleaned[i] = max(-32768, min(32767, boosted))

    return cleaned.tobytes()


def callback(indata, frames, time_info, status):
    if muted:
        return

    data = clean_audio(indata)
    if recognizer.AcceptWaveform(data):
        result = json.loads(recognizer.Result())
        words = result.get("result", [])
        confidence = (
            sum(word.get("conf", 0.0) for word in words) / len(words)
            if words else 1.0
        )
        text = result.get("text", "").strip()
        if text and confidence >= MIN_CONFIDENCE:
            payload = {"text": text, "conf": round(confidence, 2)}
            print("FINAL " + json.dumps(payload, ensure_ascii=False), flush=True)
        elif text:
            payload = {"text": text, "conf": round(confidence, 2)}
            print("WEAK " + json.dumps(payload, ensure_ascii=False), flush=True)
    else:
        partial = json.loads(recognizer.PartialResult())
        text = partial.get("partial", "").strip()
        if text:
            print("PARTIAL " + json.dumps({"text": text}, ensure_ascii=False), flush=True)


with sd.RawInputStream(
    samplerate=SAMPLE_RATE,
    blocksize=BLOCKSIZE,
    dtype="int16",
    channels=1,
    callback=callback,
    latency="low",
):
    print("READY", flush=True)
    while True:
        sd.sleep(100)
