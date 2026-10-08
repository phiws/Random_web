const SUPABASE_URL = "https://njpnueobwgejwqvnofvc.supabase.co";
const SUPABASE_KEY = "sb_publishable_uTVlToDWiAQEGYLwCAC1dg_9TNwyx8O";

let dbClient = null;
let isAdmin = false;
let allItems = [];
let allLoans = [];
let allExpeditions = [];
let allMaintenance = [];
let activeExpeditionId = null;

window.addEventListener("DOMContentLoaded", () => {
  if (window.supabase && window.supabase.createClient) {
    dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    fetchItems();
    fetchLoans();
    fetchExpeditions();
    fetchMaintenance();
  }
});

// HELPER FORMAT TANGGAL & JAM
function formatDateTime(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  return date
    .toLocaleString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(/\./g, ":");
}

// TABS SWITCHER
function switchTab(tabName) {
  ["katalog", "peminjaman", "ekspedisi", "maintenance"].forEach((tab) => {
    document.getElementById(`section-${tab}`).classList.add("hidden");
    document.getElementById(`tab-${tab}`).className =
      "whitespace-nowrap px-4 py-2 text-xs font-bold text-stone-500 hover:text-stone-800";
  });

  document.getElementById(`section-${tabName}`).classList.remove("hidden");
  document.getElementById(`tab-${tabName}`).className =
    "whitespace-nowrap px-4 py-2 text-xs font-bold border-b-2 border-red-600 text-red-600";
}

// FETCH ITEMS KATALOG
async function fetchItems() {
  if (!dbClient) return;
  const cat = document.getElementById("filterKategori").value;
  const sort = document.getElementById("filterSort").value;

  let query = dbClient.from("items").select("*");
  if (cat !== "Semua") query = query.eq("kategori", cat);
  query = query.order("id", { ascending: sort === "oldest" });

  const { data } = await query;
  allItems = data || [];
  renderTable(allItems);
  updateStats(allItems);
  populateItemDropdowns(allItems);
}

function renderTable(items) {
  const tbody = document.getElementById("inventoryTable");
  tbody.innerHTML = "";
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-stone-400">Tidak ada data.</td></tr>`;
    return;
  }

  items.forEach((item) => {
    let badgeColor = "bg-emerald-100 text-emerald-700";
    if (item.kondisi === "Rusak Ringan")
      badgeColor = "bg-amber-100 text-amber-700";
    if (item.kondisi === "Rusak Berat")
      badgeColor = "bg-rose-100 text-rose-700";

    let pinjamStatus =
      item.status_pinjam === "Dipinjam"
        ? `<span class="px-2 py-0.5 rounded-full font-semibold text-[10px] bg-amber-100 text-amber-800 whitespace-nowrap">Dipinjam</span>`
        : `<span class="px-2 py-0.5 rounded-full font-semibold text-[10px] bg-stone-100 text-stone-600 whitespace-nowrap">Tersedia</span>`;

    const tr = document.createElement("tr");
    tr.className = "hover:bg-stone-50 transition-colors";
    tr.innerHTML = `
            <td class="p-3 font-mono font-bold text-stone-700 whitespace-nowrap">${item.kode_barang}</td>
            <td class="p-3 font-medium text-stone-800 whitespace-nowrap">${item.nama_barang}</td>
            <td class="p-3 text-stone-500 whitespace-nowrap">${item.kategori}</td>
            <td class="p-3 font-semibold whitespace-nowrap">${item.jumlah} ${item.satuan}</td>
            <td class="p-3 whitespace-nowrap">${pinjamStatus}</td>
            <td class="p-3 whitespace-nowrap"><span class="px-2 py-0.5 rounded-full font-semibold text-[10px] ${badgeColor}">${item.kondisi}</span></td>
            <td class="p-3 text-center action-col ${isAdmin ? "" : "hidden"} space-x-2 whitespace-nowrap">
                <button onclick='editItem(${JSON.stringify(item)})' class="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                <button onclick="deleteItem(${item.id})" class="text-rose-600 hover:text-rose-800 font-medium">Hapus</button>
            </td>
        `;
    tbody.appendChild(tr);
  });
}

function populateItemDropdowns(items) {
  const loanSelect = document.getElementById("loan_item_id");
  const maintSelect = document.getElementById("maint_item_id");
  const checkSelect = document.getElementById("check_item_id");

  if (loanSelect) loanSelect.innerHTML = "";
  if (maintSelect) maintSelect.innerHTML = "";
  if (checkSelect) checkSelect.innerHTML = "";

  items.forEach((item) => {
    if (item.status_pinjam !== "Dipinjam") {
      if (loanSelect)
        loanSelect.innerHTML += `<option value="${item.id}">${item.kode_barang} - ${item.nama_barang}</option>`;
      if (checkSelect)
        checkSelect.innerHTML += `<option value="${item.id}">${item.kode_barang} - ${item.nama_barang}</option>`;
    }
    if (maintSelect)
      maintSelect.innerHTML += `<option value="${item.id}">${item.kode_barang} - ${item.nama_barang}</option>`;
  });
}

// PEMINJAMAN FUNCTIONS
async function submitLoan(event) {
  event.preventDefault();
  if (!isAdmin) {
    alert(
      "Akses ditolak! Silakan masukkan PIN terlebih dahulu melalui mode admin.",
    );
    return;
  }

  const itemId = document.getElementById("loan_item_id").value;
  const peminjam = document.getElementById("loan_peminjam").value;
  const kegiatan = document.getElementById("loan_kegiatan").value;
  const jaminan = document.getElementById("jaminan_sekret").value;
  const minusAwal = document.getElementById("loan_minus_awal").value;
  const petugasPenerima = document.getElementById("petugas_penerima").value;
  const fileInput = document.getElementById("loan_foto_ktp");

  let fotoKtpData = "";
  if (fileInput.files && fileInput.files[0]) {
    try {
      fotoKtpData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(fileInput.files[0]);
      });
    } catch (err) {
      console.error(err);
    }
  }

  const waktuPinjam = new Date().toISOString();

  try {
    const { error } = await dbClient.from("loans").insert([
      {
        item_id: itemId,
        nama_peminjam: peminjam,
        kegiatan: kegiatan,
        jaminan_sekret: jaminan,
        foto_ktp: fotoKtpData,
        minus_awal: minusAwal,
        petugas_penerima: petugasPenerima,
        tgl_pinjam: waktuPinjam,
        status: "Dipinjam",
      },
    ]);

    if (error) throw error;

    const { error: updateError } = await dbClient
      .from("items")
      .update({ status_pinjam: "Dipinjam" })
      .eq("id", itemId);

    if (updateError) throw updateError;

    alert("Peminjaman berhasil dicatat!");
    document.getElementById("loanForm").reset();
    fetchLoans();
    fetchItems();
  } catch (err) {
    alert("Gagal memproses peminjaman: " + err.message);
  }
}

async function fetchLoans() {
  if (!dbClient) return;
  const { data } = await dbClient
    .from("loans")
    .select("*")
    .eq("status", "Dipinjam")
    .order("id", { ascending: false });
  allLoans = data || [];
  const tbody = document.getElementById("loanTable");
  tbody.innerHTML = "";

  if (allLoans.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-stone-400">Tidak ada alat yang sedang dipinjam.</td></tr>`;
    return;
  }

  allLoans.forEach((loan) => {
    const matchedItem = allItems.find((i) => i.id === loan.item_id);
    const namaAlat = matchedItem
      ? `${matchedItem.kode_barang} - ${matchedItem.nama_barang}`
      : `Alat ID: ${loan.item_id}`;
    let ktpLink = loan.foto_ktp
      ? `<button onclick="openImageWindow('${loan.foto_ktp}')" class="text-blue-600 underline font-semibold bg-blue-50 px-2 py-0.5 rounded">Lihat Foto</button>`
      : "-";

    const formattedTime = formatDateTime(loan.tgl_pinjam);

    const tr = document.createElement("tr");
    tr.className = "hover:bg-stone-50 transition-colors";
    tr.innerHTML = `
            <td class="p-3 font-bold text-stone-800 whitespace-nowrap">${namaAlat}</td>
            <td class="p-3 text-stone-700 font-medium whitespace-nowrap">${loan.nama_peminjam}</td>
            <td class="p-3 text-stone-600 whitespace-nowrap">🕒 ${formattedTime}</td>
            <td class="p-3 text-stone-600 whitespace-nowrap">${loan.kegiatan}</td>
            <td class="p-3 text-stone-500 whitespace-nowrap">Jaminan: <b>${loan.jaminan_sekret || "-"}</b><br>KTP: ${ktpLink}</td>
            <td class="p-3 text-stone-500 whitespace-nowrap">${loan.minus_awal || "Mulus"}</td>
            <td class="p-3 text-center action-col ${isAdmin ? "" : "hidden"} whitespace-nowrap">
                <button onclick="returnItemPrompt(${loan.id}, ${loan.item_id})" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-[10px] font-bold shadow">Kembalikan</button>
            </td>
        `;
    tbody.appendChild(tr);
  });
}

function openImageWindow(base64Data) {
  const win = window.open("");
  win.document.write(
    `<iframe src="${base64Data}" frameborder="0" style="border:0; top:0; left:0; bottom:0; right:0; width:100%; height:100%;" allowfullscreen></iframe>`,
  );
}

async function returnItemPrompt(loanId, itemId) {
  if (!isAdmin) {
    alert(
      "Akses ditolak! Silakan masukkan PIN terlebih dahulu melalui mode admin.",
    );
    return;
  }

  const minusPulang = prompt(
    "Masukkan minus / kerusakan baru saat dikembalikan (kosongkan jika aman):",
    "Mulus",
  );
  if (minusPulang !== null) {
    await dbClient
      .from("loans")
      .update({ status: "Dikembalikan", minus_pulang: minusPulang })
      .eq("id", loanId);
    await dbClient
      .from("items")
      .update({ status_pinjam: "Tersedia" })
      .eq("id", itemId);
    alert("Barang berhasil dikembalikan!");
    fetchItems();
    fetchLoans();
  }
}

// EKSPEDISI FUNCTIONS
async function submitExpedition(e) {
  e.preventDefault();
  if (!isAdmin) {
    alert(
      "Akses ditolak! Silakan masukkan PIN terlebih dahulu melalui mode admin.",
    );
    return;
  }

  const nama = document.getElementById("exp_nama").value;
  const lokasi = document.getElementById("exp_lokasi").value;
  const tglBerangkat = document.getElementById("exp_tgl_berangkat").value;
  const tglPulang = document.getElementById("exp_tgl_pulang").value;
  const ketua = document.getElementById("exp_ketua").value;
  const bhp = document.getElementById("exp_bhp").value;

  const { error } = await dbClient.from("expeditions").insert([
    {
      nama_kegiatan: nama,
      lokasi: lokasi,
      tgl_berangkat: tglBerangkat,
      tgl_pulang: tglPulang,
      ketua_tim: ketua,
      catat_bhp: bhp,
    },
  ]);

  if (error) alert("Gagal membuat kegiatan: " + error.message);
  else {
    alert("Kegiatan ekspedisi berhasil dibuat!");
    document.getElementById("expeditionForm").reset();
    fetchExpeditions();
  }
}

async function fetchExpeditions() {
  if (!dbClient) return;
  const { data } = await dbClient
    .from("expeditions")
    .select("*")
    .order("id", { ascending: false });
  allExpeditions = data || [];
  const container = document.getElementById("expeditionList");
  container.innerHTML = "";

  if (allExpeditions.length === 0) {
    container.innerHTML = `<p class="text-xs text-stone-400">Belum ada kegiatan ekspedisi terdaftar.</p>`;
    return;
  }

  allExpeditions.forEach((exp) => {
    const div = document.createElement("div");
    div.className =
      "border border-stone-200 rounded-xl p-4 bg-stone-50 space-y-2";
    div.innerHTML = `
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                    <h3 class="font-bold text-sm text-stone-800">🏔️ ${exp.nama_kegiatan}</h3>
                    <p class="text-xs text-stone-500">Lokasi: <b>${exp.lokasi}</b> | Ketua Tim: <b>${exp.ketua_tim}</b></p>
                    <p class="text-[11px] text-stone-400">Jadwal: ${exp.tgl_berangkat} s/d ${exp.tgl_pulang}</p>
                </div>
                <div class="flex gap-2 w-full sm:w-auto">
                    <button onclick="openChecklistModal(${exp.id}, '${exp.nama_kegiatan}')" class="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow">📋 Checklist Alat</button>
                    ${
                      isAdmin
                        ? `<button onclick="deleteExpedition(${exp.id})" class="bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold px-2 py-1.5 rounded-lg">🗑️</button>`
                        : ""
                    }
                </div>
            </div>
            ${exp.catat_bhp ? `<div class="text-[11px] bg-amber-50 border border-amber-200 text-amber-800 p-2 rounded-md"><b>Logistik BHP:</b> ${exp.catat_bhp}</div>` : ""}
        `;
    container.appendChild(div);
  });
}

async function deleteExpedition(id) {
  if (!isAdmin) {
    alert(
      "Akses ditolak! Silakan masukkan PIN terlebih dahulu melalui mode admin.",
    );
    return;
  }
  if (confirm("Hapus kegiatan ini beserta seluruh data checklistnya?")) {
    await dbClient.from("expeditions").delete().eq("id", id);
    fetchExpeditions();
  }
}

function openChecklistModal(expId, expName) {
  activeExpeditionId = expId;
  document.getElementById("modal_exp_id").value = expId;
  document.getElementById("modalExpTitle").innerText =
    `Checklist Alat: ${expName}`;
  document.getElementById("checklistModal").classList.remove("hidden");
  fetchChecklistItems(expId);
}

function closeChecklistModal() {
  document.getElementById("checklistModal").classList.add("hidden");
  activeExpeditionId = null;
}

async function addChecklistItem(e) {
  e.preventDefault();
  if (!isAdmin) {
    alert(
      "Akses ditolak! Silakan masukkan PIN terlebih dahulu melalui mode admin.",
    );
    return;
  }

  const itemId = document.getElementById("check_item_id").value;
  const pic = document.getElementById("check_pic").value;
  const catatan = document.getElementById("check_catatan").value;

  await dbClient.from("expedition_items").insert([
    {
      expedition_id: activeExpeditionId,
      item_id: itemId,
      pic_alat: pic,
      catatan_awal: catatan,
      status_bawa: "Pending",
    },
  ]);
  await dbClient
    .from("items")
    .update({ status_pinjam: "Dipinjam" })
    .eq("id", itemId);

  document.getElementById("check_pic").value = "";
  document.getElementById("check_catatan").value = "";
  fetchChecklistItems(activeExpeditionId);
  fetchItems();
}

async function fetchChecklistItems(expId) {
  const { data } = await dbClient
    .from("expedition_items")
    .select("*")
    .eq("expedition_id", expId);
  const tbody = document.getElementById("checklistTableBody");
  tbody.innerHTML = "";

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-stone-400">Belum ada alat dalam checklist kegiatan ini.</td></tr>`;
    return;
  }

  data.forEach((row) => {
    const matchedItem = allItems.find((i) => i.id === row.item_id);
    const namaAlat = matchedItem
      ? `${matchedItem.kode_barang} - ${matchedItem.nama_barang}`
      : `Alat ID: ${row.item_id}`;

    let statusBawaBtn =
      row.status_bawa === "Checked"
        ? `<button ${isAdmin ? `onclick="toggleCheckStatus(${row.id}, 'Pending')"` : "disabled"} class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold text-[10px]">✅ Berangkat</button>`
        : `<button ${isAdmin ? `onclick="toggleCheckStatus(${row.id}, 'Checked')"` : "disabled"} class="bg-stone-200 text-stone-700 px-2 py-1 rounded font-bold text-[10px]">⏳ Belum</button>`;

    let statusPulangText = row.kondisi_pulang
      ? `<span class="text-stone-700 font-semibold">${row.kondisi_pulang}</span>`
      : isAdmin
        ? `<button onclick="inputReturnCondition(${row.id}, ${row.item_id})" class="text-blue-600 underline font-semibold">Catat Pulang</button>`
        : `<span class="text-stone-400 font-normal">-</span>`;

    const tr = document.createElement("tr");
    tr.className = "hover:bg-stone-50";
    tr.innerHTML = `
            <td class="p-2 font-bold text-stone-800">${namaAlat}</td>
            <td class="p-2 text-stone-600">${row.pic_alat}</td>
            <td class="p-2">${statusBawaBtn}</td>
            <td class="p-2">${statusPulangText}</td>
            <td class="p-2 text-center action-col ${isAdmin ? "" : "hidden"}">
                <button onclick="deleteChecklistItem(${row.id}, ${row.item_id})" class="text-rose-600 font-bold">Hapus</button>
            </td>
        `;
    tbody.appendChild(tr);
  });
}

async function toggleCheckStatus(rowId, newStatus) {
  if (!isAdmin) {
    alert(
      "Akses ditolak! Silakan masukkan PIN terlebih dahulu melalui mode admin.",
    );
    return;
  }
  await dbClient
    .from("expedition_items")
    .update({ status_bawa: newStatus })
    .eq("id", rowId);
  fetchChecklistItems(activeExpeditionId);
}

async function inputReturnCondition(rowId, itemId) {
  if (!isAdmin) {
    alert(
      "Akses ditolak! Silakan masukkan PIN terlebih dahulu melalui mode admin.",
    );
    return;
  }
  const kondisi = prompt(
    "Masukkan kondisi alat saat kembali dari ekspedisi:",
    "Mulus / Aman",
  );
  if (kondisi !== null) {
    await dbClient
      .from("expedition_items")
      .update({ kondisi_pulang: kondisi })
      .eq("id", rowId);
    await dbClient
      .from("items")
      .update({ status_pinjam: "Tersedia" })
      .eq("id", itemId);
    fetchChecklistItems(activeExpeditionId);
    fetchItems();
  }
}

async function deleteChecklistItem(rowId, itemId) {
  if (!isAdmin) {
    alert(
      "Akses ditolak! Silakan masukkan PIN terlebih dahulu melalui mode admin.",
    );
    return;
  }
  if (confirm("Hapus alat dari checklist?")) {
    await dbClient.from("expedition_items").delete().eq("id", rowId);
    await dbClient
      .from("items")
      .update({ status_pinjam: "Tersedia" })
      .eq("id", itemId);
    fetchChecklistItems(activeExpeditionId);
    fetchItems();
  }
}

// MAINTENANCE FUNCTIONS
async function submitMaintenance(e) {
  e.preventDefault();
  if (!isAdmin) {
    alert(
      "Akses ditolak! Silakan masukkan PIN terlebih dahulu melalui mode admin.",
    );
    return;
  }

  const itemId = document.getElementById("maint_item_id").value;
  const kegiatan = document.getElementById("maint_kegiatan").value;
  const metode = document.getElementById("maint_metode").value;
  const biaya = parseInt(document.getElementById("maint_biaya").value || 0);
  const petugas = document.getElementById("maint_petugas").value;

  await dbClient.from("maintenance_logs").insert([
    {
      item_id: itemId,
      kegiatan_maintenance: `${kegiatan} [Metode: ${metode}]`,
      biaya: biaya,
      petugas: petugas,
      tgl_maintenance: new Date().toISOString(),
    },
  ]);
  alert("Log pemeliharaan berhasil disimpan!");
  document.getElementById("maintForm").reset();
  fetchMaintenance();
}

async function fetchMaintenance() {
  if (!dbClient) return;
  const { data } = await dbClient
    .from("maintenance_logs")
    .select("*")
    .order("id", { ascending: false });
  allMaintenance = data || [];
  const tbody = document.getElementById("maintTable");
  tbody.innerHTML = "";

  if (allMaintenance.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-stone-400">Belum ada riwayat perbaikan.</td></tr>`;
    return;
  }

  allMaintenance.forEach((log) => {
    const matchedItem = allItems.find((i) => i.id === log.item_id);
    const namaAlat = matchedItem
      ? `${matchedItem.kode_barang} - ${matchedItem.nama_barang}`
      : `Alat ID: ${log.item_id}`;
    const formattedTime = formatDateTime(log.tgl_maintenance);

    let formatBiaya =
      log.biaya > 0
        ? `<span class="font-bold text-emerald-700">Rp ${log.biaya.toLocaleString("id-ID")}</span>`
        : `<span class="bg-stone-100 text-stone-600 px-2 py-0.5 rounded font-semibold text-[10px]">Rp 0 (Swadaya)</span>`;

    const tr = document.createElement("tr");
    tr.className = "hover:bg-stone-50 transition-colors";
    tr.innerHTML = `
            <td class="p-3 text-stone-500 whitespace-nowrap">${formattedTime}</td>
            <td class="p-3 font-bold text-stone-800 whitespace-nowrap">${namaAlat}</td>
            <td class="p-3 text-stone-700 whitespace-nowrap">${log.kegiatan_maintenance}</td>
            <td class="p-3 whitespace-nowrap">${formatBiaya}</td>
            <td class="p-3 text-stone-600 whitespace-nowrap">${log.petugas}</td>
        `;
    tbody.appendChild(tr);
  });
}

// EXPORT FUNCTIONS
function exportToExcel(type) {
  let dataToExport = [];
  let fileName = "Laporan.xlsx";

  if (type === "katalog") {
    dataToExport = allItems.map((i) => ({
      Kode: i.kode_barang,
      Nama: i.nama_barang,
      Kategori: i.kategori,
      Jumlah: i.jumlah,
      Kondisi: i.kondisi,
    }));
    fileName = "Laporan_Katalog.xlsx";
  } else if (type === "peminjaman") {
    dataToExport = allLoans.map((l) => ({
      Peminjam: l.nama_peminjam,
      Kegiatan: l.kegiatan,
      Waktu: formatDateTime(l.tgl_pinjam),
    }));
    fileName = "Laporan_Peminjaman.xlsx";
  } else if (type === "maintenance") {
    dataToExport = allMaintenance.map((m) => ({
      Tindakan: m.kegiatan_maintenance,
      Biaya: m.biaya,
      Petugas: m.petugas,
    }));
    fileName = "Laporan_Maintenance.xlsx";
  }

  const ws = XLSX.utils.json_to_sheet(dataToExport);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, fileName);
}

// EXPORT PDF WITH TABLE DATA
function exportToPDF(type) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // 1. PDF KATALOG ALAT
  if (type === "katalog") {
    doc.text("Laporan Logistik - KATALOG ALAT", 14, 15);

    const headers = [
      ["Kode", "Nama Barang", "Kategori", "Jumlah", "Status", "Kondisi"],
    ];
    const data = allItems.map((item) => [
      item.kode_barang,
      item.nama_barang,
      item.kategori,
      `${item.jumlah} ${item.satuan}`,
      item.status_pinjam || "Tersedia",
      item.kondisi,
    ]);

    doc.autoTable({
      startY: 20,
      head: headers,
      body: data,
      theme: "grid",
      headStyles: { fillColor: [153, 27, 27] },
    });
    doc.save("Laporan_Katalog_Alat.pdf");
  }

  // 2. PDF PEMINJAMAN
  else if (type === "peminjaman") {
    doc.text("Laporan Logistik - PEMINJAMAN ALAT", 14, 15);

    const headers = [
      ["Alat", "Peminjam", "Waktu Pinjam", "Kegiatan", "Jaminan"],
    ];
    const data = allLoans.map((loan) => {
      const matchedItem = allItems.find((i) => i.id === loan.item_id);
      const namaAlat = matchedItem
        ? `${matchedItem.kode_barang} - ${matchedItem.nama_barang}`
        : `ID: ${loan.item_id}`;
      return [
        namaAlat,
        loan.nama_peminjam,
        formatDateTime(loan.tgl_pinjam),
        loan.kegiatan,
        loan.jaminan_sekret || "-",
      ];
    });

    doc.autoTable({
      startY: 20,
      head: headers,
      body: data,
      theme: "grid",
      headStyles: { fillColor: [180, 83, 9] },
    });
    doc.save("Laporan_Peminjaman.pdf");
  }

  // 3. PDF MAINTENANCE / PERBAIKAN
  else if (type === "maintenance") {
    doc.text("Laporan Logistik - RIWAYAT PERBAIKAN", 14, 15);

    const headers = [["Waktu", "Nama Alat", "Tindakan", "Biaya", "Petugas"]];
    const data = allMaintenance.map((m) => {
      const matchedItem = allItems.find((i) => i.id === m.item_id);
      const namaAlat = matchedItem
        ? `${matchedItem.kode_barang} - ${matchedItem.nama_barang}`
        : `ID: ${m.item_id}`;
      return [
        formatDateTime(m.tgl_maintenance),
        namaAlat,
        m.kegiatan_maintenance,
        m.biaya > 0
          ? `Rp ${m.biaya.toLocaleString("id-ID")}`
          : "Rp 0 (Swadaya)",
        m.petugas,
      ];
    });

    doc.autoTable({
      startY: 20,
      head: headers,
      body: data,
      theme: "grid",
      headStyles: { fillColor: [153, 27, 27] },
    });
    doc.save("Laporan_Perbaikan.pdf");
  }
}

// ADMIN TOGGLE & LOCK HANDLER
function toggleAdminMode() {
  if (!isAdmin) {
    const pin = prompt("Masukkan PIN Khusus Tim Logistik:");
    if (pin === "250125" || pin === "logistik aja") {
      isAdmin = true;
      document.getElementById("adminStatusText").innerText =
        "Admin (Akses Penuh)";
      document.getElementById("adminBadge").innerText = "UNLOCKED";

      document
        .getElementById("adminFormCard")
        ?.classList.remove("opacity-50", "pointer-events-none");
      document
        .getElementById("loanFormCard")
        ?.classList.remove("opacity-50", "pointer-events-none");
      document
        .getElementById("expeditionFormCard")
        ?.classList.remove("opacity-50", "pointer-events-none");
      document
        .getElementById("maintenanceFormCard")
        ?.classList.remove("opacity-50", "pointer-events-none");
      document
        .getElementById("checklistFormCard")
        ?.classList.remove("opacity-50", "pointer-events-none");

      document
        .querySelectorAll(".action-col")
        .forEach((el) => el.classList.remove("hidden"));

      renderTable(allItems);
      fetchLoans();
      fetchExpeditions();
      if (activeExpeditionId) fetchChecklistItems(activeExpeditionId);
      alert("Akses Admin Terbuka!");
    } else if (pin !== null) alert("PIN Salah!");
  } else {
    isAdmin = false;
    document.getElementById("adminStatusText").innerText =
      "Publik (Lihat Saja)";
    document.getElementById("adminBadge").innerText = "LOCKED";

    document
      .getElementById("adminFormCard")
      ?.classList.add("opacity-50", "pointer-events-none");
    document
      .getElementById("loanFormCard")
      ?.classList.add("opacity-50", "pointer-events-none");
    document
      .getElementById("expeditionFormCard")
      ?.classList.add("opacity-50", "pointer-events-none");
    document
      .getElementById("maintenanceFormCard")
      ?.classList.add("opacity-50", "pointer-events-none");
    document
      .getElementById("checklistFormCard")
      ?.classList.add("opacity-50", "pointer-events-none");

    document
      .querySelectorAll(".action-col")
      .forEach((el) => el.classList.add("hidden"));

    renderTable(allItems);
    fetchLoans();
    fetchExpeditions();
    if (activeExpeditionId) fetchChecklistItems(activeExpeditionId);
    alert("Mode Admin Dikunci Kembali.");
  }
}

function searchItems() {
  const query = document.getElementById("searchInput").value.toLowerCase();
  const filtered = allItems.filter(
    (item) =>
      item.nama_barang.toLowerCase().includes(query) ||
      item.kode_barang.toLowerCase().includes(query),
  );
  renderTable(filtered);
}

function editItem(item) {
  if (!isAdmin) {
    alert("Akses ditolak! Masukkan PIN Admin.");
    return;
  }
  document.getElementById("edit_id").value = item.id;
  document.getElementById("kode_barang").value = item.kode_barang;
  document.getElementById("nama_barang").value = item.nama_barang;
  document.getElementById("kategori").value = item.kategori;
  document.getElementById("kondisi").value = item.kondisi;
  document.getElementById("jumlah").value = item.jumlah;
  document.getElementById("satuan").value = item.satuan;
  document.getElementById("lokasi").value = item.lokasi;

  document.getElementById("formTitle").innerText = "Edit Data Alat";
  document.getElementById("btnSubmit").innerText = "Update Data Alat";
  document.getElementById("btnCancel").classList.remove("hidden");
}

function resetForm() {
  document.getElementById("edit_id").value = "";
  document.getElementById("itemForm").reset();
  document.getElementById("formTitle").innerText = "Tambah Data Alat";
  document.getElementById("btnSubmit").innerText = "Simpan Data Alat";
  document.getElementById("btnCancel").classList.add("hidden");
}

document.getElementById("itemForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isAdmin) {
    alert(
      "Akses ditolak! Silakan masukkan PIN terlebih dahulu melalui mode admin.",
    );
    return;
  }

  const editId = document.getElementById("edit_id").value;
  const itemData = {
    kode_barang: document.getElementById("kode_barang").value,
    nama_barang: document.getElementById("nama_barang").value,
    kategori: document.getElementById("kategori").value,
    jumlah: parseInt(document.getElementById("jumlah").value),
    satuan: document.getElementById("satuan").value,
    kondisi: document.getElementById("kondisi").value,
    lokasi: document.getElementById("lokasi").value,
  };

  let res = editId
    ? await dbClient.from("items").update(itemData).eq("id", editId)
    : await dbClient.from("items").insert([itemData]);

  if (res.error) alert("Gagal menyimpan data: " + res.error.message);
  else {
    alert("Data berhasil disimpan!");
    resetForm();
    fetchItems();
  }
});

async function deleteItem(id) {
  if (!isAdmin) {
    alert(
      "Akses ditolak! Silakan masukkan PIN terlebih dahulu melalui mode admin.",
    );
    return;
  }
  if (confirm("Yakin ingin menghapus alat ini?")) {
    await dbClient.from("items").delete().eq("id", id);
    fetchItems();
  }
}

function updateStats(items) {
  document.getElementById("stat-total").innerText = items.length;
  document.getElementById("stat-baik").innerText = items.filter(
    (i) => i.kondisi && i.kondisi.includes("Baik"),
  ).length;
  document.getElementById("stat-rusak").innerText = items.filter(
    (i) => i.kondisi && !i.kondisi.includes("Baik"),
  ).length;
  document.getElementById("stat-dipinjam").innerText = items.filter(
    (i) => i.status_pinjam === "Dipinjam",
  ).length;
}

function filterByStat(statusType) {
  switchTab("katalog");
  const rows = document.querySelectorAll("#inventoryTable tr");
  rows.forEach((row) => {
    if (row.cells.length <= 1) return;
    const statusBadge = row.cells[4].innerText.toLowerCase();
    const kondisiBadge = row.cells[5].innerText.toLowerCase();
    let show = false;

    if (statusType === "total") show = true;
    else if (
      statusType === "layak" &&
      (kondisiBadge.includes("baik") || kondisiBadge.includes("layak"))
    )
      show = true;
    else if (statusType === "rusak" && kondisiBadge.includes("rusak"))
      show = true;
    else if (
      statusType === "dipinjam" &&
      (statusBadge.includes("dipinjam") || statusBadge.includes("ekspedisi"))
    )
      show = true;

    row.style.display = show ? "" : "none";
  });
}
