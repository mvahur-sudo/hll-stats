// Unikaalne kaartide list
const MAPS = [
  "Carentan",
  "Driel",
  "El Alamein",
  "Elsenborn Ridge",
  "Foy",
  "Hill 400",
  "Hürtgen Forest",
  "Kharkov",
  "Kursk",
  "Marvie",
  "Mortain",
  "Omaha Beach",
  "Purple Heart Lane",
  "Remagen",
  "Sainte-Marie-du-Mont",
  "Sainte-Mère-Église",
  "Smolentsk",
  "Stalingrad",
  "Tobruk",
  "Utah Beach"
];

// Täida kaardi valiku dropdown
function initMapSelect(selectEl) {
  MAPS.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    selectEl.appendChild(opt);
  });
}
