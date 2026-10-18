"""Laporan pembimbing dengan gambar asli; sumber gambar tidak diubah."""
import sys
import json
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'docs/.work-speech/lib'))
from PIL import Image
from docx import Document
from docx.shared import Cm, Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

SOURCE=ROOT/'Dokumentasi/Progres 2'
DEST=SOURCE/'progres 2 Try and error sistem.docx'
WORK=ROOT/'.work-docs-progres2'
WORK.mkdir(exist_ok=True)
doc=Document()
s=doc.sections[0]
s.page_width,s.page_height=Cm(21),Cm(29.7)
s.left_margin=s.right_margin=Cm(2.2)
s.top_margin=s.bottom_margin=Cm(1.8)
s.header_distance=s.footer_distance=Cm(.8)
s.different_first_page_header_footer=True
normal=doc.styles['Normal'];normal.font.name='Arial';normal.font.size=Pt(10.5)
normal.paragraph_format.line_spacing=1.08
normal.paragraph_format.space_after=Pt(7)
for name,size in [('Title',28),('Heading 1',17),('Heading 2',11.5)]:
    style=doc.styles[name];style.font.name='Arial';style.font.size=Pt(size);style.font.bold=True
    style.font.color.rgb=RGBColor.from_string('202A30')
    style.paragraph_format.space_before=Pt(8 if name=='Heading 2' else 0)
    style.paragraph_format.space_after=Pt(6 if name=='Heading 2' else 10)
caption=doc.styles['Caption'];caption.font.name='Arial';caption.font.size=Pt(9);caption.font.italic=False
caption.font.color.rgb=RGBColor.from_string('59636B')
caption.paragraph_format.space_after=Pt(8)
s.header.paragraphs[0].text='AI HUB  |  LAPORAN PROGRES 2'
s.header.paragraphs[0].runs[0].font.size=Pt(8)
footer=s.footer.paragraphs[0];footer.alignment=WD_ALIGN_PARAGRAPH.RIGHT
footer.add_run('Khoirul Yardan  •  ').font.size=Pt(8)
field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');footer._p.append(field)
doc.settings.element.append(OxmlElement('w:doNotAutoCompressPictures'))
doc.core_properties.title='Progres 2 — Try and Error Sistem AI Hub'
doc.core_properties.author='Khoirul Yardan'
doc.core_properties.subject='Penambahan fitur komunikasi dan hasil percobaan sistem'
figures=[]
sections=[]

def p(text):return doc.add_paragraph(text)
def sub(text):doc.add_heading(text,2)
def page(title):
    if sections:doc.add_page_break()
    sections.append(title);doc.add_heading(title,1)

def table(headers,rows,widths):
    t=doc.add_table(rows=1,cols=len(headers));t.autofit=False
    for col,w in zip(t.columns,widths):col.width=Cm(w)
    for cell,text in zip(t.rows[0].cells,headers):
        cell.text=text
        shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'E7EEEC');cell._tc.get_or_add_tcPr().append(shade)
        for run in cell.paragraphs[0].runs:run.bold=True
    repeat=OxmlElement('w:tblHeader');t.rows[0]._tr.get_or_add_trPr().append(repeat)
    for row in rows:
        for cell,text in zip(t.add_row().cells,row):cell.text=text
    for row in t.rows:
        row._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
        for cell,w in zip(row.cells,widths):
            cell.width=Cm(w)
            for para in cell.paragraphs:
                para.paragraph_format.space_before=Pt(5);para.paragraph_format.space_after=Pt(5)
                para.paragraph_format.line_spacing=1
                for run in para.runs:run.font.size=Pt(10)
    p('').paragraph_format.space_after=Pt(0)

def image(para,name,width,height):
    source=SOURCE/name
    if not source.exists():raise FileNotFoundError(f'Gambar asli wajib tersedia: {source}')
    with Image.open(source) as im:w,h=im.size
    width=min(width,height*w/h)
    para.alignment=WD_ALIGN_PARAGRAPH.CENTER
    para.paragraph_format.space_after=Pt(5);para.paragraph_format.keep_with_next=True
    shape=para.add_run().add_picture(str(source),width=Inches(width))
    shape._inline.docPr.set('descr',name)
    return {'source':name,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'width_inches':width,'height_inches':width*h/w}

def figure(name,text,height=6.3):
    item=image(p(''),name,6.35,height);item.update(number=len(figures)+1,caption=text);figures.append(item)
    para=doc.add_paragraph(f'Gambar {len(figures)}. {text}','Caption');para.alignment=WD_ALIGN_PARAGRAPH.CENTER

def pair(items,height=5.9):
    t=doc.add_table(rows=1,cols=2);t.autofit=False
    for col in t.columns:col.width=Cm(8.3)
    for cell,(name,text) in zip(t.rows[0].cells,items):
        cell.width=Cm(8.3)
        item=image(cell.paragraphs[0],name,3.05,height);item.update(number=len(figures)+1,caption=text);figures.append(item)
        para=cell.add_paragraph(f'Gambar {len(figures)}. {text}','Caption');para.alignment=WD_ALIGN_PARAGRAPH.CENTER
    t.rows[0]._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
    p('').paragraph_format.space_after=Pt(0)

sections.append('Sampul')
p('LAPORAN PROGRES PROYEK AKHIR')
p('\n')
doc.add_heading('Progres 2\nTry and Error Sistem AI Hub',0)
p('Penambahan fitur komunikasi dan hasil percobaan sistem')
p('\n')
p('Khoirul Yardan\nD3 PENS Lamongan\n19 Oktober 2026')
p('\n')
sub('Judul Proyek Akhir')
p('Pengembangan Aplikasi Mobile untuk Otomatisasi Dokumentasi Percakapan Perawat-Pasien sebagai Pendukung Verifikasi Diagnosis Pasien Menggunakan Speech-to-Text dan Large Language Model.')

page('1. Perkembangan dari progres sebelumnya')
p('Pada Progres 1, pengembangan berfokus pada Bot BPJS, mulai dari hasil transkrip, ringkasan, perbandingan hasil, hingga koreksi peran pembicara. Percobaan juga dilakukan pada Chat, VPN, dan Terminal. Progres 2 melanjutkan pekerjaan tersebut dengan penambahan fitur komunikasi, riwayat gabungan, serta panel admin.')
p('Dua fitur yang saya tambahkan adalah Papan Komunikasi dan Anamnesis Terpandu. Keduanya sebelumnya sudah saya ajukan sebagai pilihan pengembangan speech. Karena masih menunggu jawaban dosen, saya melanjutkan implementasinya secara mandiri untuk dicoba dan dibahas pada bimbingan berikutnya.')
table(['Bagian','Perkembangan'],[
('Papan Komunikasi','Pilihan kebutuhan pasien, suara dari pilihan, catatan, serta tautan ruangan.'),
('Anamnesis Terpandu','Pertanyaan dibacakan sistem; jawaban suara diubah menjadi teks dan diperiksa sebelum dibuat draf.'),
('Dokumentasi & Riwayat','Data Bot BPJS, Anamnesis, dan Papan dapat dicari dari satu halaman.'),
('VPN dan Terminal','Percobaan menggunakan server asli, penelusuran kegagalan koneksi, dan hasil setelah perbaikan.'),
('Panel Admin','Pengelolaan akun, pemantauan metadata, maintenance, pengumuman, dan status layanan.')],[4.3,12.3])
sub('Arah pengembangan')
p('Bot BPJS tetap digunakan untuk mendokumentasikan percakapan perawat–pasien. LLM membantu menyusun draf, lalu perawat memeriksa dan menyunting hasilnya dengan melihat transkrip sumber. Dokter menerima dokumentasi untuk ditinjau di luar aplikasi. Papan dan Anamnesis menjadi fitur tambahan untuk membantu pengumpulan informasi.')
p('Pembahasan berikut menggunakan tangkapan layar asli Progres 2 dan catatan pengujian yang sudah dilakukan. Hal yang masih perlu diuji dirangkum pada bagian akhir.')

page('2. Papan Komunikasi')
p('Papan Komunikasi dibuat agar pasien dapat menyampaikan kebutuhan melalui pilihan sentuh. Pilihan yang tersedia mencakup keluhan dan kebutuhan sehari-hari, seperti nyeri, sesak napas, haus, mual, ke toilet, atau meminta bantuan mengubah posisi.')
figure('papan komunikasi.png','Pilihan kebutuhan pada Papan Komunikasi.')
p('Setiap pilihan dapat dibacakan melalui TTS dan masuk ke catatan. Untuk nyeri, tersedia pilihan lokasi tubuh dan skala 0–10. Angka tersebut merupakan jawaban pasien. Tombol “Minta obat” menyampaikan permintaan kepada perawat; sistem tidak menentukan obat yang harus diberikan.')

page('2.1 Ruangan dan tautan pasien')
p('Pada tab Ruangan, perawat dapat membuat label tempat tidur atau ruangan, lalu membagikan tautannya kepada pasien atau keluarga. Gambar berikut memperlihatkan keadaan sebelum dan sesudah ruangan dibuat.')
pair([('papan komunikasi share link.png','Tab Ruangan sebelum ada ruangan.'),('contoh pembuatan share link .png','Ruangan yang sudah dibuat beserta pilihan pengelolaannya.')],5.8)
p('Ruangan yang dibuat memiliki tombol Salin tautan, Bagikan, Nonaktifkan, dan Hapus. Tautan digunakan untuk membuka papan dari perangkat lain. Pengujian berikutnya perlu memastikan bahwa pilihan dari perangkat pasien masuk ke catatan perawat dan tautan tidak dapat dipakai setelah dinonaktifkan.')

page('2.2 Catatan dari pilihan pasien')
p('Pilihan pada papan dicatat beserta waktunya. Tab Catatan menyediakan tombol untuk menyalin informasi ke anamnesis dan membuka halaman dokumentasi.')
figure('catatan papan komunikasi.png','Catatan kebutuhan pasien dari Papan Komunikasi.',6.0)
p('Pada contoh ini terdapat catatan Ke toilet, Ubah posisi, Mual, Haus, dan Lapar. Perawat dapat meninjau kembali urutannya sebelum memakai informasi tersebut dalam dokumentasi. Catatan pilihan perlu dikonfirmasi kepada pasien apabila maksudnya belum jelas.')

page('3. Anamnesis Terpandu')
p('Anamnesis Terpandu dibuat untuk membantu pengisian informasi awal melalui tanya jawab yang berurutan. Sistem membacakan pertanyaan menggunakan TTS, pasien menjawab dengan suara, lalu STT mengubah jawaban menjadi teks. Perawat dapat memperbaiki teks sebelum melanjutkan.')
table(['Urutan','Informasi yang ditanyakan'],[('1','Keluhan utama yang sedang dirasakan.'),('2','Waktu mulai atau durasi keluhan.'),('3','Lokasi keluhan dan tingkat beratnya.'),('4','Riwayat penyakit sebelumnya.'),('5','Alergi obat atau makanan.'),('6','Obat yang sedang rutin digunakan.'),('7','Keluhan lain yang ingin disampaikan.')],[2,14.6])
sub('Alur yang sudah dibuat')
p('Perawat mengisi kode atau inisial pasien, lalu memulai sesi. Sistem membacakan satu pertanyaan, merekam jawaban, dan menampilkan hasil STT untuk diperiksa. Setelah semua jawaban selesai, LLM menyusunnya menjadi draf yang dapat ditinjau dan disimpan.')
sub('Contoh jawaban')
p('Sistem: “Sejak kapan keluhan itu mulai Anda rasakan?”\nPasien simulasi: “Sejak kemarin sore.”\nPerawat memeriksa hasil teks sebelum jawaban tersebut dipakai dalam draf.')
sub('Status saat ini')
p('Alur tersebut sudah tersedia di kode, tetapi belum ada tangkapan layar sesi Anamnesis yang selesai pada Progres 2. Pada halaman riwayat, jumlah sesi Anamnesis masih nol. Pengujian dari pertanyaan pertama sampai penyimpanan hasil masih perlu dilakukan.')
p('Suara yang mengajukan pertanyaan pada fitur ini adalah suara sistem, bukan rekaman perawat. Hal ini perlu dibedakan dari Bot BPJS yang merekam percakapan langsung perawat–pasien.')

page('4. Dokumentasi & Riwayat')
p('Halaman dokumentasi menggabungkan hasil Bot BPJS, Anamnesis Terpandu, dan Papan Komunikasi. Pencarian serta filter disediakan agar catatan dari masing-masing fitur lebih mudah ditemukan.')
figure('dokumentasi penuh semua bot.png','Riwayat gabungan dari tiga fitur pada Bot Hub.',6.7)
p('Pada gambar terdapat tujuh entri: empat dari Bot BPJS, tiga dari Papan Komunikasi, dan belum ada dari Anamnesis. Status “Siap dikirim” atau “Sudah dikirim” menunjukkan tahap pengiriman dokumentasi, bukan hasil verifikasi dokter.')

page('5. Percobaan koneksi OpenVPN')
p('Percobaan awal pada HP gagal dan menampilkan pesan “Server menolak login”. Pengisian ulang username dan password tidak menyelesaikan masalah. Pemeriksaan berikutnya menunjukkan server terjangkau, sehingga penelusuran dilanjutkan pada log koneksi.')
pair([('try&error pada vpn.jpeg','Kegagalan koneksi pada percobaan awal.'),('percobaan koneksi VPN data asli.jpeg','VPN terhubung setelah penyesuaian cipher.')],5.7)
p('Pada uji 18 Oktober, perbedaan ditemukan pada daftar cipher klien. Laptop menawarkan AES-128-CBC yang dipilih server, sedangkan klien aplikasi belum menyertakannya. Percobaan menambah opsi ncp-disable ditolak oleh mesin OpenVPN. Setelah AES-128-CBC dimasukkan ke data-ciphers, koneksi berhasil.')
p('Hasil ini menunjukkan bahwa pesan login pada kegagalan awal belum menjelaskan penyebab sebenarnya. Teks galat perlu diperbaiki. Pengujian yang berhasil dilakukan pada Wi-Fi yang sama dengan laptop; jaringan seluler dan kestabilan koneksi masih perlu dicoba.')

page('6. Percobaan Terminal SSH')
p('Terminal sempat gagal dengan pesan Connection timed out. Pada percobaan tersebut, VPN ternyata sudah berhenti setelah aplikasi di-force-stop. Setelah VPN dihubungkan kembali, login SSH berhasil dan terminal menampilkan prompt server.')
pair([('try&error pada termina.jpeg','Koneksi SSH mengalami timeout saat VPN tidak aktif.'),('percobaan koneksi terminal data asli.jpeg','Terminal berhasil membuka shell server melalui VPN.')],6.1)
p('Pengujian server asli dilakukan sampai login dan munculnya prompt; belum ada perintah yang dijalankan. Dari percobaan ini, koneksi VPN perlu diperiksa terlebih dahulu sebelum menghubungkan SSH ke server di belakang tunnel. Force-stop aplikasi juga perlu dihindari ketika VPN masih dibutuhkan.')

page('7. Panel Admin')
p('Panel Admin ditambahkan untuk mengelola akun dan memantau kondisi sistem dari halaman terpisah. Admin masuk melalui form login, kemudian dapat melihat ringkasan pengguna, sesi, segmen transkrip, event papan, dan aktivitas admin.')
pair([('login admin.png','Form login Panel Admin.'),('dashboard admin.png','Dashboard dan ringkasan data sistem.')],6.0)
p('Panel telah disederhanakan agar berfokus pada akun, metadata, maintenance, pengumuman, audit, dan status layanan. Menu katalog Bot, Provider AI, serta Pengaturan generik dihapus dari panel. Pengelolaan akun juga tidak lagi memakai pilihan peran dokter atau perawat.')
p('Catatan pengujian 18 Oktober mencakup deployment di Fly, pemeriksaan halaman melalui desktop, dan navigasi pada Chrome di HP.')

page('7.1 Akun pengguna')
p('Halaman Akun pengguna menyediakan daftar akun, status akses, waktu pembuatan, dan login terakhir. Tombol Tambah pengguna digunakan untuk membuat akun, sedangkan Kelola membuka pengaturan akun yang dipilih.')
figure('menu akun pengguna.png','Daftar akun pengguna pada panel admin.',6.6)
p('Pada daftar terdapat akun aktif dan akun yang belum terkonfirmasi. Pengelolaan di halaman ini memakai akun umum tanpa pilihan peran. Isi percakapan pasien tidak ditampilkan pada halaman akun.')

page('7.2 Data sesi Bot BPJS')
p('Daftar Sesi Bot BPJS digunakan untuk memeriksa record sesi yang tersimpan. Informasi yang ditampilkan meliputi ID sesi, ID pemilik, status, serta waktu dibuat dan diperbarui.')
figure('menu database log bot BPJS.png','Metadata sesi Bot BPJS.',6.0)
p('Pada gambar terdapat empat sesi dengan status siap_dikirim dan terkirim. Panel menampilkan metadata untuk penelusuran operasional; isi percakapan dan dokumentasi pasien tetap diperiksa melalui akses pemilik sesi.')

page('7.3 Data dokumentasi LLM')
p('Halaman Dokumentasi LLM menampilkan hubungan dokumen dengan sesi, provider yang digunakan, dan waktu penyimpanan. Informasi ini membantu memeriksa apakah record hasil pengolahan sudah tersedia di database.')
figure('menu database dokumentasi llm.png','Metadata dokumen hasil pengolahan LLM.',6.0)
p('Pada contoh terdapat empat record yang mencatat provider Hermes API Server dan Gemini. Isi ringkasan tidak ditampilkan pada panel ini. Penilaian ketepatan hasil LLM perlu dilakukan dengan membandingkan draf dan transkrip sumbernya.')

page('7.4 Segmen transkrip')
p('Halaman Segmen transkrip menampilkan ID, sesi, label pembicara, posisi waktu, dan tanggal penyimpanan. Daftar ini membantu menelusuri segmen yang terkait dengan sesi tertentu.')
figure('menu database segmen transkrip.png','Metadata segmen transkrip yang tersimpan.',6.5)
p('Pada gambar terdapat 11 segmen dengan label pembicara “perawat”. Ketepatan label tersebut belum dapat dinilai dari metadata saja. Pemeriksaan peran pembicara perlu dilakukan dengan melihat isi transkrip dan membandingkannya dengan percakapan yang direkam.')

page('7.5 Log aktivitas pengguna')
p('Log aktivitas menampilkan kategori, status, dan waktu aktivitas. Pada gambar terlihat catatan kategori VPN dan AI yang dapat membantu menelusuri urutan percobaan sistem.')
figure('menu database log pengguna.png','Log aktivitas pengguna.',7.1)
p('Satu percobaan dapat menghasilkan beberapa catatan. Karena itu, jumlah log tidak digunakan sebagai jumlah pengujian yang berhasil; hasilnya tetap dicocokkan dengan kondisi fitur saat diuji.')

page('7.6 Maintenance')
p('Halaman Maintenance digunakan untuk mengatur pesan pemeliharaan dan waktu berlakunya. Pengelola dapat menentukan tampilan berupa banner atau blokir pada lapisan web.')
figure('menu maintenance admin.png','Pengaturan pesan dan jadwal maintenance.',6.5)
p('Tautan pasien pada Papan Komunikasi dikecualikan dari blokir maintenance. Layar native Bot BPJS dan Anamnesis juga tidak otomatis tertutup oleh overlay web. Pengujian penerapan jadwal dan tampilan pada perangkat pengguna masih perlu dilengkapi.')

page('7.7 Pengumuman')
p('Menu Pengumuman digunakan untuk menyampaikan informasi kepada pengguna. Form penambahan memuat judul, isi, jenis pengumuman, waktu mulai dan selesai, serta pilihan aktif.')
pair([('menu pengumuman admin.png','Daftar pengumuman sebelum ada data.'),('contoh tambah pengumuman admin.png','Form penambahan pengumuman.')],5.8)
p('Pada dokumentasi ini, daftar masih kosong dan form belum diisi. Langkah berikutnya adalah mencoba menyimpan satu pengumuman uji, memeriksa kemunculannya di aplikasi, lalu memastikan pengumuman berhenti tampil sesuai jadwal atau setelah dinonaktifkan.')

page('7.8 Audit log admin')
p('Audit log mencatat tindakan admin beserta waktu dan objek yang dikelola. Pada contoh terlihat aktivitas login serta pengelolaan akun pengguna.')
figure('menu log admin.png','Riwayat tindakan admin.',6.7)
p('Catatan ini digunakan untuk menelusuri perubahan operasional pada panel. Audit admin terpisah dari catatan percakapan dan proses pemeriksaan dokumentasi oleh dokter.')

page('7.9 Status layanan')
p('Halaman Status & Setup menampilkan kondisi koneksi Supabase, web, dan relay. Halaman ini juga memeriksa keberadaan tabel yang dipakai untuk maintenance, pengumuman, dan audit admin.')
figure('menu status admin.png','Pemeriksaan layanan dan tabel panel admin.',6.7)
p('Saat gambar diambil, ketiga layanan menunjukkan status OK dan tabel yang diperiksa sudah tersedia. Angka waktu respons pada layar merupakan hasil pemeriksaan saat itu. Komentar SQL yang masih menyebut katalog lama belum mengikuti penyederhanaan menu panel.')

page('8. Hasil sementara dan pekerjaan berikutnya')
p('Progres 2 sudah mencakup Papan Komunikasi, alur Anamnesis Terpandu, riwayat gabungan, dan panel admin. Percobaan OpenVPN pada server asli berhasil setelah penyesuaian cipher. Terminal SSH juga berhasil login melalui VPN sampai menampilkan prompt.')
p('Pekerjaan yang paling perlu dilanjutkan adalah pengujian satu sesi Anamnesis secara lengkap dan pengiriman pilihan papan dari perangkat pasien ke perawat. Untuk Bot BPJS, hasil STT dan draf LLM perlu dibandingkan menggunakan rekaman serta transkrip acuan yang sama.')
table(['Pekerjaan','Yang perlu diperiksa'],[
('Bimbingan pemilihan speech','Membahas Papan Komunikasi dan Anamnesis Terpandu yang ditambahkan sambil menunggu jawaban pengajuan sebelumnya.'),
('Anamnesis lengkap','Pertanyaan terdengar, jawaban STT dapat dikoreksi, draf tersimpan, dan sesi muncul kembali di riwayat.'),
('Papan dua perangkat','Suara sesuai pilihan, catatan diterima pemilik ruangan, serta tautan nonaktif ditolak.'),
('Evaluasi Bot BPJS','WER, kelengkapan, kesesuaian isi, factual consistency, dan waktu proses pada STT saja dibanding STT + LLM.'),
('VPN dan Terminal','Perbaikan pesan galat, koneksi melalui jaringan seluler, dan kestabilan tunnel.'),
('Maintenance/pengumuman','Penerapan jadwal dan perubahan tampilan pada perangkat pengguna.')],[4.4,12.2])
sub('Catatan untuk evaluasi')
p('Pengujian speech memakai skenario fiktif. Keluaran STT sebelum koreksi disimpan agar dapat dibandingkan dengan hasil setelah pengolahan LLM. Pertanyaan TTS pada Anamnesis dicatat sebagai suara sistem, sehingga tidak tercampur dengan rekaman perawat pada pengujian Bot BPJS.')
sub('Bahan penyusunan')
p('Laporan menggunakan gambar dalam folder Dokumentasi/Progres 2, dokumen pengajuan pemilihan speech, catatan percobaan VPN dan Terminal tanggal 18 Oktober, serta catatan pengembangan dan pengujian panel admin. Dokumen “Dokumentasi macam speech perawat dan pasien” digunakan sebagai acuan pembahasan jenis komunikasi.')

assert len(figures)==21
assert len(sections)==20
doc.save(DEST)
manifest={'image_mode':'original','sections':sections,'figures':figures,'report_sha256':hashlib.sha256(DEST.read_bytes()).hexdigest()}
(WORK/'original-report-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'report':str(DEST),'sections':len(sections),'original_images':len(figures),'bytes':DEST.stat().st_size}))
