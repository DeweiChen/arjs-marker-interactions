#!/usr/bin/env python3
"""Create a small Three.js typeface JSON from a TrueType/OpenType font."""

import json
import sys
from pathlib import Path

from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont


CHARS = (
    "0123456789"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    "!?+-.=<>/@^_()[]{}:;,?'\"%&*#"
    "，。！？（）【】「」：；＋－／"
    " 生日快樂你好我你他吳蕭兒珈儀"
    "東京不甩尾"
)
RESOLUTION = 1000


def scale_point(point, units_per_em):
    return point[0] * RESOLUTION / units_per_em, point[1] * RESOLUTION / units_per_em


def format_number(value):
    rounded = round(value, 3)
    return str(int(rounded)) if rounded == int(rounded) else str(rounded)


def append_command(commands, command, *points):
    commands.append(command)
    for point in points:
        commands.extend(format_number(value) for value in point)


def outline_for_glyph(glyph_set, glyph_name, units_per_em):
    pen = RecordingPen()
    glyph_set[glyph_name].draw(pen)
    commands = []
    start = None
    current = None

    for command, raw_points in pen.value:
        points = [scale_point(point, units_per_em) for point in raw_points if point is not None]

        if command == "moveTo":
            start = points[0]
            current = start
            append_command(commands, "m", start)
        elif command == "lineTo":
            current = points[0]
            append_command(commands, "l", current)
        elif command == "qCurveTo":
            original_points = [scale_point(point, units_per_em) for point in raw_points]
            closes_contour = original_points[-1] is None
            if closes_contour:
                original_points = original_points[:-1] + [start]

            controls = original_points[:-1]
            final_point = original_points[-1]
            for index, control in enumerate(controls):
                endpoint = final_point if index == len(controls) - 1 else (
                    (control[0] + controls[index + 1][0]) / 2,
                    (control[1] + controls[index + 1][1]) / 2,
                )
                append_command(commands, "q", endpoint, control)
                current = endpoint
        elif command == "curveTo":
            endpoint = points[-1]
            append_command(commands, "b", endpoint, points[0], points[1])
            current = endpoint
        elif command == "closePath" and current != start and start is not None:
            append_command(commands, "l", start)
            current = start

    return " ".join(commands)


def main():
    if len(sys.argv) == 3:
        source = Path(sys.argv[1])
        output = Path(sys.argv[2])
    elif len(sys.argv) == 1:
        candidates = [
            Path("/tmp/NotoSansTC-Regular.ttf"),
            Path(__file__).resolve().parent.parent / "fonts" / "NotoSansTC-Regular.ttf",
            Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
            Path("/System/Library/Fonts/STHeiti Light.ttc"),
        ]
        source = next((p for p in candidates if p.exists()), None)
        if not source:
            raise SystemExit("Error: No suitable CJK source font found.")
        output = Path(__file__).resolve().parent.parent / "public" / "fonts" / "noto_sans_tc_minimal.typeface.json"
    else:
        raise SystemExit("usage: generate-typeface-font.py [SOURCE-FONT OUTPUT-JSON]")

    print(f"Using source font: {source}")
    font = TTFont(str(source), fontNumber=0)
    units_per_em = font["head"].unitsPerEm
    cmap = font.getBestCmap()
    glyph_set = font.getGlyphSet()
    glyphs = {}
    hmtx = font["hmtx"]

    for char in dict.fromkeys(CHARS):
        glyph_name = cmap.get(ord(char))
        if not glyph_name:
            continue
        advance_width = hmtx[glyph_name][0] * RESOLUTION / units_per_em
        glyph = {"ha": round(advance_width, 3)}
        outline = outline_for_glyph(glyph_set, glyph_name, units_per_em)
        if outline:
            glyph["o"] = outline
        glyphs[char] = glyph

    head = font["head"]
    typeface = {
        "glyphs": glyphs,
        "familyName": "Noto Sans TC Minimal",
        "resolution": RESOLUTION,
        "boundingBox": {
            "yMin": round(head.yMin * RESOLUTION / units_per_em, 3),
            "xMin": round(head.xMin * RESOLUTION / units_per_em, 3),
            "yMax": round(head.yMax * RESOLUTION / units_per_em, 3),
            "xMax": round(head.xMax * RESOLUTION / units_per_em, 3),
        },
        "underlineThickness": 50,
    }

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(typeface, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Generated {output} with {len(glyphs)} glyphs")


if __name__ == "__main__":
    main()