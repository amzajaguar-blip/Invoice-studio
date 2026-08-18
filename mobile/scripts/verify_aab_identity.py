#!/usr/bin/env python3
"""
Verifica che l'AAB prodotto dichiari davvero il versionCode e il package di
app.json — e fallisce se non riesce a stabilirlo.

Perche' esiste
──────────────
Il passo di CI che faceva questo controllo era decorativo. Provava a leggere
`AndroidManifest.xml` dalla radice dello zip, ma in un AAB il manifest sta in
`base/manifest/AndroidManifest.xml`, quindi non lo trovava mai. Stampava

    ❌ AndroidManifest.xml not present in AAB at top level (may live under
       base/ — skipping post-build verify on this bundle layout)

e poi usciva con 0, sotto una spunta verde. Anche i rami di vero disallineamento
("Version code mismatch — would be SHADOWED on Play Console!") uscivano con 0:
il controllo non poteva fallire nemmeno quando il difetto c'era davvero. E' la
stessa classe di difetto gia' trovata due volte in questa pipeline —
`apksigner verify` su un AAB che non sa leggere, e le assert su
`gradle.properties` fatte prima che il passo successivo le contraddicesse.

Perche' non si usa aapt2
────────────────────────
Il manifest di un AAB e' in formato protobuf (Resources.proto), non in binary
XML: `aapt2 dump xmltree` risponde "could not identify format of APK". Servirebbe
bundletool, cioe' scaricare un jar durante la build e legare l'esito a una rete
esterna. Qui si legge direttamente il protobuf, che per gli attributi che
servono ha una forma stabile e verificabile.

Come si leggono gli attributi
─────────────────────────────
Nel wire format, un `XmlAttribute` porta il nome nel campo 2 e il valore
testuale nel campo 3, entrambi length-delimited:

    12 0b "versionCode"   1a 02 "74"
    ^^ ^^                 ^^ ^^
    |  len                |  len
    campo 2 (name)        campo 3 (value)

Si cerca quindi la sequenza esatta `0x12 <len> <nome>` e si decodifica il
`0x1a <len> <valore>` immediatamente successivo. Se la forma non e' quella, lo
script esce non-zero invece di dichiarare l'esito ignoto e passare comunque.

Uso:
    python3 verify_aab_identity.py <percorso.aab> <percorso app.json>
"""

import json
import sys
import zipfile

MANIFEST_PATH = "base/manifest/AndroidManifest.xml"


def read_attribute(blob: bytes, name: str) -> str | None:
    """Valore testuale dell'attributo `name`, o None se non ha quella forma."""
    key = name.encode("utf-8")
    needle = bytes([0x12, len(key)]) + key

    start = 0
    while True:
        at = blob.find(needle, start)
        if at == -1:
            return None
        after = at + len(needle)
        # Campo 3 (value), length-delimited, subito dopo il nome.
        if after < len(blob) and blob[after] == 0x1A:
            length = blob[after + 1]
            raw = blob[after + 2 : after + 2 + length]
            try:
                return raw.decode("utf-8")
            except UnicodeDecodeError:
                return None
        start = at + 1


def main() -> int:
    if len(sys.argv) != 3:
        print("uso: verify_aab_identity.py <file.aab> <app.json>", file=sys.stderr)
        return 2

    aab_path, app_json_path = sys.argv[1], sys.argv[2]

    try:
        with zipfile.ZipFile(aab_path) as z:
            if MANIFEST_PATH not in z.namelist():
                print(f"❌ {MANIFEST_PATH} assente dall'AAB: non e' un bundle valido")
                return 1
            manifest = z.read(MANIFEST_PATH)
    except (OSError, zipfile.BadZipFile) as err:
        print(f"❌ AAB illeggibile: {err}")
        return 1

    with open(app_json_path, encoding="utf-8") as fh:
        android = json.load(fh)["expo"]["android"]
    expected_vc = str(android["versionCode"])
    expected_pkg = android["package"]

    actual_vc = read_attribute(manifest, "versionCode")
    actual_pkg = read_attribute(manifest, "package")

    print(f"Atteso : versionCode={expected_vc}  package={expected_pkg}")
    print(f"Trovato: versionCode={actual_vc}  package={actual_pkg}")

    # Non poter verificare NON e' un successo. Se il formato cambia, questo
    # script deve rompersi rumorosamente invece di lasciar passare un AAB
    # sconosciuto sotto una spunta verde.
    if actual_vc is None or actual_pkg is None:
        print("❌ versionCode o package non estraibili dal manifest protobuf.")
        print("   Il formato e' cambiato: aggiornare questo script, non ignorarlo.")
        return 1

    ok = True
    if actual_vc != expected_vc:
        print(f"❌ versionCode: l'AAB dice {actual_vc}, app.json dice {expected_vc}")
        print("   Su Play Console questo diventa un caricamento rifiutato o oscurato.")
        ok = False
    if actual_pkg != expected_pkg:
        print(f"❌ package: l'AAB dice {actual_pkg}, app.json dice {expected_pkg}")
        print("   Il package e' l'identita' dell'app sullo store: Play rifiuta.")
        ok = False

    if not ok:
        return 1

    print(f"✅ AAB verificato: versionCode={actual_vc}, package={actual_pkg}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
