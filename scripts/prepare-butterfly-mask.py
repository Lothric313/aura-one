"""Extract the foreground that can cross the title, from the unchanged film.

Requires numpy, Pillow and an ffmpeg executable (or imageio-ffmpeg).
Run from the project root. Output is a sparse alpha mask, never new imagery.
"""
from collections import deque
from hashlib import sha256
from pathlib import Path
import json
import subprocess
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public/media/inside.mp4'
CACHE = ROOT / 'artifacts/video-frames.npy'
WIDTH, HEIGHT, MASK_HEIGHT, FPS = 640, 360, 172, 24


def components(binary):
    seen = np.zeros(binary.shape, dtype=bool)
    height, width = binary.shape
    for y, x in zip(*np.nonzero(binary)):
        if seen[y, x]:
            continue
        queue, points = deque([(int(y), int(x))]), []
        seen[y, x] = True
        while queue:
            row, column = queue.popleft()
            points.append((row, column))
            for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                ny, nx = row + dy, column + dx
                if 0 <= ny < height and 0 <= nx < width and binary[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    queue.append((ny, nx))
        yield points


if not CACHE.exists():
    try:
        from imageio_ffmpeg import get_ffmpeg_exe
        ffmpeg = get_ffmpeg_exe()
    except ImportError:
        ffmpeg = sys.argv[1] if len(sys.argv) > 1 else 'ffmpeg'
    raw = subprocess.run([ffmpeg, '-v', 'error', '-i', str(SOURCE), '-an',
        '-vf', f'scale={WIDTH}:{HEIGHT}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
        capture_output=True, check=True).stdout
    CACHE.parent.mkdir(exist_ok=True)
    np.save(CACHE, np.frombuffer(raw, np.uint8).reshape(-1, HEIGHT, WIDTH, 3))

frames = np.load(CACHE, mmap_mode='r')
# No foreground crosses the sky in the first half of this fixed-camera clip.
background = np.median(frames[:120, 140:220], axis=0).astype(np.int16)
encoded, diagnostic = [], []
for index, frame in enumerate(frames):
    sky = frame[:MASK_HEIGHT].astype(np.int16)
    r, g, b = (sky[:, :, channel] for channel in range(3))
    mask = ((r - b > 18) & (r - g > 4)) | (np.max(sky, axis=2) < 115)
    # White wings: transient bright components straddling the horizon, excluding
    # the long, thin cloud bands. Process below the title too to retain wing tips.
    region = frame[140:220].astype(np.int16)
    delta = region - background
    white = (np.min(region, axis=2) > 185) & (delta[:, :, 0] > 22) & (
        delta[:, :, 0] > delta[:, :, 2] * .75 + 5)
    for points in components(white):
        ys, xs = np.array(points).T
        w, h = int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)
        if len(points) < 8 or h < 3 or w > 60 or w > h * 6 or ys.max() + 140 < 166:
            continue
        for y, x in points:
            if y + 140 < MASK_HEIGHT:
                mask[y + 140, x] = True
    # Remove single-pixel codec noise, retain actual antennae next to the wings.
    clean = np.zeros_like(mask)
    for points in components(mask):
        if len(points) >= 4:
            for y, x in points:
                clean[y, x] = True
    alpha = np.array(Image.fromarray(clean.astype(np.uint8) * 255).filter(
        ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(.45)))
    flat, runs = alpha.ravel(), []
    changes = np.flatnonzero(np.r_[True, flat[1:] != flat[:-1], True])
    for start, end in zip(changes[:-1], changes[1:]):
        value = int(flat[start])
        if value:
            runs.extend([int(start), int(end - start), value])
    encoded.append(runs)
    if index in range(144, 240, 8):
        preview = np.array(frame[:MASK_HEIGHT]).copy()
        selected = alpha > 100
        preview[selected] = preview[selected] // 3 + np.array([165, 0, 0], dtype=np.uint8)
        diagnostic.append(Image.fromarray(preview).crop((0, 140, WIDTH, MASK_HEIGHT)))

output = dict(width=WIDTH, height=MASK_HEIGHT, sourceHeight=HEIGHT, fps=FPS,
    frameCount=len(encoded), sourceSha256=sha256(SOURCE.read_bytes()).hexdigest(), frames=encoded)
destination = ROOT / 'public/media/butterfly-occlusion.json'
destination.write_text(json.dumps(output, separators=(',', ':')), encoding='utf-8')
if diagnostic:
    contact = Image.new('RGB', (WIDTH * 2, 64 * 6))
    for i, preview in enumerate(diagnostic):
        contact.paste(preview.resize((WIDTH, 64)), ((i % 2) * WIDTH, (i // 2) * 64))
    contact.save(ROOT / 'artifacts/butterfly-mask-qa.jpg', quality=95)
print(f'{destination.name}: {destination.stat().st_size} bytes, '
      f'{sum(bool(frame) for frame in encoded)} frames with foreground.')
