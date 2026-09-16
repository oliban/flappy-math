"""Synthesise a short brass fanfare for beating a personal highscore.

Sound-effect sites are unreachable from this sandbox, so the asset is generated
rather than downloaded. Pure standard library: math + wave.
"""
import math
import struct
import wave

RATE = 22050
DURATION = 1.5

# Brass-ish spectrum: strong fundamental with decaying odd/even harmonics.
HARMONICS = [1.0, 0.62, 0.38, 0.22, 0.13, 0.07, 0.04]

G4, C5, E5, G5, C6 = 392.00, 523.25, 659.25, 783.99, 1046.50

# (frequency, start seconds, duration seconds, amplitude, vibrato)
NOTES = [
    (G4, 0.00, 0.15, 0.85, False),
    (C5, 0.13, 0.15, 0.90, False),
    (E5, 0.26, 0.15, 0.92, False),
    (G5, 0.39, 1.05, 1.00, True),
    (C6, 0.40, 1.04, 0.45, True),
    (E5, 0.41, 1.03, 0.35, False),
]


def envelope(t, duration, long_release):
    """Fast attack, gentle decay to sustain, smooth release."""
    attack = 0.010
    release = 0.45 if long_release else 0.055

    if t < attack:
        return t / attack

    remaining = duration - t
    if remaining < release:
        # Exponential-ish tail reads as a natural brass decay.
        return max(0.0, (remaining / release) ** 1.7)

    # Slow decay from 1.0 towards the sustain level.
    decay_span = max(1e-6, duration - attack - release)
    progress = (t - attack) / decay_span
    return 1.0 - 0.25 * progress


def render():
    samples = [0.0] * int(RATE * DURATION)

    for freq, start, duration, amplitude, vibrato in NOTES:
        start_sample = int(start * RATE)
        note_samples = int(duration * RATE)
        long_release = duration > 0.5

        for i in range(note_samples):
            index = start_sample + i
            if index >= len(samples):
                break

            t = i / RATE
            env = envelope(t, duration, long_release)
            if env <= 0.0:
                continue

            # Slight vibrato on the held notes keeps them from sounding static.
            f = freq
            if vibrato and t > 0.25:
                f = freq * (1.0 + 0.004 * math.sin(2 * math.pi * 5.2 * (t - 0.25)))

            value = 0.0
            for h, weight in enumerate(HARMONICS, start=1):
                # Upper harmonics fade in slightly late, as brass does.
                brightness = 1.0 if h <= 2 else min(1.0, t / 0.05)
                value += weight * brightness * math.sin(2 * math.pi * f * h * t)

            samples[index] += amplitude * env * value

    # Normalise, then apply a short fade-out so the file cannot click.
    peak = max(abs(s) for s in samples) or 1.0
    scale = 0.86 / peak
    fade_samples = int(0.02 * RATE)

    frames = bytearray()
    for i, sample in enumerate(samples):
        value = sample * scale
        if i > len(samples) - fade_samples:
            value *= (len(samples) - i) / fade_samples
        clamped = max(-1.0, min(1.0, value))
        frames += struct.pack('<h', int(clamped * 32767))

    return bytes(frames)


with wave.open('sounds/fanfare.wav', 'wb') as out:
    out.setnchannels(1)
    out.setsampwidth(2)
    out.setframerate(RATE)
    out.writeframes(render())

print('wrote sounds/fanfare.wav')
