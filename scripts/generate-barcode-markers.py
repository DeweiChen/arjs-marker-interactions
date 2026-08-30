"""
Script to generate standard 3x3_HAMMING63 barcode markers (0-7) with white borders.
"""

import os
from PIL import Image, ImageDraw

MATRICES = {
    0: [[0, 1, 1], [1, 1, 1], [0, 1, 1]],
    1: [[0, 1, 1], [1, 0, 0], [0, 0, 1]],
    2: [[0, 1, 0], [0, 1, 1], [0, 0, 1]],
    3: [[0, 1, 0], [0, 0, 0], [0, 1, 1]],
    4: [[0, 0, 1], [0, 1, 0], [0, 1, 1]],
    5: [[0, 0, 1], [0, 0, 1], [0, 0, 1]],
    6: [[0, 0, 0], [1, 1, 0], [0, 0, 1]],
    7: [[0, 0, 0], [1, 0, 1], [0, 1, 1]]
}

def generate_markers(output_dir='public/markers/images', img_size=600, padding=86):
    os.makedirs(output_dir, exist_ok=True)
    marker_size = img_size - padding * 2
    cell_size = marker_size / 5

    for val, matrix in MATRICES.items():
        grid = [[0] * 5 for _ in range(5)]
        for r in range(3):
            for c in range(3):
                grid[r + 1][c + 1] = matrix[r][c]

        img = Image.new('RGB', (img_size, img_size), (255, 255, 255))
        draw = ImageDraw.Draw(img)

        # Draw outer black marker square
        draw.rectangle(
            [padding, padding, padding + marker_size, padding + marker_size],
            fill=(0, 0, 0)
        )

        # Draw active white cells
        for r in range(5):
            for c in range(5):
                if grid[r][c] == 1:
                    x0 = round(padding + c * cell_size)
                    y0 = round(padding + r * cell_size)
                    x1 = round(padding + (c + 1) * cell_size)
                    y1 = round(padding + (r + 1) * cell_size)
                    draw.rectangle([x0, y0, x1, y1], fill=(255, 255, 255))

        out_path = os.path.join(output_dir, f'barcode-{val}.png')
        img.save(out_path, 'PNG')
        print(f'Generated {out_path} ({img_size}x{img_size})')

if __name__ == '__main__':
    generate_markers()
