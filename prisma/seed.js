import 'dotenv/config';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient({});

async function main() {
  // Crear Usuario
  const usuario = await prisma.usuario.upsert({
    where: { email: 'admin@crm.com' },
    update: {},
    create: {
      nombre: 'Administrador',
      email: 'admin@crm.com',
    },
  });

  console.log('Usuario creado:', usuario);

  // Crear Zonas
  const zonasData = [
    {
      id: 'Z001',
      nombre: 'Zona Norte',
      descripcion: 'Sector industrial primario.',
      metadata: { area: 1500, sector: 'A' },
    },
    {
      id: 'Z002',
      nombre: 'Zona Sur',
      descripcion: 'Sector de ensamblaje.',
      metadata: { area: 2200, sector: 'B' },
    },
  ];

  for (const z of zonasData) {
    const zona = await prisma.zona.upsert({
      where: { id: z.id },
      update: {},
      create: z,
    });
    console.log('Zona creada:', zona.id);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
