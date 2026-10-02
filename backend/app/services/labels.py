"""Barcode (Code 128) and QR images for registered-item labels and receipts.

Both codes encode only the opaque tracking identifier (or, on the sender's
receipt, the tracking link) - never names or addresses (NFR06). The printed
human-readable ID, the barcode and the QR code all resolve to the same record.
"""
from __future__ import annotations

import io

import barcode
import qrcode
import qrcode.image.svg
from barcode.writer import SVGWriter


def code128_svg(value: str, module_width: float = 0.33, module_height: float = 14.0) -> str:
    buf = io.BytesIO()
    code = barcode.get("code128", value, writer=SVGWriter())
    code.write(buf, options={"module_width": module_width, "module_height": module_height, "quiet_zone": 4.0,
                             "write_text": False, "background": "white", "foreground": "black"})
    svg = buf.getvalue().decode("utf-8")
    return svg[svg.find("<svg"):]


def qr_svg(value: str, box_size: int = 10, border: int = 2) -> str:
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=box_size, border=border)
    qr.add_data(value)
    qr.make(fit=True)
    img = qr.make_image(image_factory=qrcode.image.svg.SvgPathImage)
    svg = img.to_string(encoding="unicode")
    return svg[svg.find("<svg"):]
