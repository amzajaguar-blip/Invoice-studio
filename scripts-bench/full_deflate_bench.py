"""Benchmark: re-zip with ZIP_DEFLATED on all entries."""
import os
import shutil
import sys
import tempfile
import time
import zipfile

aab = sys.argv[1]
workdir = tempfile.mkdtemp(prefix='bench-')
try:
    with zipfile.ZipFile(aab) as zf:
        zf.extractall(workdir)

    new_aab = aab + '.full_deflate'
    if os.path.exists(new_aab):
        os.remove(new_aab)

    t0 = time.time()
    with zipfile.ZipFile(new_aab, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zout:
        for root, _dirs, files in os.walk(workdir):
            for fn in files:
                fp = os.path.join(root, fn)
                arcname = os.path.relpath(fp, workdir).replace(os.sep, '/')
                with open(fp, 'rb') as f:
                    data = f.read()
                zout.writestr(arcname, data, compresslevel=6)
    elapsed = time.time() - t0
    size = os.path.getsize(new_aab)
    print(f'Full deflate: {size} bytes ({size/1024/1024:.1f} MB) in {elapsed:.1f}s')
finally:
    shutil.rmtree(workdir, ignore_errors=True)
