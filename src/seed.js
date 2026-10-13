// Adds a few sample patients so the flow can be tried out: `npm run seed`
const { q, normalizePhone } = require('./db');

const samples = [
  ['9876543210', 'Ravi Kumar', 42, 'Male'],
  ['9876543210', 'Anita Kumar', 38, 'Female'],
  ['9876543210', 'Arjun Kumar', 12, 'Male'],
  ['9123456789', 'Fathima Rahman', 55, 'Female'],
];

for (const [phone, name, age, gender] of samples) {
  const p = normalizePhone(phone);
  if (q.patientsByPhone.all(p).some((r) => r.name === name)) continue;
  q.insertPatient.run(p, name, age, gender);
  console.log(`Added ${name} (${p})`);
}
