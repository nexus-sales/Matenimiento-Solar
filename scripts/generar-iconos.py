"""
Genera los iconos de la aplicación instalable.

    python scripts/generar-iconos.py

Se dibujan aquí en lugar de guardarse como binarios sueltos para que el
motivo y los colores queden versionados: si cambia la marca, se edita este
archivo y se regeneran, en vez de tener que rehacerlos a mano en un editor.

El motivo es un módulo fotovoltaico —tres columnas por dos filas— sobre el
verde oliva del logo. A 48 píxeles, que es como se ve en la pantalla de
inicio de un móvil, una retícula se distingue; un texto no.
"""

from PIL import Image, ImageDraw

# Los mismos valores que src/app/globals.css. El oliva del logo se usa aquí
# como fondo, no como texto, así que es el tono exacto de marca.
OLIVA = (137, 155, 19)
OLIVA_OSCURO = (109, 124, 15)
CLARO = (247, 248, 245)

SALIDA = "public"


def dibujar(tamano: int, margen_rel: float) -> Image.Image:
    """
    `margen_rel` es la proporción del lado que queda libre alrededor del
    motivo. Los iconos «maskable» necesitan margen amplio porque Android
    recorta en círculo y se comería las esquinas.
    """
    # Se dibuja al cuádruple y se reduce: es un antialiasing barato y
    # suficiente, sin depender de más librerías.
    escala = 4
    lado = tamano * escala
    img = Image.new("RGBA", (lado, lado), (*OLIVA, 255))
    d = ImageDraw.Draw(img)

    margen = int(lado * margen_rel)
    ancho = lado - 2 * margen
    alto = int(ancho * 0.62)  # proporción de un módulo real, apaisado
    arriba = (lado - alto) // 2

    # Cuerpo del módulo
    d.rounded_rectangle(
        [margen, arriba, margen + ancho, arriba + alto],
        radius=int(lado * 0.02),
        fill=(*CLARO, 255),
    )

    # Retícula de células: dos líneas verticales y una horizontal
    grosor = max(1, int(lado * 0.018))
    for i in (1, 2):
        x = margen + ancho * i // 3
        d.rectangle([x - grosor // 2, arriba, x + grosor // 2, arriba + alto],
                    fill=(*OLIVA, 255))
    y = arriba + alto // 2
    d.rectangle([margen, y - grosor // 2, margen + ancho, y + grosor // 2],
                fill=(*OLIVA, 255))

    # Sombra inferior: da volumen y evita que se lea como un rectángulo plano
    d.rectangle(
        [margen, arriba + alto, margen + ancho, arriba + alto + grosor * 2],
        fill=(*OLIVA_OSCURO, 255),
    )

    return img.resize((tamano, tamano), Image.LANCZOS)


def main() -> None:
    generados = [
        ("icono-192.png", 192, 0.16),
        ("icono-512.png", 512, 0.16),
        # Maskable: margen mayor porque el sistema recorta en círculo.
        ("icono-maskable-512.png", 512, 0.26),
        # iOS no aplica máscara: usa el icono tal cual.
        ("apple-touch-icon.png", 180, 0.16),
    ]

    for nombre, tamano, margen in generados:
        ruta = f"{SALIDA}/{nombre}"
        dibujar(tamano, margen).save(ruta, "PNG", optimize=True)
        print(f"  {ruta}  {tamano}x{tamano}")


if __name__ == "__main__":
    main()
