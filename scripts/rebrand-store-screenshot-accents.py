#!/usr/bin/env python3
"""Replace the legacy DHL navigation accent without touching semantic fail red."""

from pathlib import Path

from PIL import Image, ImageFilter


REPO_DIR = Path(__file__).resolve().parent.parent
SCREENSHOT_DIR = REPO_DIR / "store-assets" / "screenshots"
DEVICE_DIRS = ("phone", "tablet7", "tablet10")

LEGACY_ACCENT = (212, 5, 17)
SVIS_ACCENT = (0, 166, 200)
LEGACY_TINT = (253, 236, 236)
SVIS_TINT = (235, 248, 251)


def clamp(value: float) -> int:
    return max(0, min(255, round(value)))


def distance(left: tuple[int, int, int], right: tuple[int, int, int]) -> int:
    return sum(abs(left[index] - right[index]) for index in range(3))


def rebrand(path: Path) -> bool:
    image = Image.open(path).convert("RGB")
    pixels = list(image.getdata())

    # Solid/near-solid #D40511 pixels identify branded UI regions. A small
    # dilation includes RGB antialiasing around labels and white-on-red buttons.
    seed_values = [
        255 if distance(pixel, LEGACY_ACCENT) < 50 else 0
        for pixel in pixels
    ]
    has_legacy_tint = any(
        distance(pixel, LEGACY_TINT) < 10
        for pixel in pixels
    )
    if not any(seed_values) and not has_legacy_tint:
        return False

    seed = Image.new("L", image.size)
    seed.putdata(seed_values)
    branded_region = list(seed.filter(ImageFilter.MaxFilter(7)).getdata())

    output: list[tuple[int, int, int]] = []
    changed = False
    delta = tuple(
        SVIS_ACCENT[index] - LEGACY_ACCENT[index]
        for index in range(3)
    )

    for pixel, is_seed, is_branded_region in zip(
        pixels,
        seed_values,
        branded_region,
    ):
        red, green, blue = pixel
        replacement = pixel

        if is_seed:
            replacement = tuple(
                clamp(pixel[index] + delta[index])
                for index in range(3)
            )
        elif distance(pixel, LEGACY_TINT) < 10:
            replacement = tuple(
                clamp(
                    SVIS_TINT[index]
                    + pixel[index]
                    - LEGACY_TINT[index]
                )
                for index in range(3)
            )
        elif (
            is_branded_region
            and red > green + 4
            and red > blue + 4
        ):
            # Preserve the antialiasing alpha while rotating only nearby
            # red-dominant edge pixels to the SVIS cyan.
            alpha = min(
                1.0,
                max(
                    (red - green) / 207,
                    (red - blue) / 195,
                ),
            )
            replacement = tuple(
                clamp(pixel[index] + alpha * delta[index])
                for index in range(3)
            )

        changed = changed or replacement != pixel
        output.append(replacement)

    if changed:
        image.putdata(output)
        image.save(path, optimize=True)

    return changed


def main() -> None:
    changed_count = 0
    for device_dir in DEVICE_DIRS:
        for path in sorted((SCREENSHOT_DIR / device_dir).glob("*.png")):
            if path.name == "01-login.png":
                continue
            changed_count += int(rebrand(path))

    print(f"Rebranded SVIS navigation accents in {changed_count} screenshots.")


if __name__ == "__main__":
    main()
