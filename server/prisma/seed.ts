import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed default settings
  await prisma.laborSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { defaultMakeTimeMin: 30, avgHourlyRate: 25 },
  });

  await prisma.overheadSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { facilityOverheadPercent: 15, indirectLaborPercent: 10, defaultMarkupPercent: 30 },
  });

  // Seed sample foams
  const foams = [
    { grade: 'HR-2130', density: 2.1, ild: 30, costPerBoardFoot: 0.45, supplier: 'FXI' },
    { grade: 'HR-2540', density: 2.5, ild: 40, costPerBoardFoot: 0.52, supplier: 'FXI' },
    { grade: 'HR-2850', density: 2.8, ild: 50, costPerBoardFoot: 0.61, supplier: 'FXI' },
    { grade: 'HD-3660', density: 3.6, ild: 60, costPerBoardFoot: 0.78, supplier: 'Leggett & Platt' },
    { grade: 'LUX-1825', density: 1.8, ild: 25, costPerBoardFoot: 0.89, supplier: 'FXI' },
    { grade: 'QD-2735', density: 2.7, ild: 35, costPerBoardFoot: 0.95, supplier: 'Carpenter' },
    { grade: 'FR-2840', density: 2.8, ild: 40, costPerBoardFoot: 1.15, supplier: 'Carpenter', description: 'Fire retardant' },
    { grade: 'MEM-4020', density: 4.0, ild: 20, costPerBoardFoot: 1.45, supplier: 'Tempur', description: 'Memory foam' },
  ];

  for (const foam of foams) {
    await prisma.foam.upsert({
      where: { grade: foam.grade },
      update: foam,
      create: foam,
    });
  }

  // Seed sample dacrons
  const dacrons = [
    { name: 'Standard 6oz', weightOz: 6, thicknessInches: 0.5, costPerSqFt: 0.15 },
    { name: 'Premium 8oz', weightOz: 8, thicknessInches: 0.75, costPerSqFt: 0.22 },
    { name: 'Heavy 10oz', weightOz: 10, thicknessInches: 1.0, costPerSqFt: 0.30 },
  ];

  for (const dacron of dacrons) {
    await prisma.dacron.upsert({
      where: { name: dacron.name },
      update: dacron,
      create: dacron,
    });
  }

  // Seed sample customers
  const customers = [
    { name: 'Acme Furniture', code: 'ACME', shippingCostPerBF: 0.05, markupPercent: 30 },
    { name: 'Budget Cushions', code: 'BUDGET', shippingCostPerBF: 0.03, markupPercent: 25 },
    { name: 'Luxury Living', code: 'LUXLIV', shippingCostPerBF: 0.08, markupPercent: 40 },
  ];

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { code: customer.code },
      update: customer,
      create: customer,
    });
  }

  console.log('Seed complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
