#!/usr/bin/env python3
"""
Generate an A4 PDF containing 8 AR.js barcode markers evenly divided across the page.
Zero external dependencies - uses Python standard library only.
"""

import argparse
import os
import struct
import sys
from pathlib import Path


def parse_png(file_path: Path):
    """
    Extract width, height, and raw IDAT stream from a PNG file.
    Assumes standard 24-bit Truecolor (color_type=2) non-interlaced PNG.
    """
    with open(file_path, "rb") as f:
        header = f.read(8)
        if header != b"\x89PNG\r\n\x1a\n":
            raise ValueError(f"Invalid PNG signature in {file_path}")

        width, height = 0, 0
        idat_chunks = []

        while True:
            length_bytes = f.read(4)
            if not length_bytes:
                break
            length = struct.unpack(">I", length_bytes)[0]
            chunk_type = f.read(4)
            chunk_data = f.read(length)
            f.read(4)  # CRC

            if chunk_type == b"IHDR":
                width, height = struct.unpack(">II", chunk_data[:8])
            elif chunk_type == b"IDAT":
                idat_chunks.append(chunk_data)
            elif chunk_type == b"IEND":
                break

    return width, height, b"".join(idat_chunks)


def build_pdf(
    image_paths,
    output_path: Path,
    marker_size_mm: float = 62.0,
    include_cut_lines: bool = True,
    include_labels: bool = False,
):
    """
    Generate an ISO A4 PDF with 8 markers laid out in a 2x4 grid.
    """
    # A4 Dimensions: 210mm x 297mm in PostScript points (72 points/inch)
    mm_to_pt = 72.0 / 25.4
    page_width_pt = 210.0 * mm_to_pt  # ~595.28 pt
    page_height_pt = 297.0 * mm_to_pt  # ~841.89 pt

    cols = 2
    rows = 4
    total_cells = cols * rows

    if len(image_paths) != total_cells:
        raise ValueError(f"Expected {total_cells} images, got {len(image_paths)}")

    cell_width_pt = page_width_pt / cols  # ~297.64 pt (105mm)
    cell_height_pt = page_height_pt / rows  # ~210.47 pt (74.25mm)
    marker_size_pt = marker_size_mm * mm_to_pt

    # Parse all images and prepare XObjects
    image_xobjects = []
    for idx, path in enumerate(image_paths):
        w, h, idat_data = parse_png(path)
        image_xobjects.append(
            {
                "id": f"Im{idx}",
                "width": w,
                "height": h,
                "idat": idat_data,
                "label": path.stem,
            }
        )

    # Build PDF Content Stream
    content_ops = []

    # Optional: Draw dashed cutting guidelines between cells
    if include_cut_lines:
        content_ops.append("q")
        content_ops.append("0.85 0.85 0.85 RG")  # Light gray stroke
        content_ops.append("0.5 w")  # 0.5pt line width
        content_ops.append("[4 4] 0 d")  # Dashed pattern: 4pt on, 4pt off

        # Horizontal cutting lines
        for r in range(1, rows):
            y = r * cell_height_pt
            content_ops.append(f"0 {y:.2f} m {page_width_pt:.2f} {y:.2f} l S")

        # Vertical cutting line
        for c in range(1, cols):
            x = c * cell_width_pt
            content_ops.append(f"{x:.2f} 0 m {x:.2f} {page_height_pt:.2f} l S")

        content_ops.append("Q")

    # Place each marker image centered within its respective 1/8 cell
    # Row 0 is at the top of the A4 page (highest Y in PDF coords)
    for idx, img in enumerate(image_xobjects):
        r = idx // cols
        c = idx % cols

        cell_x_left = c * cell_width_pt
        cell_y_bottom = page_height_pt - (r + 1) * cell_height_pt

        # Center marker in cell
        marker_x = cell_x_left + (cell_width_pt - marker_size_pt) / 2.0
        marker_y = cell_y_bottom + (cell_height_pt - marker_size_pt) / 2.0

        content_ops.append("q")
        content_ops.append(
            f"{marker_size_pt:.2f} 0 0 {marker_size_pt:.2f} {marker_x:.2f} {marker_y:.2f} cm"
        )
        content_ops.append(f"/{img['id']} Do")
        content_ops.append("Q")

        if include_labels:
            label_text = f"#{idx}"
            text_x = marker_x + marker_size_pt / 2.0 - 6.0
            text_y = marker_y - 12.0
            content_ops.append("q")
            content_ops.append("0.6 0.6 0.6 rg")
            content_ops.append("BT")
            content_ops.append("/F1 8 Tf")
            content_ops.append(f"{text_x:.2f} {text_y:.2f} Td")
            content_ops.append(f"({label_text}) Tj")
            content_ops.append("ET")
            content_ops.append("Q")

    content_stream_bytes = "\n".join(content_ops).encode("ascii")

    # Assemble PDF Object Structure
    # Object 1: Catalog
    # Object 2: Pages Tree
    # Object 3: Page Object
    # Object 4: Content Stream
    # If include_labels: Object 5 = Font Object, Images start from Object 6
    # Otherwise: Images start from Object 5
    objects = []

    # Placeholder for catalog (Obj 1) and pages (Obj 2)
    catalog_obj = b"<< /Type /Catalog /Pages 2 0 R >>"
    pages_obj = b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>"

    current_obj_id = 5
    font_obj_id = None
    if include_labels:
        font_obj_id = current_obj_id
        font_obj = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
        current_obj_id += 1

    # Image XObjects
    image_objs = []
    xobject_dict_entries = []
    for img in image_xobjects:
        obj_id = current_obj_id
        current_obj_id += 1
        xobject_dict_entries.append(f"/{img['id']} {obj_id} 0 R")

        dict_str = f"""<<
  /Type /XObject
  /Subtype /Image
  /Width {img['width']}
  /Height {img['height']}
  /ColorSpace /DeviceRGB
  /BitsPerComponent 8
  /Filter /FlateDecode
  /DecodeParms << /Predictor 15 /Columns {img['width']} /Colors 3 /BitsPerComponent 8 >>
  /Length {len(img['idat'])}
>>"""
        raw_obj = dict_str.encode("ascii") + b"\nstream\n" + img["idat"] + b"\nendstream"
        image_objs.append(raw_obj)

    # Content Stream Object (Obj 4)
    content_obj = (
        f"<< /Length {len(content_stream_bytes)} >>\nstream\n".encode("ascii")
        + content_stream_bytes
        + b"\nendstream"
    )

    # Page Object (Obj 3)
    xobj_str = " ".join(xobject_dict_entries)
    font_res = f"/Font << /F1 {font_obj_id} 0 R >>" if font_obj_id else ""
    page_dict = f"""<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 {page_width_pt:.2f} {page_height_pt:.2f}]
  /Contents 4 0 R
  /Resources <<
    /XObject << {xobj_str} >>
    {font_res}
  >>
>>""".encode("ascii")

    # Combine all objects
    objects = [catalog_obj, pages_obj, page_dict, content_obj]
    if include_labels:
        objects.append(font_obj)
    objects.extend(image_objs)

    # Build PDF File bytes and cross-reference table
    pdf = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = []

    for idx, obj in enumerate(objects, 1):
        offsets.append(len(pdf))
        pdf.extend(f"{idx} 0 obj\n".encode("ascii"))
        pdf.extend(obj)
        pdf.extend(b"\nendobj\n")

    startxref = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    pdf.extend(b"0000000000 65535 f \n")
    for off in offsets:
        pdf.extend(f"{off:010d} 00000 n \n".encode("ascii"))

    trailer = f"""trailer
<<
  /Size {len(objects) + 1}
  /Root 1 0 R
>>
startxref
{startxref}
%%EOF
"""
    pdf.extend(trailer.encode("ascii"))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(pdf)

    print(f"Generated PDF: {output_path} ({len(pdf)} bytes)")


def main():
    parser = argparse.ArgumentParser(description="Generate 8-marker A4 PDF for AR.js")
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path("public/markers/images"),
        help="Path to folder containing barcode-0.png ~ barcode-7.png",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("public/markers/markers.pdf"),
        help="Target output PDF path",
    )
    parser.add_argument(
        "--marker-size",
        type=float,
        default=62.0,
        help="Marker square size in mm (default: 62.0mm)",
    )
    parser.add_argument(
        "--no-cut-lines",
        action="store_true",
        help="Disable dashed cutting guidelines",
    )
    parser.add_argument(
        "--labels",
        action="store_true",
        help="Include marker number labels (#0 ~ #7)",
    )

    args = parser.parse_args()

    image_paths = [args.input_dir / f"barcode-{i}.png" for i in range(8)]
    for p in image_paths:
        if not p.is_file():
            print(f"Error: marker image not found: {p}", file=sys.stderr)
            sys.exit(1)

    build_pdf(
        image_paths=image_paths,
        output_path=args.output,
        marker_size_mm=args.marker_size,
        include_cut_lines=not args.no_cut_lines,
        include_labels=args.labels,
    )


if __name__ == "__main__":
    main()
