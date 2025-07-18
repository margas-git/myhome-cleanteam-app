import XLSX from "xlsx";

const workbook = XLSX.readFile("team-changes/MyHome_Data.xlsx");
const sheet = workbook.Sheets["time_entries"];
if (!sheet) {
  console.error("No time_entries sheet found");
  process.exit(1);
}
const data = XLSX.utils.sheet_to_json(sheet);
console.log("First 5 rows of time_entries:");
console.log(data.slice(0, 5)); 