from pathlib import Path
from zipfile import ZipFile
from lxml import etree
from bs4 import BeautifulSoup
import markdown

root = Path(__file__).resolve().parent.parent
z = ZipFile(root / 'laporan mingguan.docx')
assert z.testzip() is None
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
xml = etree.fromstring(z.read('word/document.xml'))
normalize = lambda text: ' '.join(text.split())
output = normalize(' '.join(xml.xpath('//w:t/text()', namespaces=ns)))
missing = []
for f in root.glob('*.md'):
    soup = BeautifulSoup(markdown.markdown(f.read_text(encoding='utf-8-sig'), extensions=['tables', 'fenced_code']), 'html.parser')
    for n in soup.find_all(string=True):
        for line in str(n).splitlines():
            if normalize(line) and normalize(line) not in output:
                missing.append((f.name, line))
assert not missing, missing
for name in z.namelist():
    if name.endswith('.xml'): etree.fromstring(z.read(name))
print('PASS: seluruh teks enam sumber, integritas ZIP, XML')
print('Ukuran:', (root / 'laporan mingguan.docx').stat().st_size)
